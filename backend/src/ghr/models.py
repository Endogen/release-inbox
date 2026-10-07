"""ORM models."""

from datetime import datetime
from typing import TypedDict

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ghr.db import Base, UtcDateTime, utcnow
from ghr.domain import NotifyAbout, PrereleaseMode


class StoredAsset(TypedDict):
    """A file attached to a release, as kept in ``Release.assets``.

    Separate from the API schema, so changing the API can't change what is stored.
    """

    id: int
    name: str
    size: int
    download_count: int
    url: str
    content_type: str | None


class Repository(Base):
    __tablename__ = "repositories"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    full_name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    owner_avatar_url: Mapped[str] = mapped_column(String(1024))
    html_url: Mapped[str] = mapped_column(String(1024))
    description: Mapped[str | None] = mapped_column(Text)
    private: Mapped[bool] = mapped_column(Boolean, default=False)
    unsubscribed_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    # Push notifications are on unless muted, so newly watched repositories notify by default.
    notifications_muted_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    # Not part of notifications; fetched separately (``ghr.services.stars``).
    stargazers_count: Mapped[int | None] = mapped_column(Integer)
    stars_etag: Mapped[str | None] = mapped_column(String(255))
    stars_checked_at: Mapped[datetime | None] = mapped_column(UtcDateTime)


class Release(Base):
    __tablename__ = "releases"
    __table_args__ = (
        # Newest-per-repository listing and "older unread" lookups.
        Index("ix_releases_repository_published", "repository_id", "published_at"),
        Index("ix_releases_repository_read", "repository_id", "read_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    # Indexed through ``ix_releases_repository_*`` (leading column).
    repository_id: Mapped[int] = mapped_column(ForeignKey("repositories.id", ondelete="CASCADE"))
    thread_id: Mapped[str] = mapped_column(String(64))
    tag_name: Mapped[str] = mapped_column(String(255))
    name: Mapped[str | None] = mapped_column(String(1024))
    body: Mapped[str | None] = mapped_column(Text)
    html_url: Mapped[str] = mapped_column(String(1024))
    author_login: Mapped[str | None] = mapped_column(String(255))
    author_avatar_url: Mapped[str | None] = mapped_column(String(1024))
    prerelease: Mapped[bool] = mapped_column(Boolean, default=False)
    published_at: Mapped[datetime] = mapped_column(UtcDateTime, index=True)
    read_at: Mapped[datetime | None] = mapped_column(UtcDateTime, index=True)
    #: Hidden from the inbox until this time.
    snoozed_until: Mapped[datetime | None] = mapped_column(UtcDateTime, index=True)
    #: The notes announce breaking changes, or the version is a new major version.
    breaking: Mapped[bool] = mapped_column(Boolean, default=False)
    #: ETag of the last fetch, so refreshes are conditional requests.
    etag: Mapped[str | None] = mapped_column(String(255))
    #: Attached files (``ghr.services.assets``); ``None`` until they have been fetched.
    assets: Mapped[list[StoredAsset] | None] = mapped_column(JSON)

    repository: Mapped[Repository] = relationship()


class HideRule(Base):
    """Hides releases of a repository whose name or tag matches a glob pattern."""

    __tablename__ = "hide_rules"
    __table_args__ = (UniqueConstraint("repository_id", "pattern"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Indexed through the unique constraint (leading column).
    repository_id: Mapped[int] = mapped_column(ForeignKey("repositories.id", ondelete="CASCADE"))
    pattern: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utcnow)

    repository: Mapped[Repository] = relationship()


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


class Preferences(Base):
    """Single-row table with settings the user changes in the app. The row and its defaults
    come from the migrations (0005), so the app only ever updates it."""

    __tablename__ = "preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    prereleases: Mapped[PrereleaseMode] = mapped_column(
        Enum(PrereleaseMode, native_enum=False, length=8, validate_strings=True)
    )
    notify_about: Mapped[NotifyAbout] = mapped_column(
        Enum(NotifyAbout, native_enum=False, length=8, validate_strings=True)
    )
    #: Mark a release as read when the user moves on from it.
    mark_read_after_viewing: Mapped[bool] = mapped_column(Boolean)
    #: Installed apps show the number of inbox entries on their icon.
    app_badge: Mapped[bool] = mapped_column(Boolean)


class Summary(Base):
    """Cached AI summary of one or more releases."""

    __tablename__ = "summaries"

    #: Hash of the model and the summarised release notes; changes when the notes change.
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    content: Mapped[str] = mapped_column(Text)
    model: Mapped[str] = mapped_column(String(255))


class SyncState(Base):
    """Single-row table holding the notification polling state."""

    __tablename__ = "sync_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    last_modified: Mapped[str | None] = mapped_column(String(64))
    last_synced_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    last_attempt_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    last_error: Mapped[str | None] = mapped_column(Text)
