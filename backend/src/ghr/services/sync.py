"""Imports release notifications from GitHub and announces new releases."""

import asyncio
import logging
from dataclasses import dataclass
from datetime import timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from ghr.db import utcnow
from ghr.events import Event, EventBroker
from ghr.github.client import GitHubClient, GitHubError
from ghr.github.models import GitHubRelease, NotificationThread
from ghr.models import Release, Repository, SyncState
from ghr.schemas import SyncStatus
from ghr.services.filters import is_hidden
from ghr.services.push import PushMessage, PushService

logger = logging.getLogger(__name__)

_STATE_ID = 1
# Overlap between consecutive polls to tolerate clock skew between this host and GitHub.
_SINCE_OVERLAP = timedelta(minutes=5)
_MAX_NAMES_IN_SUMMARY = 3
_FETCH_CONCURRENCY = 8


@dataclass(frozen=True, slots=True)
class SyncResult:
    imported: int
    poll_interval_seconds: int | None
    error: str | None = None


class NotificationSyncService:
    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        github: GitHubClient,
        broker: EventBroker,
        push: PushService,
    ) -> None:
        self._session_factory = session_factory
        self._github = github
        self._broker = broker
        self._push = push
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
        """Run one synchronisation. Concurrent calls are serialised."""
        async with self._lock:
            self._publish_status(in_progress=True)
            try:
                return await self._sync()
            finally:
                self._publish_status(in_progress=False)

    async def _sync(self) -> SyncResult:
        async with self._session_factory() as session:
            state = await session.get(SyncState, _STATE_ID) or SyncState(id=_STATE_ID)
            session.add(state)
            started_at = utcnow()
            state.last_attempt_at = started_at
            is_initial_import = state.last_synced_at is None

            try:
                result = await self._github.list_notifications(
                    since=state.last_synced_at - _SINCE_OVERLAP if state.last_synced_at else None,
                    if_modified_since=state.last_modified,
                )
                imported = await self._import(session, result.threads)
            except (GitHubError, httpx.HTTPError) as error:
                await session.rollback()
                return await self._record_failure(error)

            state.last_modified = result.last_modified
            state.last_synced_at = started_at
            state.last_error = None
            state.poll_interval_seconds = result.poll_interval_seconds
            await session.commit()

            if imported:
                logger.info("Imported %d releases", len(imported))
                self._broker.publish(Event("releases-changed"))
                unread = [release for release in imported if release.read_at is None]
                if unread and not is_initial_import:
                    await self._announce(session, unread)

            return SyncResult(len(imported), result.poll_interval_seconds)

    async def _import(
        self, session: AsyncSession, threads: list[NotificationThread]
    ) -> list[Release]:
        """Store releases referenced by notification threads. Returns the newly added ones."""
        repositories: dict[int, Repository] = {}
        pending: list[NotificationThread] = []
        for thread in threads:
            if not thread.is_release:
                continue
            repositories[thread.repository.id] = await self._upsert_repository(session, thread)
            known_id = _release_id_from_api_url(thread.subject.url)
            if known_id is None or await session.get(Release, known_id) is None:
                pending.append(thread)

        imported: list[Release] = []
        for thread, github_release in await self._fetch_releases(pending):
            if github_release is None or github_release.draft:
                continue
            if await session.get(Release, github_release.id) is not None:
                continue
            repository = repositories[thread.repository.id]
            if repository.unsubscribed_at and thread.updated_at > repository.unsubscribed_at:
                # The repository was watched again on GitHub after being unsubscribed here.
                repository.unsubscribed_at = None
            release = _build_release(thread, github_release, repository)
            session.add(release)
            imported.append(release)
        await session.flush()
        return imported

    async def _fetch_releases(
        self, threads: list[NotificationThread]
    ) -> list[tuple[NotificationThread, GitHubRelease | None]]:
        semaphore = asyncio.Semaphore(_FETCH_CONCURRENCY)

        async def fetch(thread: NotificationThread) -> GitHubRelease | None:
            assert thread.subject.url is not None  # guaranteed by NotificationThread.is_release
            async with semaphore:
                return await self._github.get_release(thread.subject.url)

        try:
            async with asyncio.TaskGroup() as group:
                tasks = [group.create_task(fetch(thread)) for thread in threads]
        except ExceptionGroup as errors:
            # Report the first failure; the whole sync is retried on the next poll.
            raise errors.exceptions[0] from errors
        return [(thread, task.result()) for thread, task in zip(threads, tasks, strict=True)]

    @staticmethod
    async def _upsert_repository(session: AsyncSession, thread: NotificationThread) -> Repository:
        data = thread.repository
        repository = await session.get(Repository, data.id)
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

    async def _announce(self, session: AsyncSession, releases: list[Release]) -> None:
        visible_ids = set(
            await session.scalars(
                select(Release.id).where(
                    Release.id.in_([release.id for release in releases]), ~is_hidden()
                )
            )
        )
        visible = [release for release in releases if release.id in visible_ids]
        if visible:
            await self._push.send(_build_message(visible))

    async def _record_failure(self, error: Exception) -> SyncResult:
        logger.warning("Notification sync failed: %s", error)
        async with self._session_factory() as session:
            state = await session.get(SyncState, _STATE_ID) or SyncState(id=_STATE_ID)
            session.add(state)
            state.last_attempt_at = utcnow()
            state.last_error = str(error)
            await session.commit()
        return SyncResult(0, None, error=str(error))

    def _publish_status(self, *, in_progress: bool) -> None:
        self._broker.publish(Event("sync-status", {"in_progress": in_progress}))


def _release_id_from_api_url(url: str | None) -> int | None:
    """Extract the id from ``https://api.github.com/repos/{owner}/{repo}/releases/{id}``."""
    if url is None:
        return None
    last_segment = url.rstrip("/").rsplit("/", 1)[-1]
    return int(last_segment) if last_segment.isdigit() else None


def _build_release(
    thread: NotificationThread, github_release: GitHubRelease, repository: Repository
) -> Release:
    author = github_release.author
    return Release(
        id=github_release.id,
        repository=repository,
        thread_id=thread.id,
        tag_name=github_release.tag_name,
        name=github_release.name or None,
        body=github_release.body,
        html_url=github_release.html_url,
        author_login=author.login if author else None,
        author_avatar_url=author.avatar_url if author else None,
        prerelease=github_release.prerelease,
        published_at=github_release.published_at or github_release.created_at,
        read_at=None if thread.unread else (thread.last_read_at or thread.updated_at),
    )


def _build_message(releases: list[Release]) -> PushMessage:
    if len(releases) == 1:
        release = releases[0]
        return PushMessage(
            title=release.repository.full_name,
            body=f"{release.name or release.tag_name} was released",
            url=f"/inbox?release={release.id}",
            tag=f"release-{release.id}",
        )
    names = [release.repository.full_name for release in releases[:_MAX_NAMES_IN_SUMMARY]]
    remaining = len(releases) - len(names)
    summary = ", ".join(names) + (f" and {remaining} more" if remaining else "")
    return PushMessage(
        title=f"{len(releases)} new releases",
        body=summary,
        url="/inbox",
        tag="releases",
    )
