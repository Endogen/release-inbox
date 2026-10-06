"""Alembic environment. Runs migrations synchronously against the configured SQLite database."""

from alembic import context
from sqlalchemy import create_engine

from ghr import models  # noqa: F401  # registers all tables on Base.metadata
from ghr.config import get_settings
from ghr.db import Base


def run_migrations() -> None:
    # An explicit URL (used by the tests) takes precedence over the application settings.
    url = context.config.get_main_option("sqlalchemy.url") or get_settings().sync_database_url
    if context.is_offline_mode():
        context.configure(url=url, target_metadata=Base.metadata, render_as_batch=True)
        with context.begin_transaction():
            context.run_migrations()
        return

    engine = create_engine(url)
    with engine.connect() as connection:
        context.configure(
            connection=connection, target_metadata=Base.metadata, render_as_batch=True
        )
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


run_migrations()
