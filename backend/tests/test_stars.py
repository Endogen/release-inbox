"""Star counts of repositories, fetched in the background."""

from datetime import timedelta

import pytest
import respx
from httpx import AsyncClient, Response
from sqlalchemy import update

from ghr.container import Container
from ghr.db import utcnow
from ghr.models import Repository
from tests.github_fixtures import FakeRelease, mock_github

APP = FakeRelease(1, 10, "acme/app", "v1.0.0", "2026-10-01T10:00:00Z")
TOOL = FakeRelease(2, 20, "acme/tool", "v2.0.0", "2026-10-02T10:00:00Z")


@pytest.fixture
async def synced(container: Container, github_api: respx.MockRouter) -> None:
    mock_github(github_api, [APP, TOOL])
    assert (await container.sync.sync()).error is None


def repository(router: respx.MockRouter, repository_id: int) -> respx.Route:
    return router.get(f"/repositories/{repository_id}")


async def stars(client: AsyncClient) -> dict[str, int | None]:
    listed = (await client.get("/api/releases")).json()["items"]
    return {
        item["repository"]["full_name"]: item["repository"]["stargazers_count"] for item in listed
    }


async def make_stale(container: Container) -> None:
    async with container.session_factory() as session:
        await session.execute(
            update(Repository).values(stars_checked_at=utcnow() - timedelta(days=2))
        )
        await session.commit()


@pytest.mark.usefixtures("synced")
async def test_fetches_missing_counts_once(
    container: Container, github_api: respx.MockRouter, user_client: AsyncClient
) -> None:
    assert await stars(user_client) == {"acme/app": None, "acme/tool": None}
    app = repository(github_api, 10).mock(
        return_value=Response(200, json={"stargazers_count": 12_400}, headers={"ETag": '"a"'})
    )
    repository(github_api, 20).mock(return_value=Response(200, json={"stargazers_count": 7}))

    first = await container.stars.refresh_due()
    second = await container.stars.refresh_due()

    assert (first.updated, second.updated) == (2, 0)
    assert app.call_count == 1  # fresh counts aren't fetched again
    assert await stars(user_client) == {"acme/app": 12_400, "acme/tool": 7}


@pytest.mark.usefixtures("synced")
async def test_refreshes_old_counts_conditionally(
    container: Container, github_api: respx.MockRouter, user_client: AsyncClient
) -> None:
    app = repository(github_api, 10).mock(
        return_value=Response(200, json={"stargazers_count": 5}, headers={"ETag": '"a"'})
    )
    repository(github_api, 20).mock(return_value=Response(200, json={"stargazers_count": 7}))
    await container.stars.refresh_due()
    await make_stale(container)
    app.mock(return_value=Response(304))

    result = await container.stars.refresh_due()

    assert app.calls.last.request.headers["If-None-Match"] == '"a"'
    assert result.updated == 0
    assert (await stars(user_client))["acme/app"] == 5


@pytest.mark.usefixtures("synced")
async def test_gone_repositories_and_rate_limits(
    container: Container, github_api: respx.MockRouter, user_client: AsyncClient
) -> None:
    repository(github_api, 10).mock(return_value=Response(404, json={"message": "Not Found"}))
    repository(github_api, 20).mock(
        return_value=Response(
            403, json={"message": "API rate limit exceeded"}, headers={"Retry-After": "60"}
        )
    )

    result = await container.stars.refresh_due()

    assert result.retry_after_seconds == 60
    assert await stars(user_client) == {"acme/app": None, "acme/tool": None}
    # The gone repository counts as checked; the rate-limited one is tried again.
    repository(github_api, 20).mock(return_value=Response(200, json={"stargazers_count": 3}))
    assert (await container.stars.refresh_due()).updated == 1
    assert repository(github_api, 10).call_count == 1
