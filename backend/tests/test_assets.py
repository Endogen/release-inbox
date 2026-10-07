"""Files attached to releases."""

import pytest
import respx
from httpx import AsyncClient, Response
from sqlalchemy import update

from ghr.container import Container
from ghr.models import Release
from tests.github_fixtures import FakeRelease, import_releases

APP = FakeRelease(
    1, 10, "acme/app", "v1.0.0", "2026-10-01T10:00:00Z", assets=("app-linux.tar.gz", "app.exe")
)
TOOL = FakeRelease(2, 20, "acme/tool", "v2.0.0", "2026-10-02T10:00:00Z")


@pytest.fixture
async def synced(container: Container, github_api: respx.MockRouter) -> None:
    await import_releases(container, github_api, [APP, TOOL])


async def forget_assets(container: Container) -> None:
    """Like releases stored before the app kept their files."""
    async with container.session_factory() as session:
        await session.execute(update(Release).values(assets=None))
        await session.commit()


@pytest.mark.usefixtures("synced")
async def test_files_are_stored_with_the_release(
    github_api: respx.MockRouter, user_client: AsyncClient
) -> None:
    calls = github_api.calls.call_count

    files = (await user_client.get(f"/api/releases/{APP.id}/assets")).json()
    none = (await user_client.get(f"/api/releases/{TOOL.id}/assets")).json()

    assert [(item["name"], item["size"]) for item in files] == [
        ("app-linux.tar.gz", 1024),
        ("app.exe", 2048),
    ]
    assert files[0]["url"] == (
        "https://github.com/acme/app/releases/download/v1.0.0/app-linux.tar.gz"
    )
    assert none == []
    assert github_api.calls.call_count == calls  # nothing fetched again


@pytest.mark.usefixtures("synced")
async def test_files_of_older_releases_are_fetched_once(
    container: Container, github_api: respx.MockRouter, user_client: AsyncClient
) -> None:
    await forget_assets(container)
    release = github_api.get(APP.refresh_url).mock(return_value=Response(200, json=APP.release()))

    first = (await user_client.get(f"/api/releases/{APP.id}/assets")).json()
    second = (await user_client.get(f"/api/releases/{APP.id}/assets")).json()

    assert [item["name"] for item in first] == ["app-linux.tar.gz", "app.exe"]
    assert second == first
    assert release.call_count == 1


@pytest.mark.usefixtures("synced")
async def test_a_deleted_release_has_no_files(
    container: Container, github_api: respx.MockRouter, user_client: AsyncClient
) -> None:
    await forget_assets(container)
    github_api.get(APP.refresh_url).mock(return_value=Response(404, json={"message": "Not Found"}))

    response = await user_client.get(f"/api/releases/{APP.id}/assets")

    assert response.json() == []
    assert (await user_client.get("/api/releases/999/assets")).status_code == 404
