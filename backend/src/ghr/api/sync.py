from fastapi import APIRouter, status

from ghr.api.deps import ContainerDep
from ghr.schemas import SyncStatus

router = APIRouter(prefix="/sync", tags=["sync"])


@router.get("")
async def get_sync_status(container: ContainerDep) -> SyncStatus:
    return await container.scheduler.status()


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def sync_now(container: ContainerDep) -> SyncStatus:
    """Start a sync now instead of at the next scheduled poll.

    Returns immediately; progress arrives as ``sync-status`` events. While GitHub asked to
    wait (``rate_limited_until``), the sync starts when the wait is over.
    """
    accepted = container.scheduler.request_sync()
    current = await container.scheduler.status()
    # An accepted request starts right away, so it is reported as running already.
    return current.model_copy(update={"in_progress": current.in_progress or accepted})
