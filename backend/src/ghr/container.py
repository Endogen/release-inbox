"""Long-lived application components, created once per process."""

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from ghr.config import Settings
from ghr.db import create_engine, create_session_factory
from ghr.events import EventBroker
from ghr.github.client import GitHubClient
from ghr.scheduler import SyncScheduler
from ghr.services.push import PushService
from ghr.services.sync import NotificationSyncService


@dataclass(frozen=True, slots=True)
class Container:
    settings: Settings
    engine: AsyncEngine
    session_factory: async_sessionmaker[AsyncSession]
    github: GitHubClient
    broker: EventBroker
    push: PushService
    sync: NotificationSyncService
    scheduler: SyncScheduler

    @classmethod
    def build(cls, settings: Settings) -> "Container":
        engine = create_engine(settings.database_url)
        session_factory = create_session_factory(engine)
        github = GitHubClient(settings.github_token.get_secret_value(), settings.github_api_url)
        broker = EventBroker()
        push = PushService(
            session_factory,
            private_key=(
                settings.vapid_private_key.get_secret_value()
                if settings.vapid_private_key
                else None
            ),
            subject=settings.vapid_subject,
        )
        sync = NotificationSyncService(session_factory, github, broker, push)
        scheduler = SyncScheduler(sync, settings.poll_interval_seconds)
        return cls(settings, engine, session_factory, github, broker, push, sync, scheduler)

    async def aclose(self) -> None:
        await self.scheduler.stop()
        await self.github.aclose()
        await self.engine.dispose()
