import asyncio
import base64

import respx
from httpx import AsyncClient, Response

from ghr.container import Container
from tests.github_fixtures import FakeRelease, mock_github

RELEASE = FakeRelease(1, 10, "acme/app", "v1.0.0", "2026-10-01T10:00:00Z")
README = {
    "content": base64.b64encode(b"# Acme app\n\nHello").decode(),
    "encoding": "base64",
    "html_url": "https://github.com/acme/app/blob/main/README.md",
    "download_url": "https://raw.githubusercontent.com/acme/app/main/README.md",
}


async def test_fetches_and_caches_concurrent_first_visits(
    container: Container, github_api: respx.MockRouter, user_client: AsyncClient
) -> None:
    mock_github(github_api, [RELEASE])
    await container.sync.sync()
    route = github_api.get("/repos/acme/app/readme").mock(
        return_value=Response(200, json=README, headers={"ETag": '"r1"'})
    )

    first, second = await asyncio.gather(
        user_client.get("/api/repositories/10/readme"),
        user_client.get("/api/repositories/10/readme"),
    )

    assert first.status_code == second.status_code == 200
    assert first.json()["content"] == "# Acme app\n\nHello"
    assert first.json()["download_url"] == README["download_url"]

    # A third request within the cache time doesn't call GitHub again.
    calls = route.call_count
    await user_client.get("/api/repositories/10/readme")
    assert route.call_count == calls


async def test_missing_readme(
    container: Container, github_api: respx.MockRouter, user_client: AsyncClient
) -> None:
    mock_github(github_api, [RELEASE])
    await container.sync.sync()
    github_api.get("/repos/acme/app/readme").mock(return_value=Response(404))

    response = await user_client.get("/api/repositories/10/readme")

    assert response.status_code == 404
