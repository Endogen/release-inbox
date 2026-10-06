from pathlib import Path

from httpx import AsyncClient
from pydantic import SecretStr

from ghr.container import Container
from ghr.security import LoginThrottle, hash_password, is_same_origin_request
from tests.conftest import PASSWORD, USERNAME, build_client, make_settings, migrate, sign_in


class TestLoginThrottle:
    async def test_blocks_after_repeated_failures(self, tmp_path: Path) -> None:
        settings = make_settings(tmp_path, login_max_failures=3)
        await migrate(settings)
        container = Container.build(settings)
        try:
            async with await build_client(settings, container) as client:
                wrong = {"username": USERNAME, "password": "nope"}
                statuses = [
                    (await client.post("/api/auth/login", json=wrong)).status_code for _ in range(4)
                ]
                blocked = await client.post(
                    "/api/auth/login", json={"username": USERNAME, "password": PASSWORD}
                )
        finally:
            await container.aclose()

        assert statuses == [401, 401, 401, 429]
        assert blocked.status_code == 429
        assert int(blocked.headers["Retry-After"]) > 0

    def test_success_resets_the_counter(self) -> None:
        throttle = LoginThrottle(max_failures=2, window_seconds=60)
        throttle.record_failure("1.2.3.4")
        throttle.reset("1.2.3.4")
        throttle.record_failure("1.2.3.4")

        assert throttle.retry_after("1.2.3.4") is None
        assert throttle.retry_after("5.6.7.8") is None


async def test_changing_the_password_signs_out_existing_sessions(tmp_path: Path) -> None:
    settings = make_settings(tmp_path)
    await migrate(settings)
    container = Container.build(settings)
    try:
        async with await build_client(settings, container) as client:
            await sign_in(client)
            assert (await client.get("/api/auth/me")).status_code == 200

            rotated = make_settings(tmp_path, password_hash=SecretStr(hash_password("new one")))
            object.__setattr__(container, "settings", rotated)

            assert (await client.get("/api/auth/me")).status_code == 401
    finally:
        await container.aclose()


class TestCrossSiteRequests:
    async def test_rejects_cross_site_state_changes(self, user_client: AsyncClient) -> None:
        response = await user_client.post("/api/sync", headers={"Sec-Fetch-Site": "cross-site"})
        assert response.status_code == 403

    async def test_rejects_foreign_origins(self, user_client: AsyncClient) -> None:
        response = await user_client.post(
            "/api/auth/logout", headers={"Origin": "https://evil.example"}
        )
        assert response.status_code == 403

    async def test_allows_same_origin_and_reads(self, user_client: AsyncClient) -> None:
        same = await user_client.post("/api/auth/logout", headers={"Sec-Fetch-Site": "same-origin"})
        read = await user_client.get("/api/auth/me", headers={"Sec-Fetch-Site": "cross-site"})

        assert same.status_code == 204
        assert read.status_code == 401  # signed out by the request above, not blocked

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
