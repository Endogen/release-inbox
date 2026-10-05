"""ORM models."""

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ghr.db import Base, UtcDateTime, utcnow


class Repository(Base):
    __tablename__ = "repositories"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    full_name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    owner_login: Mapped[str] = mapped_column(String(255))
    owner_avatar_url: Mapped[str] = mapped_column(String(1024))
    html_url: Mapped[str] = mapped_column(String(1024))
    description: Mapped[str | None] = mapped_column(Text)
    private: Mapped[bool] = mapped_column(Boolean, default=False)
    unsubscribed_at: Mapped[datetime | None] = mapped_column(UtcDateTime)

    releases: Mapped[list["Release"]] = relationship(
        back_populates="repository", cascade="all, delete-orphan", passive_deletes=True
    )
    hide_rules: Mapped[list["HideRule"]] = relationship(
        back_populates="repository", cascade="all, delete-orphan", passive_deletes=True
    )


class Release(Base):
    __tablename__ = "releases"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True
    )
    thread_id: Mapped[str] = mapped_column(String(64), index=True)
    tag_name: Mapped[str] = mapped_column(String(255))
    name: Mapped[str | None] = mapped_column(String(1024))
    body: Mapped[str | None] = mapped_column(Text)
    html_url: Mapped[str] = mapped_column(String(1024))
    author_login: Mapped[str | None] = mapped_column(String(255))
    author_avatar_url: Mapped[str | None] = mapped_column(String(1024))
    prerelease: Mapped[bool] = mapped_column(Boolean, default=False)
    published_at: Mapped[datetime] = mapped_column(UtcDateTime, index=True)
    read_at: Mapped[datetime | None] = mapped_column(UtcDateTime, index=True)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utcnow)

    repository: Mapped[Repository] = relationship(back_populates="releases")


class HideRule(Base):
    """Hides releases of a repository whose name or tag matches a glob pattern."""

    __tablename__ = "hide_rules"
    __table_args__ = (UniqueConstraint("repository_id", "pattern"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True
    )
    pattern: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utcnow)

    repository: Mapped[Repository] = relationship(back_populates="hide_rules")


class Readme(Base):
    """Cached README of a repository."""

    __tablename__ = "readmes"

    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), primary_key=True
    )
    content: Mapped[str] = mapped_column(Text)
    html_url: Mapped[str] = mapped_column(String(1024))
    download_url: Mapped[str] = mapped_column(String(1024))
    etag: Mapped[str | None] = mapped_column(String(255))
    fetched_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utcnow)


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    endpoint: Mapped[str] = mapped_column(String(2048), unique=True)
    p256dh: Mapped[str] = mapped_column(String(255))
    auth: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utcnow)


class SyncState(Base):
    """Single-row table holding the notification polling state."""

    __tablename__ = "sync_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    last_modified: Mapped[str | None] = mapped_column(String(64))
    last_synced_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    last_attempt_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    last_error: Mapped[str | None] = mapped_column(Text)
    poll_interval_seconds: Mapped[int | None] = mapped_column(Integer)
