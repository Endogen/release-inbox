"""In-process publish/subscribe used to stream live updates to connected browsers."""

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import Any, Literal

logger = logging.getLogger(__name__)

EventType = Literal["releases-changed", "sync-status"]

_QUEUE_SIZE = 32


@dataclass(frozen=True, slots=True)
class Event:
    type: EventType
    data: dict[str, Any] = field(default_factory=dict)


class EventBroker:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[Event]] = set()

    @asynccontextmanager
    async def subscribe(self) -> AsyncIterator[asyncio.Queue[Event]]:
        queue: asyncio.Queue[Event] = asyncio.Queue(maxsize=_QUEUE_SIZE)
        self._subscribers.add(queue)
        try:
            yield queue
        finally:
            self._subscribers.discard(queue)

    def publish(self, event: Event) -> None:
        for queue in self._subscribers:
            if queue.full():
                # Drop the oldest event so a stalled client still receives the latest state
                # (for example the final "sync finished" status).
                queue.get_nowait()
                logger.warning("Dropped an event for a slow subscriber")
            queue.put_nowait(event)
