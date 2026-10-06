"""Hide rules: per-repository glob patterns matched against release names and tags."""

from sqlalchemy import ColumnElement, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import contains_eager

from ghr.errors import ConflictError, NotFoundError
from ghr.events import Event, EventBroker
from ghr.models import HideRule, Release, Repository
from ghr.schemas import HideRuleOut, HideRulePreview, RepositoryOut
from ghr.services.filters import is_hidden, matches_pattern
from ghr.services.preferences import load_view_context
from ghr.services.releases import release_ref

PREVIEW_LIMIT = 10


def _match_count(
    repository_id: ColumnElement[int] | int, pattern: ColumnElement[str] | str
) -> ColumnElement[int]:
    """Number of releases of the repository that the pattern matches."""
    return (
        select(func.count(Release.id))
        .where(Release.repository_id == repository_id, matches_pattern(pattern))
        .scalar_subquery()
    )


class HideRuleService:
    def __init__(self, session: AsyncSession, broker: EventBroker) -> None:
        self._session = session
        self._broker = broker

    async def list_all(self) -> list[HideRuleOut]:
        rows = await self._session.execute(
            select(HideRule, _match_count(HideRule.repository_id, HideRule.pattern))
            .join(HideRule.repository)
            .options(contains_eager(HideRule.repository))
            .order_by(Repository.full_name, HideRule.pattern)
        )
        return [_to_out(rule, count) for rule, count in rows]

    async def create(self, repository_id: int, pattern: str) -> HideRuleOut:
        repository = await self._require_repository(repository_id)
        rule = HideRule(repository=repository, pattern=pattern)
        self._session.add(rule)
        try:
            await self._session.commit()
        except IntegrityError as error:
            await self._session.rollback()
            raise ConflictError(f"A rule for {pattern!r} already exists") from error

        self._broker.publish(Event("releases-changed"))
        count = await self._session.scalar(select(_match_count(repository_id, pattern)))
        return _to_out(rule, count or 0)

    async def delete(self, rule_id: int) -> None:
        rule = await self._session.get(HideRule, rule_id)
        if rule is None:
            raise NotFoundError("Hide rule", rule_id)
        await self._session.delete(rule)
        await self._session.commit()
        self._broker.publish(Event("releases-changed"))

    async def preview(self, repository_id: int, pattern: str) -> HideRulePreview:
        """Releases of the repository a rule with ``pattern`` would hide."""
        await self._require_repository(repository_id)
        context = await load_view_context(self._session)
        total = await self._session.scalar(select(_match_count(repository_id, pattern)))
        rows = await self._session.execute(
            select(Release, is_hidden(context.prereleases).label("is_hidden"))
            .where(Release.repository_id == repository_id, matches_pattern(pattern))
            .order_by(Release.published_at.desc(), Release.id.desc())
            .limit(PREVIEW_LIMIT)
        )
        matches = [release_ref(release, hidden) for release, hidden in rows]
        return HideRulePreview(total=total or 0, matches=matches)

    async def _require_repository(self, repository_id: int) -> Repository:
        repository = await self._session.get(Repository, repository_id)
        if repository is None:
            raise NotFoundError("Repository", repository_id)
        return repository


def _to_out(rule: HideRule, match_count: int) -> HideRuleOut:
    return HideRuleOut(
        id=rule.id,
        pattern=rule.pattern,
        created_at=rule.created_at,
        repository=RepositoryOut.model_validate(rule.repository),
        match_count=match_count,
    )
