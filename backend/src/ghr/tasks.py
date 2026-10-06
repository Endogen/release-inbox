"""Fire-and-forget work that must not delay a request or the sync, but is awaited on shutdown."""

import asyncio
import logging
from collections.abc import Coroutine
from typing import Any

logger = logging.getLogger(__name__)


class BackgroundTasks:
    def __init__(self) -> None:
        self._tasks: set[asyncio.Task[None]] = set()

    def spawn(self, work: Coroutine[Any, Any, None], *, name: str) -> None:
        task = asyncio.create_task(self._run(work, name), name=name)
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def wait(self) -> None:
        """Wait until all currently running tasks are done (used by tests and shutdown)."""
        while self._tasks:
            await asyncio.gather(*self._tasks)

    async def aclose(self, *, grace_period: float = 10.0) -> None:
        """Give running tasks ``grace_period`` seconds to finish, then cancel them."""
        if not self._tasks:
            return
        _, pending = await asyncio.wait(self._tasks, timeout=grace_period)
        for task in pending:
            task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)

    @staticmethod
    async def _run(work: Coroutine[Any, Any, None], name: str) -> None:
        try:
            await work
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Background task %s failed", name)
