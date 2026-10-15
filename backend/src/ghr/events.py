"""In-process publish/subscribe used to stream live updates to connected browsers and to the
desktop app."""

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import Any, Literal

logger = logging.getLogger(__name__)

EventType = Literal["releases-changed", "sync-status", "notification"]

#: Only delivered to subscribers that ask for them: browser tabs show notifications through
#: Web Push, so only the desktop app subscribes to these.
_OPT_IN_EVENTS: frozenset[EventType] = frozenset({"notification"})

_QUEUE_SIZE = 32


@dataclass(frozen=True, slots=True)
class Event:
    type: EventType
    data: dict[str, Any] = field(default_factory=dict)


#: Lists, counts or details of releases changed; clients refetch them.
RELEASES_CHANGED = Event("releases-changed")


class EventBroker:
    def __init__(self) -> None:
        #: Each subscriber's queue and the opt-in event types it receives.
        self._subscribers: dict[asyncio.Queue[Event], frozenset[EventType]] = {}

    @asynccontextmanager
    async def subscribe(
        self, *, notifications: bool = False
    ) -> AsyncIterator[asyncio.Queue[Event]]:
        queue: asyncio.Queue[Event] = asyncio.Queue(maxsize=_QUEUE_SIZE)
        self._subscribers[queue] = _OPT_IN_EVENTS if notifications else frozenset()
        try:
            yield queue
        finally:
            self._subscribers.pop(queue, None)

    def publish(self, event: Event) -> int:
        """Returns the number of subscribers the event was queued for."""
        delivered = 0
        for queue, opted_in in self._subscribers.items():
            if event.type in _OPT_IN_EVENTS and event.type not in opted_in:
                continue
            if queue.full():
                # Drop the oldest event so a stalled client still receives the latest state
                # (for example the final "sync finished" status).
                queue.get_nowait()
                logger.warning("Dropped an event for a slow subscriber")
            queue.put_nowait(event)
            delivered += 1
        return delivered
