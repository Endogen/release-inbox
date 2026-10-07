"""Asynchronous client for the parts of the GitHub REST API the application needs."""

import base64
import time
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from enum import Enum
from typing import Final
from urllib.parse import urlsplit

import httpx

from ghr.github.models import (
    GitHubReadme,
    GitHubRelease,
    GitHubRepositoryStats,
    NotificationThread,
)

API_VERSION = "2022-11-28"
NOTIFICATIONS_PAGE_SIZE = 50

# Failures that concern a single resource; retrying the whole sync won't change them.
_RESOURCE_UNAVAILABLE = frozenset({403, 404, 410, 451})


class GitHubError(Exception):
    """A GitHub request failed: GitHub answered with an error, or didn't answer at all."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        retry_after_seconds: int | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.retry_after_seconds = retry_after_seconds

    @property
    def is_resource_unavailable(self) -> bool:
        """The resource is gone or inaccessible (for example SSO enforcement or a takedown)."""
        return self.status_code in _RESOURCE_UNAVAILABLE and self.retry_after_seconds is None


class GitHubUnreachableError(GitHubError):
    """No answer from GitHub: a network failure or a timeout."""

    def __init__(self, error: httpx.RequestError) -> None:
        # Network errors often have no text of their own.
        super().__init__(f"Couldn't reach GitHub ({str(error) or type(error).__name__})")


class UntrustedUrlError(GitHubError):
    """A URL from a GitHub payload points outside the API origin and was not requested."""

    def __init__(self, url: str) -> None:
        super().__init__(f"Refusing to call a URL outside the GitHub API: {url}")

    @property
    def is_resource_unavailable(self) -> bool:
        return True


class NotModified(Enum):
    """Sentinel returned by conditional requests when the cached version is still current."""

    TOKEN = "not-modified"


NOT_MODIFIED: Final = NotModified.TOKEN


@dataclass(frozen=True, slots=True)
class NotificationsResult:
    threads: list[NotificationThread]
    last_modified: str | None
    poll_interval_seconds: int | None
    #: GitHub's clock at the time of the request, used as the next ``since`` value.
    server_time: datetime | None


@dataclass(frozen=True, slots=True)
class FetchedRelease:
    release: GitHubRelease
    etag: str | None


@dataclass(frozen=True, slots=True)
class RepositoryStars:
    count: int
    etag: str | None


@dataclass(frozen=True, slots=True)
class ReadmeResult:
    content: str
    html_url: str
    download_url: str
    etag: str | None


class GitHubClient:
    def __init__(self, token: str, base_url: str) -> None:
        self._origin = _origin(base_url)
        self._http = httpx.AsyncClient(
            base_url=base_url,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": API_VERSION,
                "User-Agent": "ghr-release-inbox",
            },
            timeout=httpx.Timeout(20.0),
            # Renamed and transferred repositories answer with 301. httpx drops the
            # Authorization header when a redirect leaves the API origin.
            follow_redirects=True,
        )

    async def aclose(self) -> None:
        await self._http.aclose()

    async def list_notifications(
        self, *, since: datetime | None, if_modified_since: str | None
    ) -> NotificationsResult:
        """Fetch all notification threads (read and unread), following pagination.

        ``if_modified_since`` is only sent with the first page: a ``304`` means nothing changed
        and does not count against the rate limit.
        """
        params: dict[str, str | int] = {"all": "true", "per_page": NOTIFICATIONS_PAGE_SIZE}
        if since is not None:
            params["since"] = format_timestamp(since)
        headers = {"If-Modified-Since": if_modified_since} if if_modified_since else {}

        response = await self._request("GET", "/notifications", params=params, headers=headers)
        poll_interval = _parse_int(response.headers.get("X-Poll-Interval"))
        server_time = _parse_http_date(response.headers.get("Date"))
        if response.status_code == httpx.codes.NOT_MODIFIED:
            return NotificationsResult([], if_modified_since, poll_interval, server_time)
        _raise_for_status(response)

        last_modified = response.headers.get("Last-Modified")
        threads = _parse_threads(response)
        while next_url := response.links.get("next", {}).get("url"):
            response = await self._request("GET", self._checked(next_url))
            _raise_for_status(response)
            threads.extend(_parse_threads(response))

        return NotificationsResult(threads, last_modified, poll_interval, server_time)

    @staticmethod
    def release_path(repository_id: int, release_id: int) -> str:
        """Path of a release by ids, which keeps working when the repository is renamed."""
        return f"/repositories/{repository_id}/releases/{release_id}"

    async def get_release(
        self, url: str, *, etag: str | None = None
    ) -> FetchedRelease | NotModified | None:
        """Fetch a release by its API URL or path.

        Returns ``None`` if it no longer exists and ``NOT_MODIFIED`` if ``etag`` still matches.
        """
        response = await self._get_conditional(self._checked(url), etag)
        if not isinstance(response, httpx.Response):
            return response
        return FetchedRelease(
            GitHubRelease.model_validate(response.json()), response.headers.get("ETag")
        )

    async def mark_thread_read(self, thread_id: str) -> None:
        response = await self._request("PATCH", f"/notifications/threads/{thread_id}")
        _raise_for_status(response)

    async def repository_exists(self, repository_id: int) -> bool:
        """Whether the repository is still accessible with the token."""
        response = await self._request("GET", f"/repositories/{repository_id}")
        try:
            _raise_for_status(response)
        except GitHubError as error:
            # Gone or no longer accessible, unless GitHub only asks to wait (rate limit).
            if error.is_resource_unavailable:
                return False
            raise
        return True

    async def unwatch_repository(self, repository_id: int) -> None:
        """Stop watching a repository, which ends all its notifications including releases.

        A repository that no longer exists counts as unwatched.
        """
        response = await self._request("DELETE", f"/repositories/{repository_id}/subscription")
        if response.status_code == httpx.codes.NOT_FOUND:
            return
        _raise_for_status(response)

    async def get_repository_stars(
        self, repository_id: int, *, etag: str | None
    ) -> RepositoryStars | NotModified | None:
        """The repository's star count.

        Returns ``None`` if the repository no longer exists and ``NOT_MODIFIED`` if ``etag``
        still matches.
        """
        response = await self._get_conditional(f"/repositories/{repository_id}", etag)
        if not isinstance(response, httpx.Response):
            return response
        stats = GitHubRepositoryStats.model_validate(response.json())
        return RepositoryStars(stats.stargazers_count, response.headers.get("ETag"))

    async def get_readme(
        self, repository_id: int, *, etag: str | None
    ) -> ReadmeResult | NotModified | None:
        """Fetch the default README.

        Returns ``None`` if the repository has no README and ``NOT_MODIFIED`` if ``etag`` still
        matches the current version.
        """
        response = await self._get_conditional(f"/repositories/{repository_id}/readme", etag)
        if not isinstance(response, httpx.Response):
            return response
        # The contents API always encodes file content in base64.
        readme = GitHubReadme.model_validate(response.json())
        return ReadmeResult(
            content=base64.b64decode(readme.content).decode("utf-8", errors="replace"),
            html_url=readme.html_url,
            download_url=readme.download_url,
            etag=response.headers.get("ETag"),
        )

    async def _get_conditional(
        self, url: str, etag: str | None
    ) -> httpx.Response | NotModified | None:
        """GET with ``If-None-Match``: ``NOT_MODIFIED`` if ``etag`` still matches, ``None`` if
        the resource doesn't exist. Other failures raise ``GitHubError``."""
        headers = {"If-None-Match": etag} if etag else {}
        response = await self._request("GET", url, headers=headers)
        if response.status_code == httpx.codes.NOT_MODIFIED:
            return NOT_MODIFIED
        if response.status_code == httpx.codes.NOT_FOUND:
            return None
        _raise_for_status(response)
        return response

    async def _request(
        self,
        method: str,
        url: str,
        *,
        params: Mapping[str, str | int] | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> httpx.Response:
        """Send a request; a failure without a response raises ``GitHubUnreachableError``."""
        try:
            return await self._http.request(method, url, params=params, headers=headers)
        except httpx.RequestError as error:
            raise GitHubUnreachableError(error) from error

    def _checked(self, url: str) -> str:
        """Refuse absolute URLs outside the API origin, so the token never leaves GitHub."""
        if urlsplit(url).scheme and _origin(url) != self._origin:
            raise UntrustedUrlError(url)
        return url


def format_timestamp(value: datetime) -> str:
    """ISO 8601 in the ``YYYY-MM-DDTHH:MM:SSZ`` form the GitHub API documents."""
    return value.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _origin(url: str) -> tuple[str, str]:
    parts = urlsplit(url)
    return parts.scheme.lower(), parts.netloc.lower()


def _parse_threads(response: httpx.Response) -> list[NotificationThread]:
    return [NotificationThread.model_validate(item) for item in response.json()]


def _parse_int(value: str | None) -> int | None:
    return int(value) if value and value.isdigit() else None


def _parse_http_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return parsedate_to_datetime(value).astimezone(UTC)
    except (TypeError, ValueError):
        return None


def _retry_after_seconds(response: httpx.Response, message: str) -> int | None:
    """Seconds to wait if the response is a primary or secondary rate limit, else ``None``."""
    if response.status_code not in (httpx.codes.FORBIDDEN, httpx.codes.TOO_MANY_REQUESTS):
        return None
    if retry_after := _parse_int(response.headers.get("Retry-After")):
        return retry_after
    remaining = response.headers.get("X-RateLimit-Remaining")
    reset = _parse_int(response.headers.get("X-RateLimit-Reset"))
    if remaining == "0" and reset is not None:
        return max(1, reset - int(time.time()))
    if response.status_code == httpx.codes.TOO_MANY_REQUESTS or "rate limit" in message.lower():
        # GitHub asks to wait at least a minute when no explicit hint is given.
        return 60
    return None


def _raise_for_status(response: httpx.Response) -> None:
    if response.is_success:
        return
    try:
        message = str(response.json().get("message", response.text))
    except ValueError:
        message = response.text
    raise GitHubError(
        f"GitHub API error {response.status_code}: {message}",
        status_code=response.status_code,
        retry_after_seconds=_retry_after_seconds(response, message),
    )
