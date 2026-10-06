from fastapi import APIRouter, status

from ghr.api.deps import ContainerDep
from ghr.container import Container
from ghr.schemas import SyncStatus

router = APIRouter(prefix="/sync", tags=["sync"])


async def _status(container: Container) -> SyncStatus:
    current = await container.sync.status()
    return current.model_copy(update={"rate_limited_until": container.scheduler.backoff_until})


@router.get("")
async def get_sync_status(container: ContainerDep) -> SyncStatus:
    return await _status(container)


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def sync_now(container: ContainerDep) -> SyncStatus:
    """Start a sync now instead of at the next scheduled poll.

    Returns immediately; progress arrives as ``sync-status`` events. While GitHub asked to
    wait (``rate_limited_until``), the sync starts when the wait is over.
    """
    accepted = container.scheduler.request_sync()
    current = await _status(container)
    # An accepted request starts right away, so it is reported as running already.
    return current.model_copy(update={"in_progress": current.in_progress or accepted})
