"""Actions on releases and repositories: read state, snoozing, unsubscribing and muting."""

from datetime import UTC, datetime, timedelta

import pytest
import respx
from httpx import AsyncClient, Response
from sqlalchemy import update

from ghr.container import Container
from ghr.models import Release
from tests.conftest import SentNotifications, list_ids
from tests.github_fixtures import FakeRelease, import_releases

WEB_OLD = FakeRelease(1, 10, "acme/app", "web@1.0.0", "2026-10-01T10:00:00Z")
DOCS = FakeRelease(2, 10, "acme/app", "docs@1.0.0", "2026-10-02T10:00:00Z")
WEB_NEW = FakeRelease(3, 10, "acme/app", "web@1.1.0", "2026-10-03T10:00:00Z")
TOOL = FakeRelease(4, 20, "acme/tool", "v1.0.0", "2026-10-04T10:00:00Z")


@pytest.fixture
async def synced(container: Container, github_api: respx.MockRouter) -> respx.Route:
    """Imported releases; returns the route that marks GitHub threads as read."""
    await import_releases(container, github_api, [WEB_OLD, DOCS, WEB_NEW, TOOL])
    return github_api.patch(url__regex=r"/notifications/threads/.+").mock(
        return_value=Response(205)
    )


async def hide_docs(client: AsyncClient) -> None:
    response = await client.post("/api/hide-rules", json={"repository_id": 10, "pattern": "docs@*"})
    assert response.status_code == 201


def in_hours(hours: float) -> str:
    return (datetime.now(UTC) + timedelta(hours=hours)).isoformat()


class TestMarkRead:
    async def test_marks_older_releases_in_the_view_and_mirrors_to_github(
        self, synced: respx.Route, user_client: AsyncClient
    ) -> None:
        await hide_docs(user_client)

        response = await user_client.post(
            f"/api/releases/{WEB_NEW.id}/read", json={"include_older_in": "inbox"}
        )

        assert response.status_code == 204
        marked = {call.request.url.path.rsplit("/", 1)[-1] for call in synced.calls}
        assert marked == {WEB_NEW.thread_id, WEB_OLD.thread_id}
        # The hidden release wasn't shown with the entry, so it stays unread.
        assert await list_ids(user_client, "hidden") == [DOCS.id]
        assert set(await list_ids(user_client, "read")) == {WEB_NEW.id}

    async def test_acting_in_hidden_leaves_the_inbox_alone(
        self, synced: respx.Route, user_client: AsyncClient
    ) -> None:
        await hide_docs(user_client)

        await user_client.post(f"/api/releases/{DOCS.id}/read", json={"include_older_in": "hidden"})

        assert WEB_NEW.id in await list_ids(user_client, "inbox")
        older = (await user_client.get("/api/releases", params={"view": "inbox"})).json()
        app = next(item for item in older["items"] if item["repository"]["id"] == 10)
        assert app["older_count"] == 1

    async def test_only_the_release_itself_without_a_view(
        self, synced: respx.Route, user_client: AsyncClient
    ) -> None:
        await user_client.post(f"/api/releases/{WEB_NEW.id}/read", json={})

        entry = next(
            item
            for item in (await user_client.get("/api/releases")).json()["items"]
            if item["repository"]["id"] == 10
        )
        assert entry["id"] == DOCS.id

    async def test_tolerates_github_failures(
        self, synced: respx.Route, user_client: AsyncClient
    ) -> None:
        synced.mock(return_value=Response(500))

        response = await user_client.post(
            f"/api/releases/{TOOL.id}/read", json={"include_older_in": "inbox"}
        )

        assert response.status_code == 204
        assert TOOL.id in await list_ids(user_client, "read")

    async def test_a_search_narrows_what_the_entry_covers(
        self, synced: respx.Route, user_client: AsyncClient
    ) -> None:
        # Searching "web" lists web@1.1.0 with "+1 older" (web@1.0.0), not the docs release.
        listed = (await user_client.get("/api/releases", params={"q": "web"})).json()
        entry = next(item for item in listed["items"] if item["repository"]["id"] == 10)
        unread = await user_client.get("/api/repositories/10/unread", params={"q": "web"})

        await user_client.post(
            f"/api/releases/{WEB_NEW.id}/read", json={"include_older_in": "inbox", "search": "web"}
        )

        assert entry["older_count"] == 1
        assert [item["id"] for item in unread.json()] == [WEB_NEW.id, WEB_OLD.id]
        assert set(await list_ids(user_client, "read")) == {WEB_NEW.id}
        assert DOCS.id in await list_ids(user_client, "inbox")

    async def test_mark_unread_moves_it_back(
        self, synced: respx.Route, user_client: AsyncClient
    ) -> None:
        await user_client.post(f"/api/releases/{TOOL.id}/read", json={})

        assert (await user_client.post(f"/api/releases/{TOOL.id}/unread")).status_code == 204
        assert TOOL.id in await list_ids(user_client, "inbox")


class TestSnooze:
    async def test_snoozes_the_entry_and_undoes_exactly_that(
        self, synced: respx.Route, user_client: AsyncClient
    ) -> None:
        earlier = in_hours(1)
        await user_client.post(f"/api/releases/{TOOL.id}/snooze", json={"until": earlier})

        response = await user_client.post(
            f"/api/releases/{WEB_NEW.id}/snooze", json={"until": in_hours(3), "view": "inbox"}
        )

        assert response.status_code == 204
        assert set(await list_ids(user_client, "snoozed")) == {WEB_NEW.id, TOOL.id}
        assert (await user_client.get("/api/releases/counts")).json()["inbox"] == 0

        await user_client.delete(f"/api/releases/{WEB_NEW.id}/snooze")

        # Only what was snoozed together comes back; the other snooze stays.
        assert await list_ids(user_client, "snoozed") == [TOOL.id]
        assert WEB_NEW.id in await list_ids(user_client, "inbox")

    async def test_rejects_hidden_read_and_past(
        self, synced: respx.Route, user_client: AsyncClient
    ) -> None:
        await hide_docs(user_client)
        await user_client.post(f"/api/releases/{TOOL.id}/read", json={})

        hidden = await user_client.post(
            f"/api/releases/{DOCS.id}/snooze", json={"until": in_hours(1)}
        )
        read = await user_client.post(
            f"/api/releases/{TOOL.id}/snooze", json={"until": in_hours(1)}
        )
        past = await user_client.post(
            f"/api/releases/{WEB_NEW.id}/snooze", json={"until": in_hours(-1)}
        )

        assert (hidden.status_code, read.status_code, past.status_code) == (409, 409, 422)

    async def test_only_unread_views_can_be_snoozed_from(
        self, synced: respx.Route, user_client: AsyncClient
    ) -> None:
        for view in ("read", "hidden"):
            response = await user_client.post(
                f"/api/releases/{TOOL.id}/snooze", json={"until": in_hours(1), "view": view}
            )
            assert response.status_code == 422, view

    async def test_expired_snoozes_come_back_with_a_reminder(
        self,
        container: Container,
        synced: respx.Route,
        user_client: AsyncClient,
        sent: SentNotifications,
    ) -> None:
        await user_client.post(f"/api/releases/{WEB_NEW.id}/snooze", json={"until": in_hours(1)})
        async with container.session_factory() as session:
            await session.execute(
                update(Release)
                .where(Release.snoozed_until.is_not(None))
                .values(snoozed_until=datetime.now(UTC) - timedelta(minutes=1))
            )
            await session.commit()

        woken = await container.snoozes.wake_due()

        assert woken == 3
        assert WEB_NEW.id in await list_ids(user_client, "inbox")
        assert [(item.title, item.path) for item in sent] == [
            ("Back from snooze: acme/app", f"/inbox?release={WEB_NEW.id}")
        ]

    async def test_marking_read_clears_the_snooze(
        self, synced: respx.Route, user_client: AsyncClient
    ) -> None:
        await user_client.post(f"/api/releases/{TOOL.id}/snooze", json={"until": in_hours(24)})

        await user_client.post(
            f"/api/releases/{TOOL.id}/read", json={"include_older_in": "snoozed"}
        )

        assert await list_ids(user_client, "snoozed") == []
        assert await list_ids(user_client, "read") == [TOOL.id]


class TestUnsubscribe:
    async def test_unwatches_repository_and_clears_its_releases(
        self, github_api: respx.MockRouter, synced: respx.Route, user_client: AsyncClient
    ) -> None:
        unwatch = github_api.delete("/repositories/10/subscription").mock(
            return_value=Response(204)
        )

        response = await user_client.post("/api/repositories/10/unsubscribe")

        assert response.status_code == 204
        assert unwatch.called
        assert await list_ids(user_client, "inbox") == [TOOL.id]
        detail = (await user_client.get(f"/api/releases/{WEB_NEW.id}")).json()
        assert detail["repository"]["unsubscribed_at"] is not None

    async def test_a_deleted_repository_can_still_be_unsubscribed(
        self, github_api: respx.MockRouter, synced: respx.Route, user_client: AsyncClient
    ) -> None:
        github_api.delete("/repositories/10/subscription").mock(
            return_value=Response(404, json={"message": "Not Found"})
        )

        response = await user_client.post("/api/repositories/10/unsubscribe")

        assert response.status_code == 204
        assert await list_ids(user_client, "inbox") == [TOOL.id]

    async def test_reports_github_errors_and_changes_nothing(
        self, github_api: respx.MockRouter, synced: respx.Route, user_client: AsyncClient
    ) -> None:
        github_api.delete("/repositories/10/subscription").mock(
            return_value=Response(403, json={"message": "Forbidden"})
        )

        response = await user_client.post("/api/repositories/10/unsubscribe")

        assert response.status_code == 502
        assert WEB_NEW.id in await list_ids(user_client, "inbox")


@pytest.mark.usefixtures("synced")
async def test_muting_a_repository(user_client: AsyncClient) -> None:
    muted = await user_client.put("/api/repositories/10/notifications", json={"enabled": False})

    assert muted.json()["notifications_muted_at"] is not None
    listed = (await user_client.get("/api/repositories/muted")).json()
    assert [repository["id"] for repository in listed] == [10]

    await user_client.put("/api/repositories/10/notifications", json={"enabled": True})

    assert (await user_client.get("/api/repositories/muted")).json() == []
