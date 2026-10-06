"""Error handling of the GitHub client."""

import time
from collections.abc import AsyncIterator

import pytest
import respx
from httpx import Response

from ghr.github.client import GitHubClient, GitHubError
from tests.conftest import GITHUB_API


@pytest.fixture
async def github() -> AsyncIterator[GitHubClient]:
    client = GitHubClient("token", GITHUB_API)
    yield client
    await client.aclose()


@pytest.mark.parametrize(
    ("response", "retry_after"),
    [
        (
            Response(403, json={"message": "secondary rate limit"}, headers={"Retry-After": "30"}),
            30,
        ),
        (Response(429, json={"message": "too many"}), 60),
        (Response(403, json={"message": "API rate limit exceeded"}), 60),
        (Response(403, json={"message": "Resource protected by SAML enforcement"}), None),
        (Response(500, json={"message": "server error"}, headers={"Retry-After": "30"}), None),
    ],
)
async def test_detects_rate_limits(
    github: GitHubClient, github_api: respx.MockRouter, response: Response, retry_after: int | None
) -> None:
    github_api.get("/repositories/1/readme").mock(return_value=response)

    with pytest.raises(GitHubError) as raised:
        await github.get_readme(1, etag=None)

    assert raised.value.retry_after_seconds == retry_after
    expected_unavailable = response.status_code == 403 and retry_after is None
    assert raised.value.is_resource_unavailable is expected_unavailable


async def test_waits_until_the_rate_limit_resets(
    github: GitHubClient, github_api: respx.MockRouter
) -> None:
    reset = int(time.time()) + 90
    github_api.get("/repositories/1/readme").mock(
        return_value=Response(
            403,
            json={"message": "Forbidden"},
            headers={"X-RateLimit-Remaining": "0", "X-RateLimit-Reset": str(reset)},
        )
    )

    with pytest.raises(GitHubError) as raised:
        await github.get_readme(1, etag=None)

    assert raised.value.retry_after_seconds is not None
    assert 85 <= raised.value.retry_after_seconds <= 91
