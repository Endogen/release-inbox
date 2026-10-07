from fastapi import APIRouter, BackgroundTasks, status

from ghr.api.deps import (
    InboxServiceDep,
    ReadmeServiceDep,
    ReleaseQueriesDep,
    RepositoryServiceDep,
    SearchQuery,
)
from ghr.schemas import (
    ReadmeOut,
    ReleaseDetail,
    ReleaseRef,
    RepositoryNotificationsUpdate,
    RepositoryOut,
)

router = APIRouter(prefix="/repositories", tags=["repositories"])


@router.put("/{repository_id}/notifications")
async def set_repository_notifications(
    repository_id: int,
    payload: RepositoryNotificationsUpdate,
    repositories: RepositoryServiceDep,
) -> RepositoryOut:
    """Turn notifications for the repository on or off. Doesn't change anything on GitHub."""
    return await repositories.set_notifications(repository_id, enabled=payload.enabled)


@router.get("/{repository_id}/releases")
async def list_repository_releases(
    repository_id: int, queries: ReleaseQueriesDep
) -> list[ReleaseRef]:
    return await queries.list_for_repository(repository_id)


@router.get("/{repository_id}/unread")
async def list_unread_releases(
    repository_id: int, queries: ReleaseQueriesDep, q: SearchQuery = None
) -> list[ReleaseDetail]:
    """Unread inbox releases of the repository with their notes: what's new since last read."""
    return await queries.list_unread_for_repository(repository_id, search=q)


@router.get("/{repository_id}/readme")
async def get_readme(repository_id: int, readmes: ReadmeServiceDep) -> ReadmeOut:
    return await readmes.get(repository_id)


@router.post("/{repository_id}/unsubscribe", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe(
    repository_id: int, inbox: InboxServiceDep, background: BackgroundTasks
) -> None:
    """Stop watching the repository on GitHub."""
    thread_ids = await inbox.unsubscribe(repository_id)
    background.add_task(inbox.mirror_read, thread_ids)
