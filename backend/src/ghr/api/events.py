from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import APIRouter, Query
from fastapi.sse import EventSourceResponse, ServerSentEvent

from ghr.api.deps import ContainerDep

router = APIRouter(prefix="/events", tags=["events"])

_RECONNECT_DELAY_MS = 5000


@router.get("", response_class=EventSourceResponse)
async def stream_events(
    container: ContainerDep,
    notifications: Annotated[
        bool, Query(description="Also send ``notification`` events (the desktop app)")
    ] = False,
) -> AsyncGenerator[ServerSentEvent]:
    """Live updates: ``releases-changed``, ``sync-status`` and, if asked for, ``notification``."""
    async with container.broker.subscribe(notifications=notifications) as queue:
        yield ServerSentEvent(comment="connected", retry=_RECONNECT_DELAY_MS)
        while True:
            event = await queue.get()
            yield ServerSentEvent(event=event.type, data=event.data)
