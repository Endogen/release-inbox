from collections.abc import AsyncIterator

from fastapi import APIRouter
from fastapi.sse import EventSourceResponse, ServerSentEvent

from ghr.api.deps import ContainerDep

router = APIRouter(prefix="/events", tags=["events"])

_RECONNECT_DELAY_MS = 5000


@router.get("", response_class=EventSourceResponse)
async def stream_events(container: ContainerDep) -> AsyncIterator[ServerSentEvent]:
    """Live updates: ``releases-changed`` and ``sync-status``."""
    async with container.broker.subscribe() as queue:
        yield ServerSentEvent(comment="connected", retry=_RECONNECT_DELAY_MS)
        while True:
            event = await queue.get()
            yield ServerSentEvent(event=event.type, data=event.data)
