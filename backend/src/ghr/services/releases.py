"""Read-side queries for releases: views, counts and per-repository history."""

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import contains_eager

from ghr.db import utcnow
from ghr.models import Release, Repository
from ghr.schemas import (
    ReleaseDetail,
    ReleaseListItem,
    ReleasePage,
    ReleaseRef,
    RepositoryOut,
    ViewCounts,
)
from ghr.services.filters import View, ViewContext, in_view, is_hidden, matches_search
from ghr.services.preferences import load_preferences

#: Upper bound for the combined "what's new" notes of one repository.
MAX_UNREAD_RELEASES = 50


class ReleaseQueries:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_latest_per_repository(
        self, view: View, *, search: str | None, limit: int, offset: int
    ) -> ReleasePage:
        """Newest release of every repository in the view, newest first."""
        filters = [in_view(view, await self._context())]
        if (search_filter := matches_search(search)) is not None:
            filters.append(search_filter)

        ranked = (
            select(
                Release.id.label("release_id"),
                func.row_number()
                .over(
                    partition_by=Release.repository_id,
                    order_by=(Release.published_at.desc(), Release.id.desc()),
                )
                .label("position"),
                func.count().over(partition_by=Release.repository_id).label("group_size"),
            )
            .join(Repository)
            .where(*filters)
            .subquery()
        )
        latest = ranked.c.position == 1

        total = await self._session.scalar(select(func.count()).select_from(ranked).where(latest))
        rows = await self._session.execute(
            _select_with_repository(is_hidden().label("is_hidden"), ranked.c.group_size)
            .join(ranked, ranked.c.release_id == Release.id)
            .where(latest)
            .order_by(Release.published_at.desc(), Release.id.desc())
            .limit(limit)
            .offset(offset)
        )
        items = [
            ReleaseListItem(**_release_fields(release, hidden), older_count=group_size - 1)
            for release, hidden, group_size in rows
        ]
        return ReleasePage(items=items, total=total or 0)

    async def count_by_view(self, *, search: str | None) -> ViewCounts:
        """Number of repositories with at least one release in each view."""
        context = await self._context()
        search_filter = matches_search(search)
        counts: dict[View, int] = {}
        for view in View:
            statement = (
                select(func.count(func.distinct(Release.repository_id)))
                .join(Repository)
                .where(in_view(view, context))
            )
            if search_filter is not None:
                statement = statement.where(search_filter)
            counts[view] = await self._session.scalar(statement) or 0
        return ViewCounts(**counts)

    async def get(self, release_id: int) -> ReleaseDetail | None:
        row = await self._session.execute(
            _select_with_repository(is_hidden().label("is_hidden")).where(Release.id == release_id)
        )
        result = row.one_or_none()
        if result is None:
            return None
        release, hidden = result
        return ReleaseDetail(**_release_fields(release, hidden), body=release.body)

    async def list_for_repository(self, repository_id: int) -> list[ReleaseRef]:
        """All releases of a repository, newest first."""
        rows = await self._session.execute(
            select(Release, is_hidden().label("is_hidden"))
            .where(Release.repository_id == repository_id)
            .order_by(Release.published_at.desc(), Release.id.desc())
        )
        return [
            ReleaseRef(
                id=release.id,
                tag_name=release.tag_name,
                name=release.name,
                published_at=release.published_at,
                read_at=release.read_at,
                is_hidden=hidden,
            )
            for release, hidden in rows
        ]

    async def list_unread_for_repository(self, repository_id: int) -> list[ReleaseDetail]:
        """Unread releases of a repository in the inbox, newest first: what changed since the
        user last looked."""
        rows = await self._session.execute(
            _select_with_repository(is_hidden().label("is_hidden"))
            .where(
                Release.repository_id == repository_id,
                in_view(View.INBOX, await self._context()),
            )
            .order_by(Release.published_at.desc(), Release.id.desc())
            .limit(MAX_UNREAD_RELEASES)
        )
        return [
            ReleaseDetail(**_release_fields(release, hidden), body=release.body)
            for release, hidden in rows
        ]

    async def _context(self) -> ViewContext:
        preferences = await load_preferences(self._session)
        return ViewContext(now=utcnow(), include_prereleases=preferences.show_prereleases)


def _select_with_repository(*columns: object) -> Select[tuple[Release, ...]]:
    return (
        select(Release, *columns)  # type: ignore[call-overload]
        .join(Release.repository)
        .options(contains_eager(Release.repository))
    )


def _release_fields(release: Release, hidden: bool) -> dict[str, object]:
    return {
        "id": release.id,
        "tag_name": release.tag_name,
        "name": release.name,
        "html_url": release.html_url,
        "author_login": release.author_login,
        "author_avatar_url": release.author_avatar_url,
        "prerelease": release.prerelease,
        "breaking": release.breaking,
        "published_at": release.published_at,
        "read_at": release.read_at,
        "snoozed_until": release.snoozed_until,
        "is_hidden": hidden,
        "repository": RepositoryOut.model_validate(release.repository),
    }
