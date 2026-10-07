"""Sign-in, sessions and the request-level protections."""

import asyncio
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import AsyncExitStack
from pathlib import Path

import pytest
from httpx import AsyncClient
from pydantic import SecretStr

from ghr.config import Settings
from ghr.security import LoginThrottle, hash_password, is_same_origin_request
from tests.conftest import (
    PASSWORD,
    USERNAME,
    build_client,
    make_settings,
    running_container,
    sign_in,
)

type ClientFactory = Callable[[Settings], Awaitable[AsyncClient]]


@pytest.fixture
async def client_for(tmp_path: Path) -> AsyncIterator[ClientFactory]:
    """Clients for apps with custom settings; all share the test database."""
    async with AsyncExitStack() as stack:

        async def create(settings: Settings) -> AsyncClient:
            container = await stack.enter_async_context(running_container(settings))
            return await stack.enter_async_context(build_client(settings, container))

        yield create


class TestSession:
    async def test_requires_a_session(self, client: AsyncClient) -> None:
        assert (await client.get("/api/releases")).status_code == 401

    async def test_rejects_wrong_password(self, client: AsyncClient) -> None:
        response = await client.post(
            "/api/auth/login", json={"username": USERNAME, "password": "wrong"}
        )
        assert response.status_code == 401

    async def test_sign_in_and_out(self, client: AsyncClient) -> None:
        await sign_in(client)
        assert (await client.get("/api/auth/me")).json() == {"username": USERNAME}

        await client.post("/api/auth/logout")

        assert (await client.get("/api/auth/me")).status_code == 401

    async def test_changing_the_password_signs_out_existing_sessions(
        self, tmp_path: Path, client_for: ClientFactory
    ) -> None:
        before = await client_for(make_settings(tmp_path))
        await sign_in(before)
        after = await client_for(
            make_settings(tmp_path, password_hash=SecretStr(hash_password("new password")))
        )
        after.cookies = before.cookies

        assert (await before.get("/api/auth/me")).status_code == 200
        assert (await after.get("/api/auth/me")).status_code == 401


class TestLoginThrottle:
    async def test_blocks_after_repeated_failures(
        self, tmp_path: Path, client_for: ClientFactory
    ) -> None:
        client = await client_for(make_settings(tmp_path, login_max_failures=3))
        wrong = {"username": USERNAME, "password": "nope"}

        statuses = [
            (await client.post("/api/auth/login", json=wrong)).status_code for _ in range(4)
        ]
        blocked = await client.post(
            "/api/auth/login", json={"username": USERNAME, "password": PASSWORD}
        )

        assert statuses == [401, 401, 401, 429]
        assert blocked.status_code == 429
        assert int(blocked.headers["Retry-After"]) > 0

    async def test_parallel_guesses_are_limited_too(
        self, tmp_path: Path, client_for: ClientFactory
    ) -> None:
        client = await client_for(make_settings(tmp_path, login_max_failures=3))
        wrong = {"username": USERNAME, "password": "nope"}

        responses = await asyncio.gather(
            *(client.post("/api/auth/login", json=wrong) for _ in range(10))
        )

        assert sorted(response.status_code for response in responses) == [401] * 3 + [429] * 7

    def test_success_resets_the_counter(self) -> None:
        throttle = LoginThrottle(max_failures=2, window_seconds=60)
        throttle.record_attempt("1.2.3.4")
        throttle.reset("1.2.3.4")
        throttle.record_attempt("1.2.3.4")

        assert throttle.retry_after("1.2.3.4") is None
        assert throttle.retry_after("5.6.7.8") is None


class TestCrossSiteRequests:
    async def test_rejects_cross_site_state_changes(self, user_client: AsyncClient) -> None:
        response = await user_client.post("/api/sync", headers={"Sec-Fetch-Site": "cross-site"})
        assert response.status_code == 403

    async def test_rejects_foreign_origins(self, user_client: AsyncClient) -> None:
        response = await user_client.post(
            "/api/auth/logout", headers={"Origin": "https://evil.example"}
        )
        assert response.status_code == 403

    async def test_allows_same_origin_writes_and_any_reads(self, user_client: AsyncClient) -> None:
        read = await user_client.get("/api/auth/me", headers={"Sec-Fetch-Site": "cross-site"})
        write = await user_client.post(
            "/api/auth/logout", headers={"Sec-Fetch-Site": "same-origin"}
        )

        assert read.status_code == 200
        assert write.status_code == 204

    def test_origin_comparison(self) -> None:
        assert is_same_origin_request(
            sec_fetch_site=None, origin="https://a.example/", expected_origin="https://A.example"
        )
        assert not is_same_origin_request(
            sec_fetch_site="same-site", origin=None, expected_origin="https://a.example"
        )


async def test_api_docs_are_disabled_by_default(client: AsyncClient) -> None:
    assert (await client.get("/api/docs")).status_code == 404
    assert (await client.get("/api/openapi.json")).status_code == 404
