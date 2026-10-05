"""Asynchronous client for the parts of the GitHub REST API the application needs."""

import base64
import logging
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Final, Self

import httpx

from ghr.github.models import GitHubReadme, GitHubRelease, NotificationThread

logger = logging.getLogger(__name__)

API_VERSION = "2022-11-28"
NOTIFICATIONS_PAGE_SIZE = 50


class GitHubError(Exception):
    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(f"GitHub API error {status_code}: {message}")
        self.status_code = status_code


@dataclass(frozen=True, slots=True)
class NotificationsResult:
    threads: list[NotificationThread]
    not_modified: bool
    last_modified: str | None
    poll_interval_seconds: int | None


class NotModified(Enum):
    """Sentinel returned by conditional requests when the cached version is still current."""

    TOKEN = "not-modified"


NOT_MODIFIED: Final = NotModified.TOKEN


@dataclass(frozen=True, slots=True)
class ReadmeResult:
    content: str
    html_url: str
    download_url: str
    etag: str | None


class GitHubClient:
    def __init__(self, token: str, base_url: str) -> None:
        self._http = httpx.AsyncClient(
            base_url=base_url,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": API_VERSION,
                "User-Agent": "ghr-release-inbox",
            },
            timeout=httpx.Timeout(20.0),
        )

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.aclose()

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
            params["since"] = since.isoformat()
        headers = {"If-Modified-Since": if_modified_since} if if_modified_since else {}

        response = await self._http.get("/notifications", params=params, headers=headers)
        poll_interval = _parse_int(response.headers.get("X-Poll-Interval"))
        if response.status_code == httpx.codes.NOT_MODIFIED:
            return NotificationsResult([], True, if_modified_since, poll_interval)
        _raise_for_status(response)

        last_modified = response.headers.get("Last-Modified")
        threads = _parse_threads(response)
        while next_url := response.links.get("next", {}).get("url"):
            response = await self._http.get(next_url)
            _raise_for_status(response)
            threads.extend(_parse_threads(response))

        return NotificationsResult(threads, False, last_modified, poll_interval)

    async def get_release(self, url: str) -> GitHubRelease | None:
        """Fetch a release by its API URL. Returns ``None`` if it no longer exists."""
        response = await self._http.get(url)
        if response.status_code == httpx.codes.NOT_FOUND:
            return None
        _raise_for_status(response)
        return GitHubRelease.model_validate(response.json())

    async def mark_thread_read(self, thread_id: str) -> None:
        response = await self._http.patch(f"/notifications/threads/{thread_id}")
        _raise_for_status(response)

    async def unwatch_repository(self, full_name: str) -> None:
        """Stop watching a repository, which ends all its notifications including releases."""
        response = await self._http.delete(f"/repos/{full_name}/subscription")
        _raise_for_status(response)

    async def get_readme(
        self, full_name: str, *, etag: str | None
    ) -> ReadmeResult | NotModified | None:
        """Fetch the default README.

        Returns ``None`` if the repository has no README and ``NOT_MODIFIED`` if ``etag`` still
        matches the current version.
        """
        headers = {"If-None-Match": etag} if etag else {}
        response = await self._http.get(f"/repos/{full_name}/readme", headers=headers)
        if response.status_code == httpx.codes.NOT_MODIFIED:
            return NOT_MODIFIED
        if response.status_code == httpx.codes.NOT_FOUND:
            return None
        _raise_for_status(response)

        readme = GitHubReadme.model_validate(response.json())
        if readme.encoding != "base64":
            raise GitHubError(
                response.status_code, f"Unsupported README encoding {readme.encoding!r}"
            )
        return ReadmeResult(
            content=base64.b64decode(readme.content).decode("utf-8", errors="replace"),
            html_url=readme.html_url,
            download_url=readme.download_url,
            etag=response.headers.get("ETag"),
        )


def _parse_threads(response: httpx.Response) -> list[NotificationThread]:
    return [NotificationThread.model_validate(item) for item in response.json()]


def _parse_int(value: str | None) -> int | None:
    return int(value) if value and value.isdigit() else None


def _raise_for_status(response: httpx.Response) -> None:
    if response.is_success:
        return
    try:
        message = response.json().get("message", response.text)
    except ValueError:
        message = response.text
    raise GitHubError(response.status_code, message)
