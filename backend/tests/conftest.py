from collections.abc import AsyncIterator, Iterator
from pathlib import Path

import pytest
import respx
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr

from ghr.app import create_app
from ghr.config import Settings
from ghr.container import Container
from ghr.db import Base
from ghr.security import hash_password

GITHUB_API = "https://api.github.test"
USERNAME = "admin"
PASSWORD = "correct horse battery staple"


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        github_token=SecretStr("test-token"),
        github_api_url=GITHUB_API,
        database_path=tmp_path / "test.db",
        username=USERNAME,
        password_hash=SecretStr(hash_password(PASSWORD)),
        session_secret=SecretStr("s" * 48),
        secure_cookies=False,
    )


@pytest.fixture
def github_api() -> Iterator[respx.MockRouter]:
    with respx.mock(base_url=GITHUB_API, assert_all_called=False) as router:
        yield router


@pytest.fixture
async def container(settings: Settings) -> AsyncIterator[Container]:
    container = Container.build(settings)
    async with container.engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    yield container
    await container.aclose()


@pytest.fixture
async def client(settings: Settings, container: Container) -> AsyncIterator[AsyncClient]:
    """API client without a session. The background scheduler is not started."""
    app = create_app(settings)
    app.state.container = container
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


@pytest.fixture
async def user_client(client: AsyncClient) -> AsyncClient:
    """API client with a signed-in session."""
    response = await client.post(
        "/api/auth/login", json={"username": USERNAME, "password": PASSWORD}
    )
    assert response.status_code == 200
    return client
