"""Inbox actions: read state and repository subscriptions.

Read state is owned by this application. Marking a release as read is mirrored to GitHub on a
best-effort basis so the github.com inbox stays tidy; GitHub has no API to mark a thread unread,
so marking as unread is local only.
"""

import asyncio
import logging
from collections.abc import Sequence

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ghr.db import utcnow
from ghr.errors import NotFoundError
from ghr.events import Event, EventBroker
from ghr.github.client import GitHubClient, GitHubError
from ghr.models import Release, Repository

logger = logging.getLogger(__name__)


class InboxService:
    def __init__(self, session: AsyncSession, github: GitHubClient, broker: EventBroker) -> None:
        self._session = session
        self._github = github
        self._broker = broker

    async def mark_read(self, release_id: int) -> None:
        """Mark a release and all older unread releases of its repository as read."""
        release = await self._get_release(release_id)
        unread = await self._session.scalars(
            select(Release).where(
                Release.repository_id == release.repository_id,
                Release.read_at.is_(None),
                Release.published_at <= release.published_at,
            )
        )
        await self._mark_read(unread.all())

    async def mark_unread(self, release_id: int) -> None:
        release = await self._get_release(release_id)
        release.read_at = None
        await self._session.commit()
        self._broker.publish(Event("releases-changed"))

    async def unsubscribe(self, repository_id: int) -> None:
        """Stop watching the repository on GitHub and clear its releases from the inbox."""
        repository = await self._session.get(Repository, repository_id)
        if repository is None:
            raise NotFoundError("Repository", repository_id)

        await self._github.unwatch_repository(repository.full_name)
        repository.unsubscribed_at = utcnow()
        unread = await self._session.scalars(
            select(Release).where(Release.repository_id == repository_id, Release.read_at.is_(None))
        )
        await self._mark_read(unread.all())

    async def _mark_read(self, releases: Sequence[Release]) -> None:
        now = utcnow()
        for release in releases:
            release.read_at = now
        await self._session.commit()
        self._broker.publish(Event("releases-changed"))
        await self._mirror_read_to_github([release.thread_id for release in releases])

    async def _mirror_read_to_github(self, thread_ids: Sequence[str]) -> None:
        results = await asyncio.gather(
            *(self._github.mark_thread_read(thread_id) for thread_id in thread_ids),
            return_exceptions=True,
        )
        for thread_id, result in zip(thread_ids, results, strict=True):
            if isinstance(result, GitHubError | httpx.HTTPError):
                logger.warning("Could not mark thread %s as read on GitHub: %s", thread_id, result)
            elif isinstance(result, BaseException):
                raise result

    async def _get_release(self, release_id: int) -> Release:
        release = await self._session.get(Release, release_id)
        if release is None:
            raise NotFoundError("Release", release_id)
        return release
