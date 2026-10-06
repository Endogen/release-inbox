"""Brings snoozed releases back to the inbox when their time is up."""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from ghr.db import utcnow
from ghr.events import Event, EventBroker
from ghr.models import Release
from ghr.services.notifications import Notifier

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
            due = list(
                await session.scalars(
                    select(Release)
                    .options(selectinload(Release.repository))
                    .where(Release.snoozed_until <= utcnow())
                    .order_by(Release.published_at.desc())
                )
            )
            for release in due:
                release.snoozed_until = None
            await session.commit()

        if not due:
            return 0
        logger.info("%d snoozed releases are back in the inbox", len(due))
        self._broker.publish(Event("releases-changed"))
        # Remind once per repository, about its newest release.
        newest_per_repository = {release.repository_id: release for release in reversed(due)}
        unread = [release for release in newest_per_repository.values() if release.read_at is None]
        await self._notifier.announce_snooze_ended(
            sorted(unread, key=lambda release: release.published_at, reverse=True)
        )
        return len(due)
