"""Per-repository preferences that only affect this application."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ghr.db import utcnow
from ghr.errors import NotFoundError
from ghr.events import Event, EventBroker
from ghr.models import Repository
from ghr.schemas import RepositoryOut


class RepositoryService:
    def __init__(self, session: AsyncSession, broker: EventBroker) -> None:
        self._session = session
        self._broker = broker

    async def set_notifications(self, repository_id: int, *, enabled: bool) -> RepositoryOut:
        """Turn push notifications for new releases of the repository on or off."""
        repository = await self._session.get(Repository, repository_id)
        if repository is None:
            raise NotFoundError("Repository", repository_id)

        if enabled:
            repository.notifications_muted_at = None
        elif repository.notifications_muted_at is None:
            repository.notifications_muted_at = utcnow()
        await self._session.commit()

        self._broker.publish(Event("releases-changed"))
        return RepositoryOut.model_validate(repository)

    async def list_muted(self) -> list[RepositoryOut]:
        repositories = await self._session.scalars(
            select(Repository)
            .where(Repository.notifications_muted_at.is_not(None))
            .order_by(Repository.full_name)
        )
        return [RepositoryOut.model_validate(repository) for repository in repositories]
