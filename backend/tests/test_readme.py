"""Repository READMEs and their cache."""

import asyncio
import base64
from datetime import timedelta

import respx
from httpx import AsyncClient, Response
from sqlalchemy import update

from ghr.container import Container
from ghr.db import utcnow
from ghr.models import Readme
from tests.conftest import timestamp
from tests.github_fixtures import FakeRelease, mock_github

RELEASE = FakeRelease(1, 10, "acme/app", "v1.0.0", timestamp(days_ago=1))
README = {
    "content": base64.b64encode(b"# Acme app\n\nHello").decode(),
    "html_url": "https://github.com/acme/app/blob/main/README.md",
    "download_url": "https://raw.githubusercontent.com/acme/app/main/README.md",
}


async def expire_cache(container: Container) -> None:
    async with container.session_factory() as session:
        await session.execute(update(Readme).values(fetched_at=utcnow() - timedelta(days=1)))
        await session.commit()


async def test_caches_concurrent_first_visits(
    container: Container, github_api: respx.MockRouter, user_client: AsyncClient
) -> None:
    mock_github(github_api, [RELEASE])
    await container.sync.sync()
    route = github_api.get("/repositories/10/readme").mock(
        return_value=Response(200, json=README, headers={"ETag": '"r1"'})
    )

    first, second = await asyncio.gather(
        user_client.get("/api/repositories/10/readme"),
        user_client.get("/api/repositories/10/readme"),
    )
    calls = route.call_count
    third = await user_client.get("/api/repositories/10/readme")

    assert first.status_code == second.status_code == third.status_code == 200
    assert first.json()["content"] == "# Acme app\n\nHello"
    assert route.call_count == calls  # served from the cache


async def test_revalidates_when_the_cache_is_stale(
    container: Container, github_api: respx.MockRouter, user_client: AsyncClient
) -> None:
    mock_github(github_api, [RELEASE])
    await container.sync.sync()
    route = github_api.get("/repositories/10/readme").mock(
        return_value=Response(200, json=README, headers={"ETag": '"r1"'})
    )
    await user_client.get("/api/repositories/10/readme")
    await expire_cache(container)
    route.mock(return_value=Response(304))

    response = await user_client.get("/api/repositories/10/readme")

    assert response.json()["content"] == "# Acme app\n\nHello"
    assert route.calls.last.request.headers["If-None-Match"] == '"r1"'


async def test_private_readmes_are_always_fetched_in_full(
    container: Container, github_api: respx.MockRouter, user_client: AsyncClient
) -> None:
    notification = RELEASE.notification()
    notification["repository"]["private"] = True
    github_api.get("/notifications").mock(return_value=Response(200, json=[notification]))
    github_api.get(RELEASE.api_url).mock(return_value=Response(200, json=RELEASE.release()))
    await container.sync.sync()
    route = github_api.get("/repositories/10/readme").mock(
        return_value=Response(200, json=README, headers={"ETag": '"r1"'})
    )
    await user_client.get("/api/repositories/10/readme")
    await expire_cache(container)

    await user_client.get("/api/repositories/10/readme")

    # A 304 would keep an expired image token in download_url.
    assert "If-None-Match" not in route.calls.last.request.headers


async def test_missing_readme(
    container: Container, github_api: respx.MockRouter, user_client: AsyncClient
) -> None:
    mock_github(github_api, [RELEASE])
    await container.sync.sync()
    github_api.get("/repositories/10/readme").mock(return_value=Response(404))

    assert (await user_client.get("/api/repositories/10/readme")).status_code == 404
