from typing import Annotated

from fastapi import APIRouter, Query, status

from ghr.api.deps import InboxServiceDep, ReleaseQueriesDep
from ghr.errors import NotFoundError
from ghr.schemas import ReleaseDetail, ReleasePage, ViewCounts
from ghr.services.filters import View

router = APIRouter(prefix="/releases", tags=["releases"])

SearchQuery = Annotated[str | None, Query(max_length=200, description="Search terms")]


@router.get("")
async def list_releases(
    queries: ReleaseQueriesDep,
    view: View = View.INBOX,
    q: SearchQuery = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ReleasePage:
    """The newest release of each repository in the view."""
    return await queries.list_latest_per_repository(view, search=q, limit=limit, offset=offset)


@router.get("/counts")
async def count_releases(queries: ReleaseQueriesDep, q: SearchQuery = None) -> ViewCounts:
    return await queries.count_by_view(search=q)


@router.get("/{release_id}")
async def get_release(release_id: int, queries: ReleaseQueriesDep) -> ReleaseDetail:
    release = await queries.get(release_id)
    if release is None:
        raise NotFoundError("Release", release_id)
    return release


@router.post("/{release_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(release_id: int, inbox: InboxServiceDep) -> None:
    """Mark the release and all older releases of its repository as read."""
    await inbox.mark_read(release_id)


@router.post("/{release_id}/unread", status_code=status.HTTP_204_NO_CONTENT)
async def mark_unread(release_id: int, inbox: InboxServiceDep) -> None:
    await inbox.mark_unread(release_id)
