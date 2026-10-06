from datetime import UTC, datetime, timedelta

import respx
from httpx import AsyncClient, Response
from sqlalchemy import update

from ghr.container import Container
from ghr.models import Release
from tests.conftest import SentNotifications
from tests.github_fixtures import FakeRelease, mock_github

OLD = FakeRelease(1, 10, "acme/app", "v1.0.0", "2026-10-01T10:00:00Z", body="First notes")
NEW = FakeRelease(2, 10, "acme/app", "v1.1.0", "2026-10-02T10:00:00Z", body="Second notes")
RC = FakeRelease(3, 20, "acme/tool", "v3.0.0-rc.1", "2026-10-03T10:00:00Z", prerelease=True)


async def setup(container: Container, github_api: respx.MockRouter) -> None:
    mock_github(github_api, [OLD, NEW, RC])
    assert (await container.sync.sync()).error is None


async def list_ids(client: AsyncClient, view: str) -> list[int]:
    response = await client.get("/api/releases", params={"view": view})
    assert response.status_code == 200
    return [item["id"] for item in response.json()["items"]]


def in_future(**delta: float) -> str:
    return (datetime.now(UTC) + timedelta(**delta)).isoformat()


class TestSnooze:
    async def test_snoozed_entries_move_to_their_own_view(
        self, container: Container, github_api: respx.MockRouter, user_client: AsyncClient
    ) -> None:
        await setup(container, github_api)

        response = await user_client.post(
            f"/api/releases/{NEW.id}/snooze", json={"until": in_future(hours=3)}
        )

        assert response.status_code == 204
        assert await list_ids(user_client, "inbox") == [RC.id]
        assert await list_ids(user_client, "snoozed") == [NEW.id]
        counts = (await user_client.get("/api/releases/counts")).json()
        assert (counts["inbox"], counts["snoozed"]) == (1, 1)

        await user_client.delete(f"/api/releases/{NEW.id}/snooze")
        assert await list_ids(user_client, "snoozed") == []

    async def test_rejects_times_in_the_past(
        self, container: Container, github_api: respx.MockRouter, user_client: AsyncClient
    ) -> None:
        await setup(container, github_api)

        response = await user_client.post(
            f"/api/releases/{NEW.id}/snooze", json={"until": in_future(hours=-1)}
        )

        assert response.status_code == 422

    async def test_expired_snoozes_come_back_with_a_reminder(
        self,
        container: Container,
        github_api: respx.MockRouter,
        user_client: AsyncClient,
        sent: SentNotifications,
    ) -> None:
        await setup(container, github_api)
        await user_client.post(f"/api/releases/{NEW.id}/snooze", json={"until": in_future(hours=1)})
        async with container.session_factory() as session:
            await session.execute(
                update(Release)
                .values(snoozed_until=datetime.now(UTC) - timedelta(minutes=1))
                .where(Release.snoozed_until.is_not(None))
            )
            await session.commit()

        woken = await container.snoozes.wake_due()

        assert woken == 2
        assert set(await list_ids(user_client, "inbox")) == {NEW.id, RC.id}
        assert [(item.title, item.path) for item in sent] == [
            ("Back from snooze: acme/app", f"/inbox?release={NEW.id}")
        ]

    async def test_marking_read_clears_the_snooze(
        self, container: Container, github_api: respx.MockRouter, user_client: AsyncClient
    ) -> None:
        await setup(container, github_api)
        github_api.patch(url__regex=r"/notifications/threads/.+").mock(return_value=Response(205))
        await user_client.post(f"/api/releases/{NEW.id}/snooze", json={"until": in_future(days=1)})

        await user_client.post(f"/api/releases/{NEW.id}/read")

        assert await list_ids(user_client, "snoozed") == []
        assert await list_ids(user_client, "read") == [NEW.id]


class TestPreferences:
    async def test_hiding_prereleases_filters_every_view_but_hidden(
        self, container: Container, github_api: respx.MockRouter, user_client: AsyncClient
    ) -> None:
        await setup(container, github_api)
        assert (await user_client.get("/api/preferences")).json() == {
            "show_prereleases": True,
            "notify_prereleases": True,
        }

        updated = await user_client.patch("/api/preferences", json={"show_prereleases": False})

        assert updated.json()["show_prereleases"] is False
        assert await list_ids(user_client, "inbox") == [NEW.id]
        assert (await user_client.get("/api/releases/counts")).json()["inbox"] == 1


class TestWhatsNew:
    async def test_lists_unread_releases_with_notes_newest_first(
        self, container: Container, github_api: respx.MockRouter, user_client: AsyncClient
    ) -> None:
        await setup(container, github_api)

        response = await user_client.get("/api/repositories/10/unread")

        assert [(item["tag_name"], item["body"]) for item in response.json()] == [
            ("v1.1.0", "Second notes"),
            ("v1.0.0", "First notes"),
        ]


async def test_marking_unread_in_an_unsubscribed_repository_keeps_it_visible(
    container: Container, github_api: respx.MockRouter, user_client: AsyncClient
) -> None:
    await setup(container, github_api)
    github_api.delete("/repos/acme/app/subscription").mock(return_value=Response(204))
    github_api.patch(url__regex=r"/notifications/threads/.+").mock(return_value=Response(205))
    await user_client.post("/api/repositories/10/unsubscribe")

    await user_client.post(f"/api/releases/{NEW.id}/unread")

    assert NEW.id in await list_ids(user_client, "inbox")
