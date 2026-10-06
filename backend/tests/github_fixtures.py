"""Builders for GitHub API payloads and mocked endpoints used by the tests."""

from dataclasses import dataclass
from typing import Any

import respx
from httpx import Response

from tests.conftest import GITHUB_API


@dataclass(frozen=True)
class FakeRelease:
    id: int
    repo_id: int
    full_name: str
    tag_name: str
    published_at: str
    name: str | None = None
    body: str = "Release notes"
    unread: bool = True
    prerelease: bool = False
    draft: bool = False

    @property
    def thread_id(self) -> str:
        return f"thread-{self.id}"

    @property
    def api_url(self) -> str:
        """URL in the notification, by repository name."""
        return f"{GITHUB_API}/repos/{self.full_name}/releases/{self.id}"

    @property
    def refresh_url(self) -> str:
        """URL the refresh uses, by repository id."""
        return f"{GITHUB_API}/repositories/{self.repo_id}/releases/{self.id}"

    def notification(self) -> dict[str, Any]:
        owner = self.full_name.split("/")[0]
        return {
            "id": self.thread_id,
            "unread": self.unread,
            "updated_at": self.published_at,
            "last_read_at": None if self.unread else self.published_at,
            "repository": {
                "id": self.repo_id,
                "full_name": self.full_name,
                "owner": {"login": owner, "avatar_url": f"https://avatars.test/{owner}"},
                "html_url": f"https://github.com/{self.full_name}",
                "description": f"The {self.full_name} project",
                "private": False,
            },
            "subject": {"title": self.tag_name, "url": self.api_url, "type": "Release"},
        }

    def release(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "tag_name": self.tag_name,
            "name": self.name,
            "body": self.body,
            "html_url": f"https://github.com/{self.full_name}/releases/tag/{self.tag_name}",
            "author": {"login": "octocat", "avatar_url": "https://avatars.test/octocat"},
            "prerelease": self.prerelease,
            "draft": self.draft,
            "created_at": self.published_at,
            "published_at": self.published_at,
        }


ISSUE_NOTIFICATION = {
    "id": "thread-issue",
    "unread": True,
    "updated_at": "2026-10-01T12:00:00Z",
    "repository": {
        "id": 999,
        "full_name": "acme/issues",
        "owner": {"login": "acme", "avatar_url": "https://avatars.test/acme"},
        "html_url": "https://github.com/acme/issues",
        "private": False,
    },
    "subject": {"title": "Bug", "url": f"{GITHUB_API}/repos/acme/issues/issues/1", "type": "Issue"},
}


NOTIFICATION_HEADERS = {
    "Last-Modified": "Mon, 05 Oct 2026 12:00:00 GMT",
    "Date": "Mon, 05 Oct 2026 12:00:30 GMT",
    "X-Poll-Interval": "60",
}


def mock_github(
    router: respx.MockRouter,
    releases: list[FakeRelease],
    *,
    extra_notifications: list[dict[str, Any]] | None = None,
) -> respx.Route:
    """Serve the notifications list and every release. Returns the notifications route."""
    notifications = [release.notification() for release in releases]
    route = router.get("/notifications").mock(
        return_value=Response(
            200, json=notifications + (extra_notifications or []), headers=NOTIFICATION_HEADERS
        )
    )
    for release in releases:
        mock_release(router, release)
    return route


def mock_release(
    router: respx.MockRouter, release: FakeRelease, *, etag: str = '"v1"'
) -> respx.Route:
    return router.get(release.api_url).mock(
        return_value=Response(200, json=release.release(), headers={"ETag": etag})
    )
