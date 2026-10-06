import pytest
import respx
from httpx import AsyncClient, Response

from ghr.container import Container
from ghr.services.push import PushMessage
from tests.conftest import PASSWORD, USERNAME
from tests.github_fixtures import ISSUE_NOTIFICATION, FakeRelease, mock_github

WEB_OLD = FakeRelease(1, 10, "acme/app", "web@1.0.0", "2026-10-01T10:00:00Z")
WEB_NEW = FakeRelease(2, 10, "acme/app", "web@1.1.0", "2026-10-03T10:00:00Z")
API_NEW = FakeRelease(3, 10, "acme/app", "api@2.0.0", "2026-10-02T10:00:00Z", name="API 2.0")
TOOL_READ = FakeRelease(4, 20, "acme/tool", "v0.9.0", "2026-10-04T10:00:00Z", unread=False)
ALL_RELEASES = [WEB_OLD, WEB_NEW, API_NEW, TOOL_READ]


async def sync(container: Container, github_api: respx.MockRouter) -> None:
    mock_github(github_api, ALL_RELEASES, extra_notifications=[ISSUE_NOTIFICATION])
    result = await container.sync.sync()
    assert result.error is None


async def list_ids(client: AsyncClient, view: str, **params: str) -> list[int]:
    response = await client.get("/api/releases", params={"view": view, **params})
    assert response.status_code == 200
    return [item["id"] for item in response.json()["items"]]


class TestAuthentication:
    async def test_requires_a_session(self, client: AsyncClient) -> None:
        assert (await client.get("/api/releases")).status_code == 401

    async def test_rejects_wrong_password(self, client: AsyncClient) -> None:
        response = await client.post(
            "/api/auth/login", json={"username": USERNAME, "password": "wrong"}
        )
        assert response.status_code == 401

    async def test_session_lifecycle(self, client: AsyncClient) -> None:
        login = await client.post(
            "/api/auth/login", json={"username": USERNAME, "password": PASSWORD}
        )
        assert login.status_code == 200
        assert (await client.get("/api/auth/me")).json() == {"username": USERNAME}

        await client.post("/api/auth/logout")
        assert (await client.get("/api/auth/me")).status_code == 401


class TestSync:
    async def test_imports_only_release_notifications(
        self, container: Container, github_api: respx.MockRouter, user_client: AsyncClient
    ) -> None:
        await sync(container, github_api)

        counts = (await user_client.get("/api/releases/counts")).json()
        assert counts == {"inbox": 1, "read": 1, "hidden": 0}

    async def test_unchanged_notifications_are_not_refetched(
        self, container: Container, github_api: respx.MockRouter
    ) -> None:
        await sync(container, github_api)
        route = github_api.get("/notifications").mock(return_value=Response(304))

        result = await container.sync.sync()

        assert result.imported == 0
        assert route.calls.last.request.headers["If-Modified-Since"] == (
            "Mon, 05 Oct 2026 12:00:00 GMT"
        )

    async def test_records_failures(
        self, container: Container, github_api: respx.MockRouter, user_client: AsyncClient
    ) -> None:
        github_api.get("/notifications").mock(
            return_value=Response(401, json={"message": "Bad credentials"})
        )

        result = await container.sync.sync()

        assert result.error is not None
        status = (await user_client.get("/api/sync")).json()
        assert "Bad credentials" in status["last_error"]


class TestViews:
    async def test_shows_newest_release_per_repository(
        self, container: Container, github_api: respx.MockRouter, user_client: AsyncClient
    ) -> None:
        await sync(container, github_api)

        response = await user_client.get("/api/releases", params={"view": "inbox"})
        [item] = response.json()["items"]
        assert item["id"] == WEB_NEW.id
        assert item["older_count"] == 2
        assert await list_ids(user_client, "read") == [TOOL_READ.id]

    async def test_search_matches_names_and_tags(
        self, container: Container, github_api: respx.MockRouter, user_client: AsyncClient
    ) -> None:
        await sync(container, github_api)

        assert await list_ids(user_client, "inbox", q="api 2.0") == [API_NEW.id]
        assert await list_ids(user_client, "inbox", q="missing") == []

    async def test_repository_history(
        self, container: Container, github_api: respx.MockRouter, user_client: AsyncClient
    ) -> None:
        await sync(container, github_api)

        response = await user_client.get("/api/repositories/10/releases")
        assert [release["id"] for release in response.json()] == [2, 3, 1]


class TestHideRules:
    async def test_hidden_releases_leave_the_inbox(
        self, container: Container, github_api: respx.MockRouter, user_client: AsyncClient
    ) -> None:
        await sync(container, github_api)

        preview = await user_client.get(
            "/api/hide-rules/preview", params={"repository_id": 10, "pattern": "WEB@*"}
        )
        assert preview.json()["total"] == 2

        created = await user_client.post(
            "/api/hide-rules", json={"repository_id": 10, "pattern": "web@*"}
        )
        assert created.status_code == 201
        assert created.json()["match_count"] == 2

        assert await list_ids(user_client, "inbox") == [API_NEW.id]
        assert await list_ids(user_client, "hidden") == [WEB_NEW.id]

        await user_client.delete(f"/api/hide-rules/{created.json()['id']}")
        assert await list_ids(user_client, "inbox") == [WEB_NEW.id]

    async def test_rejects_duplicate_rules(
        self, container: Container, github_api: respx.MockRouter, user_client: AsyncClient
    ) -> None:
        await sync(container, github_api)
        rule = {"repository_id": 10, "pattern": "web@*"}

        assert (await user_client.post("/api/hide-rules", json=rule)).status_code == 201
        assert (await user_client.post("/api/hide-rules", json=rule)).status_code == 409


class TestReadState:
    async def test_mark_read_includes_older_releases_and_syncs_github(
        self, container: Container, github_api: respx.MockRouter, user_client: AsyncClient
    ) -> None:
        await sync(container, github_api)
        mark_read = github_api.patch(url__regex=r"/notifications/threads/.+").mock(
            return_value=Response(205)
        )

        response = await user_client.post(f"/api/releases/{API_NEW.id}/read")

        assert response.status_code == 204
        marked = {call.request.url.path.rsplit("/", 1)[-1] for call in mark_read.calls}
        assert marked == {API_NEW.thread_id, WEB_OLD.thread_id}
        assert await list_ids(user_client, "inbox") == [WEB_NEW.id]

    async def test_mark_read_tolerates_github_failures(
        self, container: Container, github_api: respx.MockRouter, user_client: AsyncClient
    ) -> None:
        await sync(container, github_api)
        github_api.patch(url__regex=r"/notifications/threads/.+").mock(return_value=Response(500))

        response = await user_client.post(f"/api/releases/{WEB_NEW.id}/read")

        assert response.status_code == 204
        assert await list_ids(user_client, "inbox") == []

    async def test_mark_unread_moves_release_back(
        self, container: Container, github_api: respx.MockRouter, user_client: AsyncClient
    ) -> None:
        await sync(container, github_api)

        response = await user_client.post(f"/api/releases/{TOOL_READ.id}/unread")

        assert response.status_code == 204
        assert TOOL_READ.id in await list_ids(user_client, "inbox")


class TestUnsubscribe:
    async def test_unwatches_repository_and_clears_inbox(
        self, container: Container, github_api: respx.MockRouter, user_client: AsyncClient
    ) -> None:
        await sync(container, github_api)
        unwatch = github_api.delete("/repos/acme/app/subscription").mock(return_value=Response(204))
        github_api.patch(url__regex=r"/notifications/threads/.+").mock(return_value=Response(205))

        response = await user_client.post("/api/repositories/10/unsubscribe")

        assert response.status_code == 204
        assert unwatch.called
        assert await list_ids(user_client, "inbox") == []
        detail = (await user_client.get(f"/api/releases/{WEB_NEW.id}")).json()
        assert detail["repository"]["unsubscribed_at"] is not None

    async def test_reports_github_errors(
        self, container: Container, github_api: respx.MockRouter, user_client: AsyncClient
    ) -> None:
        await sync(container, github_api)
        github_api.delete("/repos/acme/app/subscription").mock(
            return_value=Response(403, json={"message": "Forbidden"})
        )

        response = await user_client.post("/api/repositories/10/unsubscribe")

        assert response.status_code == 502
        assert await list_ids(user_client, "inbox") == [WEB_NEW.id]


class TestNotificationMuting:
    async def test_toggle_and_list_muted_repositories(
        self, container: Container, github_api: respx.MockRouter, user_client: AsyncClient
    ) -> None:
        await sync(container, github_api)

        muted = await user_client.put("/api/repositories/10/notifications", json={"enabled": False})
        assert muted.json()["notifications_muted_at"] is not None
        listed = (await user_client.get("/api/repositories/muted")).json()
        assert [repository["id"] for repository in listed] == [10]

        await user_client.put("/api/repositories/10/notifications", json={"enabled": True})
        assert (await user_client.get("/api/repositories/muted")).json() == []

    async def test_muted_repositories_stay_in_the_inbox_without_a_push(
        self,
        container: Container,
        github_api: respx.MockRouter,
        user_client: AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        await sync(container, github_api)
        sent: list[PushMessage] = []

        async def record(message: PushMessage) -> int:
            sent.append(message)
            return 1

        monkeypatch.setattr(container.push, "send", record)
        await user_client.put("/api/repositories/10/notifications", json={"enabled": False})
        muted_release = FakeRelease(5, 10, "acme/app", "web@1.2.0", "2026-10-05T10:00:00Z")
        notified_release = FakeRelease(6, 20, "acme/tool", "v1.0.0", "2026-10-05T11:00:00Z")
        mock_github(github_api, [*ALL_RELEASES, muted_release, notified_release])

        await container.sync.sync()

        assert [message.title for message in sent] == ["acme/tool"]
        assert muted_release.id in await list_ids(user_client, "inbox")
