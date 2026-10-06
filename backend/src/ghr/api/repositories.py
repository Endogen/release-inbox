from fastapi import APIRouter, status

from ghr.api.deps import (
    InboxServiceDep,
    ReadmeServiceDep,
    ReleaseQueriesDep,
    RepositoryServiceDep,
)
from ghr.schemas import ReadmeOut, ReleaseRef, RepositoryNotificationsUpdate, RepositoryOut

router = APIRouter(prefix="/repositories", tags=["repositories"])


@router.get("/muted")
async def list_muted_repositories(repositories: RepositoryServiceDep) -> list[RepositoryOut]:
    """Repositories whose new releases don't trigger push notifications."""
    return await repositories.list_muted()


@router.put("/{repository_id}/notifications")
async def set_repository_notifications(
    repository_id: int,
    payload: RepositoryNotificationsUpdate,
    repositories: RepositoryServiceDep,
) -> RepositoryOut:
    """Turn push notifications for the repository on or off. Doesn't change anything on GitHub."""
    return await repositories.set_notifications(repository_id, enabled=payload.enabled)


@router.get("/{repository_id}/releases")
async def list_repository_releases(
    repository_id: int, queries: ReleaseQueriesDep
) -> list[ReleaseRef]:
    return await queries.list_for_repository(repository_id)


@router.get("/{repository_id}/readme")
async def get_readme(repository_id: int, readmes: ReadmeServiceDep) -> ReadmeOut:
    return await readmes.get(repository_id)


@router.post("/{repository_id}/unsubscribe", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe(repository_id: int, inbox: InboxServiceDep) -> None:
    """Stop watching the repository on GitHub."""
    await inbox.unsubscribe(repository_id)
