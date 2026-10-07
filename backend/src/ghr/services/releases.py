"""Read-side queries for releases: views, counts and per-repository history."""

from datetime import datetime
from typing import TypedDict

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import contains_eager

from ghr.db import get_existing
from ghr.domain import View
from ghr.errors import NotFoundError
from ghr.models import HideRule, Release, Repository
from ghr.schemas import (
    HideRuleRef,
    ReleaseDetail,
    ReleaseListItem,
    ReleasePage,
    ReleaseRef,
    RepositoryOut,
    ViewCounts,
)
from ghr.services.filters import (
    ViewContext,
    hide_rule_match_count,
    in_view,
    is_hidden,
    matches_pattern,
    matches_search,
)
from ghr.services.preferences import load_view_context

#: Upper bound for the combined "what's new" notes of one repository.
MAX_UNREAD_RELEASES = 50


class ReleaseQueries:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_latest_per_repository(
        self, view: View, *, search: str | None, limit: int, offset: int
    ) -> ReleasePage:
        """Newest release of every repository in the view, newest first."""
        context = await load_view_context(self._session)
        filters = [in_view(view, context), matches_search(search)]

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
            _with_repository(
                select(
                    Release, is_hidden(context.prereleases).label("is_hidden"), ranked.c.group_size
                )
            )
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
        context = await load_view_context(self._session)
        return ViewCounts(**{view: await self._count(view, context, search) for view in View})

    async def count(self, view: View) -> int:
        """Number of repositories with at least one release in the view."""
        return await self._count(view, await load_view_context(self._session), search=None)

    async def _count(self, view: View, context: ViewContext, search: str | None) -> int:
        statement = (
            select(func.count(func.distinct(Release.repository_id)))
            .join(Repository)
            .where(in_view(view, context), matches_search(search))
        )
        return await self._session.scalar(statement) or 0

    async def get(self, release_id: int) -> ReleaseDetail:
        context = await load_view_context(self._session)
        row = await self._session.execute(
            _with_repository(
                select(Release, is_hidden(context.prereleases).label("is_hidden"))
            ).where(Release.id == release_id)
        )
        result = row.one_or_none()
        if result is None:
            raise NotFoundError("Release", release_id)
        release, hidden = result
        return ReleaseDetail(
            **_release_fields(release, hidden),
            body=release.body,
            hide_rules=await self._hide_rules_of(release) if hidden else [],
        )

    async def list_for_repository(self, repository_id: int) -> list[ReleaseRef]:
        """All releases of a repository, newest first."""
        await self._require_repository(repository_id)
        context = await load_view_context(self._session)
        rows = await self._session.execute(
            select(Release, is_hidden(context.prereleases).label("is_hidden"))
            .where(Release.repository_id == repository_id)
            .order_by(Release.published_at.desc(), Release.id.desc())
        )
        return [release_ref(release, hidden) for release, hidden in rows]

    async def list_unread_for_repository(
        self, repository_id: int, *, search: str | None
    ) -> list[ReleaseDetail]:
        """Unread inbox releases of a repository, newest first: what changed since the user
        last looked. With the same ``search``, these are the entry's release and its
        ``+N older``."""
        await self._require_repository(repository_id)
        context = await load_view_context(self._session)
        filters = [
            Release.repository_id == repository_id,
            in_view(View.INBOX, context),
            matches_search(search),
        ]
        rows = await self._session.execute(
            _with_repository(select(Release))
            .where(*filters)
            .order_by(Release.published_at.desc(), Release.id.desc())
            .limit(MAX_UNREAD_RELEASES)
        )
        return [
            ReleaseDetail(
                **_release_fields(release, hidden=False), body=release.body, hide_rules=[]
            )
            for release in rows.scalars()
        ]

    async def _hide_rules_of(self, release: Release) -> list[HideRuleRef]:
        """The rules of the release's repository that match it."""
        rows = await self._session.execute(
            select(
                HideRule.id,
                HideRule.pattern,
                hide_rule_match_count(HideRule.repository_id, HideRule.pattern),
            )
            .join(Release, Release.repository_id == HideRule.repository_id)
            .where(Release.id == release.id, matches_pattern(HideRule.pattern))
            .order_by(HideRule.pattern)
        )
        return [
            HideRuleRef(id=rule_id, pattern=pattern, match_count=count)
            for rule_id, pattern, count in rows
        ]

    async def _require_repository(self, repository_id: int) -> None:
        await get_existing(self._session, Repository, repository_id, "Repository")


def release_ref(release: Release, hidden: bool) -> ReleaseRef:
    return ReleaseRef(
        id=release.id,
        tag_name=release.tag_name,
        name=release.name,
        published_at=release.published_at,
        read_at=release.read_at,
        is_hidden=hidden,
    )


def _with_repository[*Ts](statement: Select[*Ts]) -> Select[*Ts]:
    """Load each release's repository with the same query."""
    return statement.join(Release.repository).options(contains_eager(Release.repository))


class _ReleaseFields(TypedDict):
    """The fields of ``ReleaseOut``."""

    id: int
    tag_name: str
    name: str | None
    html_url: str
    author_login: str | None
    author_avatar_url: str | None
    prerelease: bool
    breaking: bool
    published_at: datetime
    read_at: datetime | None
    snoozed_until: datetime | None
    is_hidden: bool
    repository: RepositoryOut


def _release_fields(release: Release, hidden: bool) -> _ReleaseFields:
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
