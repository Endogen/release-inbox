"""Per-repository preferences that only affect this application."""

from sqlalchemy.ext.asyncio import AsyncSession

from ghr.db import get_existing, utcnow
from ghr.events import RELEASES_CHANGED, EventBroker
from ghr.models import Repository
from ghr.schemas import RepositoryOut


class RepositoryService:
    def __init__(self, session: AsyncSession, broker: EventBroker) -> None:
        self._session = session
        self._broker = broker

    async def set_notifications(self, repository_id: int, *, enabled: bool) -> RepositoryOut:
        """Turn push notifications for new releases of the repository on or off."""
        repository = await get_existing(self._session, Repository, repository_id, "Repository")

        if enabled:
            repository.notifications_muted_at = None
        elif repository.notifications_muted_at is None:
            repository.notifications_muted_at = utcnow()
        await self._session.commit()

        self._broker.publish(RELEASES_CHANGED)
        return RepositoryOut.model_validate(repository)
