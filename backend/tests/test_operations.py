"""Scheduler behaviour, the backup command and the migrations."""

import asyncio
import sqlite3
from contextlib import closing
from datetime import timedelta
from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from httpx import AsyncClient
from sqlalchemy import create_engine
from typer.testing import CliRunner

from ghr import models  # noqa: F401  # registers all tables
from ghr.cli import alembic_config, cli
from ghr.db import Base, utcnow
from ghr.scheduler import SyncScheduler
from ghr.services.sync import RefreshResult, SyncResult
from tests.conftest import make_settings, migrate


class FakeSync:
    def __init__(self, result: SyncResult, refresh: RefreshResult | None = None) -> None:
        self.result = result
        self.refresh = refresh or RefreshResult(0)
        self.syncs = 0
        self.refreshes = 0
        #: Set to make syncs wait until it is set.
        self.release: asyncio.Event | None = None

    async def sync(self) -> SyncResult:
        self.syncs += 1
        if self.release is not None:
            await self.release.wait()
        return self.result

    async def refresh_recent(self, *, published_within: timedelta) -> RefreshResult:
        self.refreshes += 1
        return self.refresh


class FakeSnoozes:
    async def wake_due(self) -> int:
        return 0


def scheduler(
    result: SyncResult, refresh: RefreshResult | None = None
) -> tuple[SyncScheduler, FakeSync]:
    sync = FakeSync(result, refresh)
    instance = SyncScheduler(
        sync,  # type: ignore[arg-type]
        FakeSnoozes(),  # type: ignore[arg-type]
        min_interval_seconds=60,
        refresh_interval_seconds=1800,
        refresh_window=timedelta(days=14),
    )
    return instance, sync


class TestScheduler:
    async def test_waits_as_long_as_github_asks_and_refreshes_when_due(self) -> None:
        instance, sync = scheduler(SyncResult(0, poll_interval_seconds=90))

        assert await instance.run_once() == 90
        assert await instance.run_once() == 90
        # Refreshes run on their own, much slower cadence.
        assert sync.refreshes == 1

    async def test_backs_off_after_a_rate_limit(self) -> None:
        instance, sync = scheduler(SyncResult(0, None, error="limited", retry_after_seconds=600))

        assert await instance.run_once() == 600
        assert instance.backing_off
        assert instance.backoff_until is not None
        assert 590 < (instance.backoff_until - utcnow()).total_seconds() <= 600
        assert sync.refreshes == 0
        # A manual sync during the backoff waits for it to end.
        assert instance.request_sync() is False

    async def test_requested_syncs_run_without_waiting_for_the_interval(self) -> None:
        instance, sync = scheduler(SyncResult(0, poll_interval_seconds=3600))
        instance.start()
        try:
            await asyncio.sleep(0.05)
            assert instance.request_sync() is True
            await asyncio.sleep(0.05)
        finally:
            await instance.stop()

        assert sync.syncs == 2

    async def test_backs_off_after_a_rate_limit_while_refreshing(self) -> None:
        instance, _ = scheduler(
            SyncResult(0, poll_interval_seconds=60), RefreshResult(0, retry_after_seconds=900)
        )

        assert await instance.run_once() == 900
        assert instance.backing_off

    async def test_a_sync_requested_during_a_sync_runs_afterwards(self) -> None:
        instance, sync = scheduler(SyncResult(0, poll_interval_seconds=3600))
        sync.release = asyncio.Event()
        instance.start()
        try:
            await asyncio.sleep(0.05)
            instance.request_sync()  # while the first sync is still running
            sync.release.set()
            await asyncio.sleep(0.05)
        finally:
            await instance.stop()

        assert sync.syncs == 2

    async def test_sync_now_is_reported_as_running(self, user_client: AsyncClient) -> None:
        response = await user_client.post("/api/sync")

        assert response.status_code == 202
        assert response.json()["in_progress"] is True
        assert response.json()["rate_limited_until"] is None

    async def test_keeps_running_when_a_sync_fails(self) -> None:
        instance, sync = scheduler(SyncResult(0, None))

        async def broken() -> SyncResult:
            raise RuntimeError("boom")

        sync.sync = broken  # type: ignore[method-assign]

        assert await instance.run_once() == 60


def test_backup_writes_a_copy_and_prunes_old_ones(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    settings = make_settings(tmp_path)
    asyncio.run(migrate(settings))
    monkeypatch.setattr("ghr.cli.get_settings", lambda: settings)
    backups = tmp_path / "backups"
    backups.mkdir()
    for index in range(3):
        (backups / f"ghr-2020010{index}T000000Z.db").write_bytes(b"old")

    result = CliRunner().invoke(cli, ["backup", str(backups), "--keep", "2"])

    assert result.exit_code == 0, result.output
    remaining = sorted(path.name for path in backups.iterdir())
    assert len(remaining) == 2
    assert remaining[0] == "ghr-20200102T000000Z.db"
    with closing(sqlite3.connect(backups / remaining[1])) as connection:
        tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master")}
    assert "releases" in tables


def test_migrations_match_the_models_and_downgrade_cleanly(tmp_path: Path) -> None:
    url = make_settings(tmp_path).sync_database_url
    command.upgrade(alembic_config(url), "head")

    engine = create_engine(url)
    with engine.connect() as connection:
        differences = compare_metadata(MigrationContext.configure(connection), Base.metadata)
    engine.dispose()
    assert differences == []

    command.downgrade(alembic_config(url), "base")
    command.upgrade(alembic_config(url), "head")
