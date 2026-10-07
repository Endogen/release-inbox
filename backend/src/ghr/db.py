"""Database engine, session factory and shared column types."""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import DateTime, event
from sqlalchemy.engine import Dialect
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.types import TypeDecorator

from ghr.errors import NotFoundError


class Base(DeclarativeBase):
    pass


class UtcDateTime(TypeDecorator[datetime]):
    """Timezone-aware datetime stored as naive UTC (SQLite has no native timezone support)."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("Naive datetimes are not allowed; pass a timezone-aware value.")
        return value.astimezone(UTC).replace(tzinfo=None)

    def process_result_value(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        return value.replace(tzinfo=UTC) if value is not None else None


def utcnow() -> datetime:
    return datetime.now(UTC)


def create_engine(database_url: str) -> AsyncEngine:
    engine = create_async_engine(database_url)

    @event.listens_for(engine.sync_engine, "connect")
    def _configure_sqlite(dbapi_connection: Any, _: Any) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()

    return engine


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False)


async def get_existing[T](session: AsyncSession, model: type[T], ident: object, label: str) -> T:
    """The row of ``model`` with primary key ``ident``; ``NotFoundError`` if there is none."""
    row = await session.get(model, ident)
    if row is None:
        raise NotFoundError(label, ident)
    return row
