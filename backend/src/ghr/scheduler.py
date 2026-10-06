"""Background loop: polls notifications at the interval GitHub asks for, ends snoozes and
periodically refreshes recent releases."""

import asyncio
import contextlib
import logging
import time
from datetime import timedelta

from ghr.services.snooze import SnoozeWaker
from ghr.services.sync import NotificationSyncService

logger = logging.getLogger(__name__)


class SyncScheduler:
    def __init__(
        self,
        sync: NotificationSyncService,
        snoozes: SnoozeWaker,
        *,
        min_interval_seconds: int,
        refresh_interval_seconds: int,
        refresh_window: timedelta,
    ) -> None:
        self._sync = sync
        self._snoozes = snoozes
        self._min_interval = min_interval_seconds
        self._refresh_interval = refresh_interval_seconds
        self._refresh_window = refresh_window
        self._task: asyncio.Task[None] | None = None

    def start(self) -> None:
        if self._task is None:
            self._task = asyncio.create_task(self._run(), name="notification-sync")

    async def stop(self) -> None:
        if self._task is None:
            return
        self._task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await self._task
        self._task = None

    async def run_once(self, *, refresh: bool) -> int:
        """One iteration of the loop. Returns the delay before the next one, in seconds."""
        delay = self._min_interval
        rate_limited = False
        # Each step is isolated: one failing must not stop the others or future iterations.
        try:
            result = await self._sync.sync()
            delay = max(delay, result.poll_interval_seconds or 0, result.retry_after_seconds or 0)
            rate_limited = result.retry_after_seconds is not None
        except Exception:
            logger.exception("Unexpected error during notification sync")
        try:
            await self._snoozes.wake_due()
        except Exception:
            logger.exception("Unexpected error while ending snoozes")
        if refresh and not rate_limited:
            try:
                await self._sync.refresh_recent(published_within=self._refresh_window)
            except Exception:
                logger.exception("Unexpected error while refreshing releases")
        return delay

    async def _run(self) -> None:
        next_refresh = time.monotonic() + self._min_interval
        while True:
            refresh = time.monotonic() >= next_refresh
            delay = await self.run_once(refresh=refresh)
            if refresh:
                next_refresh = time.monotonic() + self._refresh_interval
            await asyncio.sleep(delay)
