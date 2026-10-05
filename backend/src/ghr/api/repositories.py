from fastapi import APIRouter, status

from ghr.api.deps import InboxServiceDep, ReadmeServiceDep, ReleaseQueriesDep
from ghr.schemas import ReadmeOut, ReleaseRef

router = APIRouter(prefix="/repositories", tags=["repositories"])


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
