from fastapi import APIRouter

from ghr.api.deps import ContainerDep
from ghr.schemas import SyncStatus

router = APIRouter(prefix="/sync", tags=["sync"])


@router.get("")
async def get_sync_status(container: ContainerDep) -> SyncStatus:
    return await container.sync.status()


@router.post("")
async def sync_now(container: ContainerDep) -> SyncStatus:
    """Poll GitHub immediately instead of waiting for the next scheduled run."""
    await container.sync.sync()
    return await container.sync.status()
