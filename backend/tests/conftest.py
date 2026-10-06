import asyncio
from collections.abc import AsyncIterator, Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
import respx
from alembic import command
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr

from ghr.app import create_app
from ghr.cli import alembic_config
from ghr.config import Settings
from ghr.container import Container
from ghr.security import hash_password
from ghr.services.notifications import Notification

GITHUB_API = "https://api.github.test"
USERNAME = "admin"
PASSWORD = "correct horse battery staple"


def make_settings(tmp_path: Path, **overrides: object) -> Settings:
    values: dict[str, object] = {
        "github_token": SecretStr("test-token"),
        "github_api_url": GITHUB_API,
        "database_path": tmp_path / "test.db",
        "username": USERNAME,
        "password_hash": SecretStr(hash_password(PASSWORD)),
        "session_secret": SecretStr("s" * 48),
        "secure_cookies": False,
    }
    values.update(overrides)
    # Never read a developer's local .env during tests.
    return Settings(_env_file=None, **values)  # type: ignore[arg-type, call-arg]


def timestamp(*, days_ago: float = 0) -> str:
    """An ISO timestamp relative to now, as GitHub sends them."""
    return (datetime.now(UTC) - timedelta(days=days_ago)).strftime("%Y-%m-%dT%H:%M:%SZ")


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return make_settings(tmp_path)


@pytest.fixture
def github_api() -> Iterator[respx.MockRouter]:
    with respx.mock(base_url=GITHUB_API, assert_all_called=False) as router:
        yield router


async def migrate(settings: Settings) -> None:
    """Create the schema with the real migrations, so models and migrations can't drift."""
    await asyncio.to_thread(command.upgrade, alembic_config(settings.sync_database_url), "head")


@pytest.fixture
async def container(settings: Settings) -> AsyncIterator[Container]:
    await migrate(settings)
    container = Container.build(settings)
    yield container
    await container.aclose()


class SentNotifications(list[Notification]):
    """Notifications sent through the notifier during a test."""


@pytest.fixture
def sent(container: Container, monkeypatch: pytest.MonkeyPatch) -> SentNotifications:
    recorded = SentNotifications()

    async def record(notification: Notification) -> dict[str, bool]:
        recorded.append(notification)
        return {"test": True}

    monkeypatch.setattr(container.notifier, "send", record)
    return recorded


def build_client(settings: Settings, container: Container) -> AsyncClient:
    """API client for an app around ``container``; its background loops are not started."""
    app = create_app(settings)
    app.state.container = container
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture
async def client(settings: Settings, container: Container) -> AsyncIterator[AsyncClient]:
    async with build_client(settings, container) as client:
        yield client


async def sign_in(client: AsyncClient) -> None:
    response = await client.post(
        "/api/auth/login", json={"username": USERNAME, "password": PASSWORD}
    )
    assert response.status_code == 200, response.text


@pytest.fixture
async def user_client(client: AsyncClient) -> AsyncClient:
    """API client with a signed-in session."""
    await sign_in(client)
    return client


async def list_ids(client: AsyncClient, view: str, **params: str) -> list[int]:
    """Ids of the entries a view lists, in order."""
    response = await client.get("/api/releases", params={"view": view, **params})
    assert response.status_code == 200, response.text
    return [item["id"] for item in response.json()["items"]]
