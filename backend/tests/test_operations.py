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
from sqlalchemy import create_engine
from typer.testing import CliRunner

from ghr import models  # noqa: F401  # registers all tables
from ghr.cli import alembic_config, cli
from ghr.db import Base
from ghr.scheduler import SyncScheduler
from ghr.services.sync import SyncResult
from tests.conftest import make_settings, migrate


class FakeSync:
    def __init__(self, result: SyncResult) -> None:
        self.result = result
        self.refreshes = 0

    async def sync(self) -> SyncResult:
        return self.result

    async def refresh_recent(self, *, published_within: timedelta) -> int:
        self.refreshes += 1
        return 0


class FakeSnoozes:
    def __init__(self) -> None:
        self.calls = 0

    async def wake_due(self) -> int:
        self.calls += 1
        return 0


def scheduler(result: SyncResult) -> tuple[SyncScheduler, FakeSync, FakeSnoozes]:
    sync, snoozes = FakeSync(result), FakeSnoozes()
    instance = SyncScheduler(
        sync,  # type: ignore[arg-type]
        snoozes,  # type: ignore[arg-type]
        min_interval_seconds=60,
        refresh_interval_seconds=1800,
        refresh_window=timedelta(days=14),
    )
    return instance, sync, snoozes


class TestScheduler:
    async def test_waits_as_long_as_github_asks(self) -> None:
        instance, sync, snoozes = scheduler(SyncResult(0, poll_interval_seconds=90))

        assert await instance.run_once(refresh=True) == 90
        assert (sync.refreshes, snoozes.calls) == (1, 1)

    async def test_backs_off_and_skips_refresh_when_rate_limited(self) -> None:
        instance, sync, _ = scheduler(
            SyncResult(0, None, error="rate limited", retry_after_seconds=600)
        )

        assert await instance.run_once(refresh=True) == 600
        assert sync.refreshes == 0

    async def test_keeps_running_when_a_step_fails(self) -> None:
        instance, sync, snoozes = scheduler(SyncResult(0, None))

        async def broken() -> SyncResult:
            raise RuntimeError("boom")

        sync.sync = broken  # type: ignore[method-assign]

        assert await instance.run_once(refresh=False) == 60
        assert snoozes.calls == 1


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
