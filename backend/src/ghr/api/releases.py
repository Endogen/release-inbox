from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Query, status

from ghr.api.deps import AssetServiceDep, InboxServiceDep, ReleaseQueriesDep, SearchQuery
from ghr.domain import View
from ghr.schemas import (
    MarkReadRequest,
    ReleaseAssetOut,
    ReleaseDetail,
    ReleasePage,
    SnoozeRequest,
    ViewCounts,
)

router = APIRouter(prefix="/releases", tags=["releases"])


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
    return await queries.get(release_id)


@router.get("/{release_id}/assets")
async def list_release_assets(release_id: int, assets: AssetServiceDep) -> list[ReleaseAssetOut]:
    """Files attached to the release."""
    return await assets.list(release_id)


@router.post("/{release_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(
    release_id: int,
    payload: MarkReadRequest,
    inbox: InboxServiceDep,
    background: BackgroundTasks,
) -> None:
    """Mark the release as read, and its older releases in ``include_older_in``.

    GitHub is updated after the response is sent.
    """
    thread_ids = await inbox.mark_read(
        release_id, include_older_in=payload.include_older_in, search=payload.search
    )
    background.add_task(inbox.mirror_read, thread_ids)


@router.post("/{release_id}/unread", status_code=status.HTTP_204_NO_CONTENT)
async def mark_unread(release_id: int, inbox: InboxServiceDep) -> None:
    await inbox.mark_unread(release_id)


@router.post("/{release_id}/snooze", status_code=status.HTTP_204_NO_CONTENT)
async def snooze(release_id: int, payload: SnoozeRequest, inbox: InboxServiceDep) -> None:
    """Hide the release and its older releases in the view until the given time."""
    await inbox.snooze(release_id, payload.until, view=payload.view, search=payload.search)


@router.delete("/{release_id}/snooze", status_code=status.HTTP_204_NO_CONTENT)
async def unsnooze(release_id: int, inbox: InboxServiceDep) -> None:
    """Undo a snooze: the releases snoozed together with this one return."""
    await inbox.unsnooze(release_id)
