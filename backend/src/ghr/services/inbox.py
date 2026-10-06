"""Inbox actions: read state, snoozing and repository subscriptions.

Read state is owned by this application. Marking a release as read is mirrored to GitHub on a
best-effort basis so the github.com inbox stays tidy; GitHub has no API to mark a thread unread,
so marking as unread is local only. Mirroring runs after the response is sent (see
``mirror_read``), so the user never waits for GitHub.
"""

import asyncio
import logging
from collections.abc import Sequence
from datetime import datetime

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ghr.db import utcnow
from ghr.errors import NotFoundError
from ghr.events import Event, EventBroker
from ghr.github.client import GitHubClient, GitHubError
from ghr.models import Release, Repository

logger = logging.getLogger(__name__)

_MIRROR_CONCURRENCY = 4


class InboxService:
    def __init__(self, session: AsyncSession, github: GitHubClient, broker: EventBroker) -> None:
        self._session = session
        self._github = github
        self._broker = broker

    async def mark_read(self, release_id: int) -> list[str]:
        """Mark a release and all older unread releases of its repository as read.

        Returns the notification threads to mirror to GitHub with ``mirror_read``.
        """
        release = await self._get_release(release_id)
        return await self._mark_read(await self._older_unread(release))

    async def mark_unread(self, release_id: int) -> None:
        release = await self._get_release(release_id)
        release.read_at = None
        release.snoozed_until = None
        await self._session.commit()
        self._broker.publish(Event("releases-changed"))

    async def snooze(self, release_id: int, until: datetime) -> None:
        """Hide the repository's entry (this and older unread releases) until ``until``.

        A newer release still shows up in the inbox right away.
        """
        release = await self._get_release(release_id)
        for item in await self._older_unread(release):
            item.snoozed_until = until
        await self._session.commit()
        self._broker.publish(Event("releases-changed"))

    async def unsnooze(self, release_id: int) -> None:
        release = await self._get_release(release_id)
        snoozed = await self._session.scalars(
            select(Release).where(
                Release.repository_id == release.repository_id,
                Release.snoozed_until.is_not(None),
            )
        )
        for item in snoozed:
            item.snoozed_until = None
        await self._session.commit()
        self._broker.publish(Event("releases-changed"))

    async def unsubscribe(self, repository_id: int) -> list[str]:
        """Stop watching the repository on GitHub and clear its releases from the inbox.

        Returns the notification threads to mirror to GitHub with ``mirror_read``.
        """
        repository = await self._session.get(Repository, repository_id)
        if repository is None:
            raise NotFoundError("Repository", repository_id)

        await self._github.unwatch_repository(repository.full_name)
        repository.unsubscribed_at = utcnow()
        unread = await self._session.scalars(
            select(Release).where(Release.repository_id == repository_id, Release.read_at.is_(None))
        )
        return await self._mark_read(unread.all())

    async def mirror_read(self, thread_ids: Sequence[str]) -> None:
        """Mark notification threads as read on GitHub. Failures are logged, not raised."""
        semaphore = asyncio.Semaphore(_MIRROR_CONCURRENCY)

        async def mark(thread_id: str) -> None:
            async with semaphore:
                try:
                    await self._github.mark_thread_read(thread_id)
                except (GitHubError, httpx.HTTPError) as error:
                    logger.warning(
                        "Could not mark thread %s as read on GitHub: %s", thread_id, error
                    )

        await asyncio.gather(*(mark(thread_id) for thread_id in thread_ids))

    async def _older_unread(self, release: Release) -> Sequence[Release]:
        unread = await self._session.scalars(
            select(Release).where(
                Release.repository_id == release.repository_id,
                Release.read_at.is_(None),
                Release.published_at <= release.published_at,
            )
        )
        return unread.all()

    async def _mark_read(self, releases: Sequence[Release]) -> list[str]:
        now = utcnow()
        for release in releases:
            release.read_at = now
            release.snoozed_until = None
        await self._session.commit()
        self._broker.publish(Event("releases-changed"))
        return [release.thread_id for release in releases]

    async def _get_release(self, release_id: int) -> Release:
        release = await self._session.get(Release, release_id)
        if release is None:
            raise NotFoundError("Release", release_id)
        return release
