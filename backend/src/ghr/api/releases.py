from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Query, status

from ghr.api.deps import InboxServiceDep, ReleaseQueriesDep
from ghr.errors import NotFoundError
from ghr.schemas import ReleaseDetail, ReleasePage, SnoozeRequest, ViewCounts
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
async def mark_read(release_id: int, inbox: InboxServiceDep, background: BackgroundTasks) -> None:
    """Mark the release and all older releases of its repository as read.

    GitHub is updated after the response is sent.
    """
    thread_ids = await inbox.mark_read(release_id)
    background.add_task(inbox.mirror_read, thread_ids)


@router.post("/{release_id}/unread", status_code=status.HTTP_204_NO_CONTENT)
async def mark_unread(release_id: int, inbox: InboxServiceDep) -> None:
    await inbox.mark_unread(release_id)


@router.post("/{release_id}/snooze", status_code=status.HTTP_204_NO_CONTENT)
async def snooze(release_id: int, payload: SnoozeRequest, inbox: InboxServiceDep) -> None:
    """Hide the repository's entry from the inbox until the given time."""
    await inbox.snooze(release_id, payload.until)


@router.delete("/{release_id}/snooze", status_code=status.HTTP_204_NO_CONTENT)
async def unsnooze(release_id: int, inbox: InboxServiceDep) -> None:
    await inbox.unsnooze(release_id)
