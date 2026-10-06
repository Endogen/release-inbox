"""Long-lived application components, created once per process."""

from dataclasses import dataclass
from datetime import timedelta

import httpx
from pydantic import SecretStr
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from ghr.config import Settings
from ghr.db import create_engine, create_session_factory
from ghr.events import EventBroker
from ghr.github.client import GitHubClient
from ghr.scheduler import SyncScheduler
from ghr.security import LoginThrottle
from ghr.services.notifications import Notifier
from ghr.services.notifications.ntfy import NtfyChannel
from ghr.services.notifications.telegram import TelegramChannel
from ghr.services.notifications.web_push import WebPushChannel
from ghr.services.snooze import SnoozeWaker
from ghr.services.summaries import ClaudeSummarizer, Summarizer
from ghr.services.sync import NotificationSyncService
from ghr.tasks import BackgroundTasks

_OUTBOUND_TIMEOUT_SECONDS = 10.0


@dataclass(frozen=True, slots=True)
class Container:
    settings: Settings
    engine: AsyncEngine
    session_factory: async_sessionmaker[AsyncSession]
    github: GitHubClient
    outbound_http: httpx.AsyncClient
    broker: EventBroker
    tasks: BackgroundTasks
    web_push: WebPushChannel
    notifier: Notifier
    sync: NotificationSyncService
    snoozes: SnoozeWaker
    scheduler: SyncScheduler
    summarizer: Summarizer | None
    login_throttle: LoginThrottle

    @classmethod
    def build(cls, settings: Settings) -> "Container":
        engine = create_engine(settings.database_url)
        session_factory = create_session_factory(engine)
        github = GitHubClient(settings.github_token.get_secret_value(), settings.github_api_url)
        outbound_http = httpx.AsyncClient(timeout=_OUTBOUND_TIMEOUT_SECONDS)
        broker = EventBroker()
        tasks = BackgroundTasks()

        web_push = WebPushChannel(
            session_factory,
            private_key=_secret(settings.vapid_private_key),
            subject=settings.vapid_subject,
        )
        notifier = Notifier(
            session_factory,
            [
                web_push,
                NtfyChannel(
                    outbound_http,
                    topic_url=settings.ntfy_url,
                    token=_secret(settings.ntfy_token),
                    public_url=settings.public_url,
                ),
                TelegramChannel(
                    outbound_http,
                    bot_token=_secret(settings.telegram_bot_token),
                    chat_id=settings.telegram_chat_id,
                    public_url=settings.public_url,
                ),
            ],
        )
        sync = NotificationSyncService(session_factory, github, broker, notifier, tasks)
        snoozes = SnoozeWaker(session_factory, broker, notifier)
        scheduler = SyncScheduler(
            sync,
            snoozes,
            min_interval_seconds=settings.poll_interval_seconds,
            refresh_interval_seconds=settings.release_refresh_interval_seconds,
            refresh_window=timedelta(days=settings.release_refresh_days),
        )
        api_key = _secret(settings.anthropic_api_key)
        summarizer = (
            ClaudeSummarizer(api_key=api_key, model=settings.anthropic_model) if api_key else None
        )
        return cls(
            settings=settings,
            engine=engine,
            session_factory=session_factory,
            github=github,
            outbound_http=outbound_http,
            broker=broker,
            tasks=tasks,
            web_push=web_push,
            notifier=notifier,
            sync=sync,
            snoozes=snoozes,
            scheduler=scheduler,
            summarizer=summarizer,
            login_throttle=LoginThrottle(
                max_failures=settings.login_max_failures,
                window_seconds=settings.login_window_seconds,
            ),
        )

    async def aclose(self) -> None:
        await self.scheduler.stop()
        await self.tasks.aclose()
        if self.summarizer is not None:
            await self.summarizer.aclose()
        await self.outbound_http.aclose()
        await self.github.aclose()
        await self.engine.dispose()


def _secret(value: SecretStr | None) -> str | None:
    return value.get_secret_value() if value is not None else None
