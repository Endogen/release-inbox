"""Brings snoozed releases back to the inbox when their time is up."""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from ghr.events import RELEASES_CHANGED, EventBroker
from ghr.models import Release
from ghr.services.filters import is_hidden
from ghr.services.notifications import Notifier
from ghr.services.preferences import load_view_context

logger = logging.getLogger(__name__)


class SnoozeWaker:
    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        broker: EventBroker,
        notifier: Notifier,
    ) -> None:
        self._session_factory = session_factory
        self._broker = broker
        self._notifier = notifier

    async def wake_due(self) -> int:
        """Clear expired snoozes and remind the user. Returns the number of releases woken."""
        async with self._session_factory() as session:
            context = await load_view_context(session)
            rows = await session.execute(
                select(Release, is_hidden(context.prereleases))
                .options(selectinload(Release.repository))
                .where(Release.snoozed_until <= context.now)
                .order_by(Release.published_at.desc())
            )
            due = [(release, bool(hidden)) for release, hidden in rows]
            for release, _ in due:
                release.snoozed_until = None
            await session.commit()

        if not due:
            return 0
        logger.info("%d snoozed releases are back in the inbox", len(due))
        self._broker.publish(RELEASES_CHANGED)
        # One reminder per repository, about its newest release; hidden ones stay quiet.
        newest: dict[int, Release] = {}
        for release, hidden in due:
            if not hidden:
                newest.setdefault(release.repository_id, release)
        await self._notifier.announce_snooze_ended(list(newest.values()))
        return len(due)
