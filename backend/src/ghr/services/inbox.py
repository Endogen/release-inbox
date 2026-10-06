"""Inbox actions: read state, snoozing and repository subscriptions.

Actions on a repository's entry affect exactly what the user saw in the view: the release and
its ``+N older`` releases in that view. Read state is owned by this application; marking as
read is mirrored to GitHub on a best-effort basis after the response is sent (``mirror_read``).
GitHub has no API to mark a thread unread, so marking as unread is local only.
"""

import asyncio
import logging
from collections.abc import Sequence
from datetime import datetime

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ghr.db import utcnow
from ghr.domain import View
from ghr.errors import ConflictError, NotFoundError
from ghr.events import Event, EventBroker
from ghr.github.client import GitHubClient, GitHubError
from ghr.models import Release, Repository
from ghr.services.filters import ViewContext, in_view, is_hidden, matches_search
from ghr.services.preferences import load_view_context

logger = logging.getLogger(__name__)

_MIRROR_CONCURRENCY = 4


class InboxService:
    def __init__(self, session: AsyncSession, github: GitHubClient, broker: EventBroker) -> None:
        self._session = session
        self._github = github
        self._broker = broker

    async def mark_read(
        self, release_id: int, *, include_older_in: View | None, search: str | None = None
    ) -> list[str]:
        """Mark a release as read, and the older unread releases in ``include_older_in`` that
        match ``search``.

        Returns the notification threads to mirror to GitHub with ``mirror_read``.
        """
        release = await self._get_release(release_id)
        older = (
            await self._older_in_view(release, include_older_in, search) if include_older_in else []
        )
        targets = {release, *older}
        return await self._mark_read([item for item in targets if item.read_at is None])

    async def mark_unread(self, release_id: int) -> None:
        release = await self._get_release(release_id)
        release.read_at = None
        release.snoozed_until = None
        await self._commit()

    async def snooze(
        self, release_id: int, until: datetime, *, view: View, search: str | None = None
    ) -> None:
        """Hide the release and its older releases in ``view`` that match ``search`` from the
        inbox until ``until``.

        A newer release of the repository still shows up in the inbox right away.
        """
        release = await self._get_release(release_id)
        if release.read_at is not None:
            raise ConflictError("Only unread releases can be snoozed")
        context = await load_view_context(self._session)
        hidden = await self._session.scalar(
            select(is_hidden(context.prereleases)).where(Release.id == release.id)
        )
        if hidden:
            raise ConflictError("Hidden releases can't be snoozed")
        for item in {release, *await self._older_in_view(release, view, search, context)}:
            item.snoozed_until = until
        await self._commit()

    async def unsnooze(self, release_id: int) -> None:
        """Undo a snooze: every release snoozed together with this one returns."""
        release = await self._get_release(release_id)
        if release.snoozed_until is None:
            return
        together = await self._session.scalars(
            select(Release).where(
                Release.repository_id == release.repository_id,
                Release.snoozed_until == release.snoozed_until,
            )
        )
        for item in together:
            item.snoozed_until = None
        await self._commit()

    async def unsubscribe(self, repository_id: int) -> list[str]:
        """Stop watching the repository on GitHub and clear its releases from the inbox.

        Returns the notification threads to mirror to GitHub with ``mirror_read``.
        """
        repository = await self._session.get(Repository, repository_id)
        if repository is None:
            raise NotFoundError("Repository", repository_id)

        await self._github.unwatch_repository(repository_id)
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

    async def _older_in_view(
        self,
        release: Release,
        view: View,
        search: str | None,
        context: ViewContext | None = None,
    ) -> Sequence[Release]:
        """The releases an entry stands for: up to ``release``, in ``view``, matching ``search``."""
        context = context or await load_view_context(self._session)
        filters = [
            Release.repository_id == release.repository_id,
            Release.published_at <= release.published_at,
            in_view(view, context),
        ]
        if (search_filter := matches_search(search)) is not None:
            filters.append(search_filter)
        older = await self._session.scalars(select(Release).join(Repository).where(*filters))
        return older.all()

    async def _mark_read(self, releases: Sequence[Release]) -> list[str]:
        now = utcnow()
        for release in releases:
            release.read_at = now
            release.snoozed_until = None
        await self._commit()
        return [release.thread_id for release in releases]

    async def _commit(self) -> None:
        await self._session.commit()
        self._broker.publish(Event("releases-changed"))

    async def _get_release(self, release_id: int) -> Release:
        release = await self._session.get(Release, release_id)
        if release is None:
            raise NotFoundError("Release", release_id)
        return release
