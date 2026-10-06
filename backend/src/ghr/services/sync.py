"""Imports release notifications from GitHub, keeps recent releases up to date and announces
new ones.

GitHub requests are never made while a database transaction is open: SQLite allows a single
writer, and holding its lock across network calls would block the user's own actions.
"""

import asyncio
import logging
from collections.abc import Awaitable, Iterable, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from ghr.db import utcnow
from ghr.events import Event, EventBroker
from ghr.github.client import (
    NOT_MODIFIED,
    FetchedRelease,
    GitHubClient,
    GitHubError,
    NotModified,
)
from ghr.github.models import GitHubRelease, GitHubRepository, NotificationThread
from ghr.models import Release, Repository, SyncState
from ghr.schemas import SyncStatus
from ghr.services import breaking
from ghr.services.notifications import Notifier
from ghr.tasks import BackgroundTasks

logger = logging.getLogger(__name__)

_STATE_ID = 1
# Overlap between consecutive polls, so a notification created during a poll isn't missed.
_SINCE_OVERLAP = timedelta(minutes=5)
_FETCH_CONCURRENCY = 8
# Releases are fetched and stored in batches, so a long first import keeps its progress
# when it is interrupted (for example by a rate limit).
_BATCH_SIZE = 25


@dataclass(frozen=True, slots=True)
class SyncResult:
    imported: int
    poll_interval_seconds: int | None
    error: str | None = None
    #: Set when GitHub asked to wait before the next request.
    retry_after_seconds: int | None = None


class NotificationSyncService:
    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        github: GitHubClient,
        broker: EventBroker,
        notifier: Notifier,
        tasks: BackgroundTasks,
    ) -> None:
        self._session_factory = session_factory
        self._github = github
        self._broker = broker
        self._notifier = notifier
        self._tasks = tasks
        self._lock = asyncio.Lock()

    @property
    def in_progress(self) -> bool:
        return self._lock.locked()

    async def status(self) -> SyncStatus:
        async with self._session_factory() as session:
            state = await session.get(SyncState, _STATE_ID)
        return SyncStatus(
            last_synced_at=state.last_synced_at if state else None,
            last_attempt_at=state.last_attempt_at if state else None,
            last_error=state.last_error if state else None,
            in_progress=self.in_progress,
        )

    async def sync(self) -> SyncResult:
        """Import new release notifications. Concurrent calls are serialised."""
        async with self._lock:
            self._publish_status(in_progress=True)
            try:
                return await self._sync()
            finally:
                self._publish_status(in_progress=False)

    async def refresh_recent(self, *, published_within: timedelta) -> int:
        """Re-fetch recently published releases so edited notes, renames and promotions from
        pre-release to release show up. Returns the number of changed releases."""
        async with self._lock:
            try:
                return await self._refresh_recent(published_within)
            except (GitHubError, httpx.HTTPError) as error:
                logger.warning("Refreshing recent releases failed: %s", error)
                return 0

    # Notification import

    async def _sync(self) -> SyncResult:
        started_at = utcnow()
        state = await self._begin_attempt(started_at)
        try:
            result = await self._github.list_notifications(
                since=state.last_synced_at - _SINCE_OVERLAP if state.last_synced_at else None,
                if_modified_since=state.last_modified,
            )
            imported = await self._import(result.threads)
        except GitHubError as error:
            return await self._record_failure(error, retry_after=error.retry_after_seconds)
        except httpx.HTTPError as error:
            return await self._record_failure(error)
        except Exception as error:
            logger.exception("Notification sync failed unexpectedly")
            return await self._record_failure(error)

        await self._record_success(
            last_modified=result.last_modified,
            synced_at=result.server_time or started_at,
            poll_interval=result.poll_interval_seconds,
        )
        if imported:
            logger.info("Imported %d releases", len(imported))
            self._broker.publish(Event("releases-changed"))
            unread = [release.id for release in imported if release.read_at is None]
            if unread and state.last_synced_at is not None:
                # The first import announces nothing: those releases aren't new to the user.
                self._tasks.spawn(
                    self._notifier.announce_new_releases(unread), name="announce-releases"
                )
        return SyncResult(len(imported), result.poll_interval_seconds)

    async def _import(self, threads: Sequence[NotificationThread]) -> list[Release]:
        release_threads = [thread for thread in threads if thread.is_release]
        if not release_threads:
            return []
        await self._store_repositories(release_threads)
        pending = await self._unknown(release_threads)

        imported: list[Release] = []
        for start in range(0, len(pending), _BATCH_SIZE):
            batch = pending[start : start + _BATCH_SIZE]
            fetched = await self._fetch_new_releases(batch)
            imported.extend(await self._store_releases(fetched))
        return imported

    async def _store_repositories(self, threads: Iterable[NotificationThread]) -> None:
        unique = {thread.repository.id: thread.repository for thread in threads}
        async with self._session_factory() as session:
            for data in unique.values():
                await _upsert_repository(session, data)
            await session.commit()

    async def _unknown(self, threads: Sequence[NotificationThread]) -> list[NotificationThread]:
        """Threads whose release isn't stored yet."""
        ids = {thread.id: _release_id_from_api_url(thread.subject.url) for thread in threads}
        async with self._session_factory() as session:
            known = set(
                await session.scalars(
                    select(Release.id).where(Release.id.in_([i for i in ids.values() if i]))
                )
            )
        return [thread for thread in threads if ids[thread.id] not in known]

    async def _fetch_new_releases(
        self, threads: Sequence[NotificationThread]
    ) -> list[tuple[NotificationThread, FetchedRelease]]:
        async def fetch(thread: NotificationThread) -> FetchedRelease | None:
            assert thread.subject.url is not None  # guaranteed by NotificationThread.is_release
            result = await self._fetch_tolerantly(thread.subject.url)
            return None if result is NOT_MODIFIED else result

        results = await _gather_limited([fetch(thread) for thread in threads])
        return [
            (thread, result)
            for thread, result in zip(threads, results, strict=True)
            if result is not None and not result.release.draft
        ]

    async def _store_releases(
        self, fetched: Sequence[tuple[NotificationThread, FetchedRelease]]
    ) -> list[Release]:
        stored: list[Release] = []
        async with self._session_factory() as session:
            for thread, item in fetched:
                if await session.get(Release, item.release.id) is not None:
                    continue
                repository = await session.get(Repository, thread.repository.id)
                assert repository is not None  # stored by _store_repositories
                if repository.unsubscribed_at and thread.updated_at > repository.unsubscribed_at:
                    # The repository was watched again on GitHub after being unsubscribed here.
                    repository.unsubscribed_at = None
                release = _new_release(thread, item, repository)
                session.add(release)
                stored.append(release)
            await session.flush()
            await _classify(session, {release.repository_id for release in stored})
            await session.commit()
        return stored

    # Refreshing known releases

    async def _refresh_recent(self, published_within: timedelta) -> int:
        async with self._session_factory() as session:
            candidates = list(
                await session.scalars(
                    select(Release)
                    .options(selectinload(Release.repository))
                    .where(Release.published_at >= utcnow() - published_within)
                )
            )
        if not candidates:
            return 0

        results = await _gather_limited(
            [
                self._fetch_tolerantly(
                    f"/repos/{release.repository.full_name}/releases/{release.id}",
                    etag=release.etag,
                )
                for release in candidates
            ]
        )

        changed = 0
        touched: set[int] = set()
        async with self._session_factory() as session:
            for candidate, result in zip(candidates, results, strict=True):
                if result is NOT_MODIFIED:
                    continue
                release = await session.get(Release, candidate.id)
                if release is None:
                    continue
                if result is None:
                    logger.info("Release %s was deleted on GitHub", release.id)
                    await session.delete(release)
                    changed += 1
                elif _apply_changes(release, result):
                    touched.add(release.repository_id)
                    changed += 1
            await session.flush()
            await _classify(session, touched)
            await session.commit()

        if changed:
            logger.info("Refreshed %d releases", changed)
            self._broker.publish(Event("releases-changed"))
        return changed

    # Shared helpers

    async def _fetch_tolerantly(
        self, url: str, *, etag: str | None = None
    ) -> FetchedRelease | NotModified | None:
        """Fetch a release; ``None`` if it's gone or no longer accessible.

        Problems with a single release (deleted, access revoked by SSO, taken down) must not
        block the whole sync. Everything else (rate limits, outages, bad credentials) aborts
        the sync so it is retried.
        """
        try:
            return await self._github.get_release(url, etag=etag)
        except GitHubError as error:
            if error.is_resource_unavailable:
                logger.warning("Skipping release %s: %s", url, error)
                return None
            raise

    async def _begin_attempt(self, started_at: datetime) -> SyncState:
        async with self._session_factory() as session:
            state = await session.get(SyncState, _STATE_ID) or SyncState(id=_STATE_ID)
            state.last_attempt_at = started_at
            state = await session.merge(state)
            await session.commit()
            return state

    async def _record_success(
        self, *, last_modified: str | None, synced_at: datetime, poll_interval: int | None
    ) -> None:
        async with self._session_factory() as session:
            state = await session.get(SyncState, _STATE_ID)
            assert state is not None  # created by _begin_attempt
            state.last_modified = last_modified
            state.last_synced_at = synced_at
            state.last_error = None
            state.poll_interval_seconds = poll_interval
            await session.commit()

    async def _record_failure(
        self, error: Exception, *, retry_after: int | None = None
    ) -> SyncResult:
        logger.warning("Notification sync failed: %s", error)
        message = str(error) or type(error).__name__
        async with self._session_factory() as session:
            state = await session.get(SyncState, _STATE_ID)
            assert state is not None  # created by _begin_attempt
            state.last_error = message
            await session.commit()
        return SyncResult(0, None, error=message, retry_after_seconds=retry_after)

    def _publish_status(self, *, in_progress: bool) -> None:
        self._broker.publish(Event("sync-status", {"in_progress": in_progress}))


async def _gather_limited[T](awaitables: Sequence[Awaitable[T]]) -> list[T]:
    """Await with bounded concurrency; the first failure cancels the rest."""
    semaphore = asyncio.Semaphore(_FETCH_CONCURRENCY)

    async def limited(awaitable: Awaitable[T]) -> T:
        async with semaphore:
            return await awaitable

    try:
        async with asyncio.TaskGroup() as group:
            tasks = [group.create_task(limited(awaitable)) for awaitable in awaitables]
    except ExceptionGroup as errors:
        # Report the first failure; the whole sync is retried later.
        raise errors.exceptions[0] from errors
    return [task.result() for task in tasks]


async def _upsert_repository(session: AsyncSession, data: GitHubRepository) -> Repository:
    repository = await session.get(Repository, data.id)
    if repository is None or repository.full_name != data.full_name:
        # Another (renamed or deleted) repository may still hold this name.
        conflicting = await session.scalar(
            select(Repository).where(
                Repository.full_name == data.full_name, Repository.id != data.id
            )
        )
        if conflicting is not None:
            # Free the name; it is corrected when that repository shows up again.
            conflicting.full_name = f"{conflicting.full_name}#{conflicting.id}"
            await session.flush()
    if repository is None:
        repository = Repository(id=data.id)
        session.add(repository)
    repository.full_name = data.full_name
    repository.owner_login = data.owner.login
    repository.owner_avatar_url = data.owner.avatar_url
    repository.html_url = data.html_url
    repository.description = data.description
    repository.private = data.private
    return repository


async def _classify(session: AsyncSession, repository_ids: Iterable[int]) -> None:
    """Recompute ``breaking`` for all releases of the given repositories."""
    for repository_id in repository_ids:
        releases = await session.scalars(
            select(Release)
            .where(Release.repository_id == repository_id)
            .order_by(Release.published_at, Release.id)
        )
        breaking.classify(releases.all())


def _new_release(
    thread: NotificationThread, item: FetchedRelease, repository: Repository
) -> Release:
    source = item.release
    release = Release(
        id=source.id,
        repository=repository,
        thread_id=thread.id,
        published_at=source.published_at or source.created_at,
        read_at=None if thread.unread else (thread.last_read_at or thread.updated_at),
        breaking=False,
    )
    _copy_release_fields(release, source, item.etag)
    return release


def _apply_changes(release: Release, item: FetchedRelease) -> bool:
    """Update a stored release from GitHub. Returns whether anything visible changed."""
    before = (release.tag_name, release.name, release.body, release.prerelease)
    _copy_release_fields(release, item.release, item.etag)
    return before != (release.tag_name, release.name, release.body, release.prerelease)


def _copy_release_fields(release: Release, source: GitHubRelease, etag: str | None) -> None:
    release.tag_name = source.tag_name
    release.name = source.name or None
    release.body = source.body
    release.html_url = source.html_url
    release.author_login = source.author.login if source.author else None
    release.author_avatar_url = source.author.avatar_url if source.author else None
    release.prerelease = source.prerelease
    release.etag = etag


def _release_id_from_api_url(url: str | None) -> int | None:
    """Extract the id from ``https://api.github.com/repos/{owner}/{repo}/releases/{id}``."""
    if url is None:
        return None
    last_segment = url.rstrip("/").rsplit("/", 1)[-1]
    return int(last_segment) if last_segment.isdigit() else None
