"""Which releases each view lists, and how they are grouped."""

from datetime import timedelta
from itertools import combinations

import pytest
import respx
from httpx import AsyncClient, Response
from sqlalchemy import select, update

from ghr.container import Container
from ghr.db import utcnow
from ghr.domain import PrereleaseMode, View
from ghr.models import Release, Repository
from ghr.services.filters import ViewContext, in_view
from tests.conftest import list_ids
from tests.github_fixtures import FakeRelease, import_releases

WEB_OLD = FakeRelease(1, 10, "acme/app", "web@1.0.0", "2026-10-01T10:00:00Z")
WEB_NEW = FakeRelease(2, 10, "acme/app", "web@1.1.0", "2026-10-03T10:00:00Z")
API_NEW = FakeRelease(3, 10, "acme/app", "api@2.0.0", "2026-10-02T10:00:00Z", name="API 2.0")
TOOL_READ = FakeRelease(4, 20, "acme/tool", "v0.9.0", "2026-10-04T10:00:00Z", unread=False)
BETA = FakeRelease(5, 30, "acme/lib", "v3.0.0-rc.1", "2026-10-05T10:00:00Z", prerelease=True)
ALL = [WEB_OLD, WEB_NEW, API_NEW, TOOL_READ, BETA]


@pytest.fixture
async def synced(container: Container, github_api: respx.MockRouter) -> None:
    await import_releases(container, github_api, ALL)


@pytest.mark.usefixtures("synced")
class TestGrouping:
    async def test_shows_the_newest_release_per_repository(self, user_client: AsyncClient) -> None:
        response = await user_client.get("/api/releases", params={"view": "inbox"})

        entries = {item["repository"]["full_name"]: item for item in response.json()["items"]}
        assert entries["acme/app"]["id"] == WEB_NEW.id
        assert entries["acme/app"]["older_count"] == 2
        assert await list_ids(user_client, "read") == [TOOL_READ.id]

    async def test_counts_match_the_lists(self, user_client: AsyncClient) -> None:
        counts = (await user_client.get("/api/releases/counts")).json()

        for view in View:
            assert counts[view] == len(await list_ids(user_client, view)), view

    async def test_search_matches_names_and_tags(self, user_client: AsyncClient) -> None:
        assert await list_ids(user_client, "inbox", q="api 2.0") == [API_NEW.id]
        assert await list_ids(user_client, "inbox", q="missing") == []

    async def test_history_whats_new_and_unknown_ids(self, user_client: AsyncClient) -> None:
        history = await user_client.get("/api/repositories/10/releases")
        unread = await user_client.get("/api/repositories/10/unread")

        assert [release["id"] for release in history.json()] == [2, 3, 1]
        # What's new is exactly the entry and its "+2 older".
        assert [release["id"] for release in unread.json()] == [2, 3, 1]
        assert (await user_client.get("/api/repositories/999/releases")).status_code == 404
        assert (await user_client.get("/api/repositories/999/unread")).status_code == 404
        assert (await user_client.get("/api/releases/999")).status_code == 404


@pytest.mark.usefixtures("synced")
class TestPrereleaseModes:
    async def test_show_and_mute_keep_them_in_the_inbox(self, user_client: AsyncClient) -> None:
        assert (await user_client.get("/api/preferences")).json()["prereleases"] == "show"
        assert BETA.id in await list_ids(user_client, "inbox")

        await user_client.patch("/api/preferences", json={"prereleases": "mute"})

        assert BETA.id in await list_ids(user_client, "inbox")

    async def test_hide_moves_them_to_hidden(self, user_client: AsyncClient) -> None:
        response = await user_client.patch("/api/preferences", json={"prereleases": "hide"})

        assert response.json()["prereleases"] == "hide"
        assert BETA.id not in await list_ids(user_client, "inbox")
        assert await list_ids(user_client, "hidden") == [BETA.id]
        detail = (await user_client.get(f"/api/releases/{BETA.id}")).json()
        assert detail["is_hidden"] is True

    async def test_rejects_invalid_modes(self, user_client: AsyncClient) -> None:
        for body in ({"prereleases": None}, {"prereleases": "sometimes"}, {}, {"theme": "dark"}):
            assert (await user_client.patch("/api/preferences", json=body)).status_code == 422


async def test_preferences_change_one_at_a_time(user_client: AsyncClient) -> None:
    assert (await user_client.get("/api/preferences")).json() == {
        "prereleases": "show",
        "notify_about": "all",
        "mark_read_after_viewing": False,
        "app_badge": True,
    }

    await user_client.patch("/api/preferences", json={"notify_about": "breaking"})
    response = await user_client.patch("/api/preferences", json={"app_badge": False})

    assert response.json() == {
        "prereleases": "show",
        "notify_about": "breaking",
        "mark_read_after_viewing": False,
        "app_badge": False,
    }


@pytest.mark.usefixtures("synced")
async def test_every_release_is_in_exactly_one_view(
    container: Container, user_client: AsyncClient
) -> None:
    await user_client.post("/api/hide-rules", json={"repository_id": 10, "pattern": "api@*"})
    async with container.session_factory() as session:
        await session.execute(
            update(Release)
            .where(Release.id == WEB_OLD.id)
            .values(snoozed_until=utcnow() + timedelta(days=1))
        )
        await session.commit()

    for mode in PrereleaseMode:
        context = ViewContext(now=utcnow(), prereleases=mode)
        async with container.session_factory() as session:
            members = {
                view: set(
                    await session.scalars(
                        select(Release.id).join(Repository).where(in_view(view, context))
                    )
                )
                for view in View
            }
        for first, second in combinations(View, 2):
            assert not members[first] & members[second], (mode, first, second)
        assert set().union(*members.values()) == {release.id for release in ALL}, mode


@pytest.mark.usefixtures("synced")
async def test_unread_releases_of_unsubscribed_repositories_stay_visible(
    github_api: respx.MockRouter, user_client: AsyncClient
) -> None:
    github_api.delete("/repositories/10/subscription").mock(return_value=Response(204))
    github_api.patch(url__regex=r"/notifications/threads/.+").mock(return_value=Response(205))
    await user_client.post("/api/repositories/10/unsubscribe")

    await user_client.post(f"/api/releases/{WEB_NEW.id}/unread")

    assert WEB_NEW.id in await list_ids(user_client, "inbox")
