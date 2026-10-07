"""Background loops: notification polling at the interval GitHub asks for (with backoff and
on-demand syncs), periodic refreshes of recent releases, and the end of snoozes."""

import asyncio
import contextlib
import logging
import time
from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta
from typing import Protocol

from ghr.db import utcnow
from ghr.schemas import SyncStatus
from ghr.services.snooze import SnoozeWaker
from ghr.services.stars import StarCounter
from ghr.services.sync import NotificationSyncService

logger = logging.getLogger(__name__)


class _RetryHint(Protocol):
    @property
    def retry_after_seconds(self) -> int | None:
        """Set when GitHub asked to wait before the next request."""
        ...


#: How often expired snoozes are checked, independent of polling and rate limits.
SNOOZE_CHECK_SECONDS = 60


class SyncScheduler:
    def __init__(
        self,
        sync: NotificationSyncService,
        snoozes: SnoozeWaker,
        stars: StarCounter,
        *,
        min_interval_seconds: int,
        refresh_interval_seconds: int,
        refresh_window: timedelta,
    ) -> None:
        self._sync = sync
        self._snoozes = snoozes
        self._stars = stars
        self._min_interval = min_interval_seconds
        self._refresh_interval = refresh_interval_seconds
        self._refresh_window = refresh_window
        self._wake = asyncio.Event()
        #: Monotonic time before which GitHub asked not to be contacted.
        self._backoff_until = 0.0
        self._next_refresh = 0.0
        self._tasks: list[asyncio.Task[None]] = []

    def start(self) -> None:
        if not self._tasks:
            self._next_refresh = time.monotonic() + self._min_interval
            self._tasks = [
                asyncio.create_task(self._poll_loop(), name="notification-sync"),
                asyncio.create_task(self._snooze_loop(), name="snooze-wake-up"),
            ]

    async def stop(self) -> None:
        for task in self._tasks:
            task.cancel()
        for task in self._tasks:
            with contextlib.suppress(asyncio.CancelledError):
                await task
        self._tasks = []

    @property
    def backing_off(self) -> bool:
        return time.monotonic() < self._backoff_until

    @property
    def backoff_until(self) -> datetime | None:
        """When GitHub's requested wait ends, if it hasn't yet."""
        remaining = self._backoff_until - time.monotonic()
        return utcnow() + timedelta(seconds=remaining) if remaining > 0 else None

    async def status(self) -> SyncStatus:
        return await self._sync.status(rate_limited_until=self.backoff_until)

    def request_sync(self) -> bool:
        """Sync as soon as possible. Returns False if GitHub asked to wait (the sync then runs
        when the wait is over)."""
        self._wake.set()
        return not self.backing_off

    async def run_once(self) -> float:
        """Sync, and refresh recent releases when due. Returns seconds until the next sync."""
        delay: float = self._min_interval
        sync = await self._run("notification sync", self._sync.sync)
        results: list[_RetryHint | None] = [sync]
        if sync is not None:
            delay = max(delay, sync.poll_interval_seconds or 0)
        if time.monotonic() >= self._next_refresh and not self.backing_off:
            self._next_refresh = time.monotonic() + self._refresh_interval
            results.append(
                await self._run(
                    "refreshing releases",
                    lambda: self._sync.refresh_recent(published_within=self._refresh_window),
                )
            )
            if not self.backing_off:
                results.append(await self._run("refreshing star counts", self._stars.refresh_due))
        waits = (result.retry_after_seconds or 0 for result in results if result is not None)
        return max(delay, *waits)

    async def _run[R: _RetryHint](self, job: str, work: Callable[[], Awaitable[R]]) -> R | None:
        """Run a job, backing off if GitHub asked to wait. A failure is logged, not raised: one
        failed run must not stop future ones."""
        try:
            result = await work()
        except Exception:
            logger.exception("Unexpected error in %s", job)
            return None
        self._back_off(result.retry_after_seconds)
        return result

    def _back_off(self, retry_after_seconds: int | None) -> None:
        """Respect a wait GitHub asked for."""
        if retry_after_seconds is not None:
            self._backoff_until = max(self._backoff_until, time.monotonic() + retry_after_seconds)

    async def _poll_loop(self) -> None:
        while True:
            # Cleared before the run, so a sync requested while it runs triggers another one.
            self._wake.clear()
            delay = await self.run_once()
            # Sleep until the next poll, or until a sync is requested; never before a backoff
            # GitHub asked for has passed.
            with contextlib.suppress(TimeoutError):
                await asyncio.wait_for(self._wake.wait(), timeout=delay)
            if (wait := self._backoff_until - time.monotonic()) > 0:
                await asyncio.sleep(wait)

    async def _snooze_loop(self) -> None:
        while True:
            try:
                await self._snoozes.wake_due()
            except Exception:
                logger.exception("Unexpected error while ending snoozes")
            await asyncio.sleep(SNOOZE_CHECK_SECONDS)
