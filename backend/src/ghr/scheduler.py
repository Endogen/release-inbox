"""Background task that polls GitHub notifications at the interval GitHub asks for."""

import asyncio
import contextlib
import logging

from ghr.services.sync import NotificationSyncService

logger = logging.getLogger(__name__)


class SyncScheduler:
    def __init__(self, sync: NotificationSyncService, min_interval_seconds: int) -> None:
        self._sync = sync
        self._min_interval = min_interval_seconds
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

    async def _run(self) -> None:
        while True:
            interval = self._min_interval
            try:
                result = await self._sync.sync()
                interval = max(interval, result.poll_interval_seconds or 0)
            except Exception:
                # Keep polling: one failed run must not stop future synchronisation.
                logger.exception("Unexpected error during notification sync")
            await asyncio.sleep(interval)
