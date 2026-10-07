"""Importing release notifications from GitHub."""

import asyncio
from datetime import timedelta

import pytest
import respx
from httpx import AsyncClient, ConnectError, Response
from sqlalchemy import select

from ghr.container import Container
from ghr.events import Event
from ghr.github.client import format_timestamp
from ghr.models import Release, Repository, SyncState
from tests.conftest import GITHUB_API, SentNotifications
from tests.github_fixtures import ISSUE_NOTIFICATION, FakeRelease, mock_github, mock_release

FIRST = FakeRelease(1, 10, "acme/app", "v1.0.0", "2026-10-01T10:00:00Z")
SECOND = FakeRelease(2, 20, "acme/tool", "v2.0.0", "2026-10-02T10:00:00Z")
READ = FakeRelease(3, 30, "acme/lib", "v0.1.0", "2026-10-03T10:00:00Z", unread=False)


async def stored_release_ids(container: Container) -> set[int]:
    async with container.session_factory() as session:
        return set(await session.scalars(select(Release.id)))


async def sync_state(container: Container) -> SyncState:
    async with container.session_factory() as session:
        state = await session.get(SyncState, 1)
        assert state is not None
        return state


class TestImport:
    async def test_imports_release_notifications_with_their_read_state(
        self, container: Container, github_api: respx.MockRouter
    ) -> None:
        mock_github(github_api, [FIRST, READ], extra_notifications=[ISSUE_NOTIFICATION])

        result = await container.sync.sync()

        assert (result.imported, result.error) == (2, None)
        async with container.session_factory() as session:
            read_at = dict(list(await session.execute(select(Release.id, Release.read_at))))
        assert read_at[FIRST.id] is None
        assert read_at[READ.id] is not None

    async def test_follows_pagination(
        self, container: Container, github_api: respx.MockRouter
    ) -> None:
        next_page = f"{GITHUB_API}/notifications?page=2"
        github_api.get("/notifications", params={"page": "2"}).mock(
            return_value=Response(200, json=[SECOND.notification()])
        )
        github_api.get("/notifications").mock(
            return_value=Response(
                200, json=[FIRST.notification()], headers={"Link": f'<{next_page}>; rel="next"'}
            )
        )
        mock_release(github_api, FIRST)
        mock_release(github_api, SECOND)

        await container.sync.sync()

        assert await stored_release_ids(container) == {1, 2}

    async def test_polls_conditionally_with_github_time(
        self, container: Container, github_api: respx.MockRouter
    ) -> None:
        mock_github(github_api, [FIRST])
        await container.sync.sync()
        route = github_api.get("/notifications").mock(return_value=Response(304))

        result = await container.sync.sync()

        request = route.calls.last.request
        assert result.imported == 0
        assert request.headers["If-Modified-Since"] == "Mon, 05 Oct 2026 12:00:00 GMT"
        # GitHub's Date header was 12:00:30; the next poll overlaps by five minutes.
        assert request.url.params["since"] == "2026-10-05T11:55:30Z"

    async def test_lists_update_after_every_batch(
        self, container: Container, github_api: respx.MockRouter, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        releases = [
            FakeRelease(100 + index, 10, "acme/app", f"v1.{index}.0", "2026-10-01T10:00:00Z")
            for index in range(30)
        ]
        mock_github(github_api, releases)
        published: list[Event] = []
        monkeypatch.setattr(container.broker, "publish", published.append)

        await container.sync.sync()

        assert [event.type for event in published].count("releases-changed") == 2


class TestFailingReleases:
    async def test_skips_drafts_and_deleted_releases(
        self, container: Container, github_api: respx.MockRouter
    ) -> None:
        draft = FakeRelease(4, 40, "acme/draft", "v0.1.0", "2026-10-03T10:00:00Z", draft=True)
        mock_github(github_api, [FIRST, draft, SECOND])
        github_api.get(SECOND.api_url).mock(return_value=Response(404))

        result = await container.sync.sync()

        assert result.error is None
        assert await stored_release_ids(container) == {1}

    async def test_inaccessible_release_does_not_block_the_sync(
        self, container: Container, github_api: respx.MockRouter
    ) -> None:
        mock_github(github_api, [FIRST, SECOND])
        github_api.get(SECOND.api_url).mock(
            return_value=Response(403, json={"message": "Resource protected by SAML enforcement"})
        )

        result = await container.sync.sync()

        assert result.error is None
        assert await stored_release_ids(container) == {1}
        assert (await sync_state(container)).last_synced_at is not None

    async def test_follows_redirects_of_renamed_repositories(
        self, container: Container, github_api: respx.MockRouter
    ) -> None:
        moved = f"{GITHUB_API}/repositories/10/releases/1"
        mock_github(github_api, [FIRST])
        github_api.get(FIRST.api_url).mock(return_value=Response(301, headers={"Location": moved}))
        github_api.get(moved).mock(return_value=Response(200, json=FIRST.release()))

        assert (await container.sync.sync()).imported == 1

    async def test_never_calls_urls_outside_the_api(
        self, container: Container, github_api: respx.MockRouter
    ) -> None:
        foreign = FIRST.notification()
        foreign["subject"]["url"] = "https://attacker.test/collect"
        github_api.get("/notifications").mock(
            return_value=Response(
                200,
                json=[foreign],
                headers={"Link": '<https://attacker.test/page2>; rel="next"'},
            )
        )

        result = await container.sync.sync()

        # The foreign pagination link aborts the sync before any foreign request is made.
        assert result.error is not None and "outside the GitHub API" in result.error
        assert await stored_release_ids(container) == set()


class TestFailures:
    async def test_rate_limit_keeps_and_announces_imported_batches(
        self, container: Container, github_api: respx.MockRouter, sent: SentNotifications
    ) -> None:
        mock_github(github_api, [FIRST])
        await container.sync.sync()
        releases = [
            FakeRelease(100 + index, 10, "acme/app", f"v1.{index}.0", "2026-10-02T10:00:00Z")
            for index in range(30)
        ]
        mock_github(github_api, [FIRST, *releases])
        github_api.get(releases[-1].api_url).mock(
            return_value=Response(
                403,
                json={"message": "You have exceeded a secondary rate limit"},
                headers={"Retry-After": "120"},
            )
        )

        result = await container.sync.sync()
        await container.tasks.wait()

        assert result.retry_after_seconds == 120
        assert "secondary rate limit" in ((await sync_state(container)).last_error or "")
        # The first batch of 25 was stored, won't be fetched again, and was announced.
        assert len(await stored_release_ids(container)) == 26
        assert [notification.title for notification in sent] == ["25 new releases"]

    async def test_repository_name_collision_is_resolved(
        self, container: Container, github_api: respx.MockRouter
    ) -> None:
        mock_github(github_api, [FIRST])
        await container.sync.sync()
        # Repository 10 was renamed; a new repository 11 now uses the old name.
        newcomer = FakeRelease(5, 11, "acme/app", "v9.0.0", "2026-10-04T10:00:00Z")
        mock_github(github_api, [newcomer])

        assert (await container.sync.sync()).error is None
        async with container.session_factory() as session:
            names = dict(list(await session.execute(select(Repository.id, Repository.full_name))))
        assert names == {10: "acme/app#10", 11: "acme/app"}

    async def test_unexpected_errors_are_recorded(
        self, container: Container, github_api: respx.MockRouter
    ) -> None:
        github_api.get("/notifications").mock(return_value=Response(200, json=[{"bogus": True}]))

        result = await container.sync.sync()

        assert result.error is not None
        assert (await sync_state(container)).last_error

    async def test_network_failures_get_a_readable_message(
        self, container: Container, github_api: respx.MockRouter
    ) -> None:
        github_api.get("/notifications").mock(side_effect=ConnectError(""))

        result = await container.sync.sync()

        assert result.error == "Couldn't reach GitHub (ConnectError)"
        assert (await sync_state(container)).last_error == result.error


async def test_user_actions_are_not_blocked_while_fetching(
    container: Container, github_api: respx.MockRouter, user_client: AsyncClient
) -> None:
    mock_github(github_api, [FIRST])
    await container.sync.sync()
    released, fetching = asyncio.Event(), asyncio.Event()

    async def slow_release(_: object) -> Response:
        fetching.set()
        await released.wait()
        return Response(200, json=SECOND.release())

    mock_github(github_api, [FIRST, SECOND])
    github_api.get(SECOND.api_url).mock(side_effect=slow_release)
    sync = asyncio.create_task(container.sync.sync())
    await fetching.wait()

    # A write while the sync waits for GitHub must succeed immediately.
    response = await asyncio.wait_for(
        user_client.post(f"/api/releases/{FIRST.id}/unread"), timeout=2
    )
    released.set()
    await sync

    assert response.status_code == 204


async def test_new_releases_are_announced_after_the_first_import(
    container: Container, github_api: respx.MockRouter, sent: SentNotifications
) -> None:
    mock_github(github_api, [FIRST])
    await container.sync.sync()
    await container.tasks.wait()
    assert sent == []

    mock_github(github_api, [FIRST, SECOND])
    await container.sync.sync()
    await container.tasks.wait()

    assert [(item.title, item.path) for item in sent] == [
        ("acme/tool", f"/inbox?release={SECOND.id}")
    ]


async def test_watching_again_after_unsubscribing_brings_the_repository_back(
    container: Container, github_api: respx.MockRouter, user_client: AsyncClient
) -> None:
    mock_github(github_api, [FIRST])
    await container.sync.sync()
    github_api.delete("/repositories/10/subscription").mock(return_value=Response(204))
    github_api.patch(url__regex=r"/notifications/threads/.+").mock(return_value=Response(205))
    await user_client.post("/api/repositories/10/unsubscribe")
    async with container.session_factory() as session:
        unsubscribed_at = (await session.get_one(Repository, 10)).unsubscribed_at
    assert unsubscribed_at is not None

    later = FakeRelease(
        6, 10, "acme/app", "v1.1.0", format_timestamp(unsubscribed_at + timedelta(minutes=1))
    )
    mock_github(github_api, [FIRST, later])
    await container.sync.sync()

    async with container.session_factory() as session:
        assert (await session.get_one(Repository, 10)).unsubscribed_at is None
