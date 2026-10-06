"""Hide rules and their previews."""

import pytest
import respx
from httpx import AsyncClient

from ghr.container import Container
from tests.conftest import list_ids
from tests.github_fixtures import FakeRelease, mock_github

WEB_OLD = FakeRelease(1, 10, "acme/app", "web@1.0.0", "2026-10-01T10:00:00Z")
WEB_NEW = FakeRelease(2, 10, "acme/app", "web@1.1.0", "2026-10-03T10:00:00Z")
API = FakeRelease(3, 10, "acme/app", "api@2.0.0", "2026-10-02T10:00:00Z")


@pytest.fixture
async def synced(container: Container, github_api: respx.MockRouter) -> None:
    mock_github(github_api, [WEB_OLD, WEB_NEW, API])
    assert (await container.sync.sync()).error is None


@pytest.mark.usefixtures("synced")
async def test_preview_create_list_and_delete(user_client: AsyncClient) -> None:
    preview = await user_client.get(
        "/api/hide-rules/preview", params={"repository_id": 10, "pattern": "WEB@*"}
    )
    assert preview.json()["total"] == 2

    created = await user_client.post(
        "/api/hide-rules", json={"repository_id": 10, "pattern": "web@*"}
    )
    assert created.status_code == 201
    assert created.json()["match_count"] == 2
    assert await list_ids(user_client, "inbox") == [API.id]
    assert await list_ids(user_client, "hidden") == [WEB_NEW.id]

    listed = (await user_client.get("/api/hide-rules")).json()
    assert [(rule["pattern"], rule["match_count"]) for rule in listed] == [("web@*", 2)]

    await user_client.delete(f"/api/hide-rules/{created.json()['id']}")
    assert await list_ids(user_client, "inbox") == [WEB_NEW.id]


@pytest.mark.usefixtures("synced")
async def test_rejects_duplicates_blank_patterns_and_unknown_repositories(
    user_client: AsyncClient,
) -> None:
    rule = {"repository_id": 10, "pattern": "web@*"}

    first = await user_client.post("/api/hide-rules", json=rule)
    duplicate = await user_client.post("/api/hide-rules", json=rule)
    blank = await user_client.post("/api/hide-rules", json={"repository_id": 10, "pattern": " "})
    blank_preview = await user_client.get(
        "/api/hide-rules/preview", params={"repository_id": 10, "pattern": "  "}
    )
    unknown = await user_client.get(
        "/api/hide-rules/preview", params={"repository_id": 999, "pattern": "*"}
    )

    responses = (first, duplicate, blank, blank_preview, unknown)
    assert [response.status_code for response in responses] == [201, 409, 422, 422, 404]
