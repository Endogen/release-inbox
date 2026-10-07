"""Hide rules: per-repository glob patterns matched against release names and tags."""

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ghr.db import get_existing
from ghr.errors import ConflictError
from ghr.events import RELEASES_CHANGED, EventBroker
from ghr.models import HideRule, Release, Repository
from ghr.schemas import HideRuleOut, HideRulePreview, RepositoryOut
from ghr.services.filters import hide_rule_match_count, is_hidden, matches_pattern
from ghr.services.preferences import load_view_context
from ghr.services.releases import release_ref

PREVIEW_LIMIT = 10


class HideRuleService:
    def __init__(self, session: AsyncSession, broker: EventBroker) -> None:
        self._session = session
        self._broker = broker

    async def create(self, repository_id: int, pattern: str) -> HideRuleOut:
        repository = await self._require_repository(repository_id)
        rule = HideRule(repository=repository, pattern=pattern)
        self._session.add(rule)
        try:
            await self._session.commit()
        except IntegrityError as error:
            await self._session.rollback()
            raise ConflictError(f"A rule for {pattern!r} already exists") from error

        self._broker.publish(RELEASES_CHANGED)
        count = await self._session.scalar(select(hide_rule_match_count(repository_id, pattern)))
        return _to_out(rule, count or 0)

    async def delete(self, rule_id: int) -> None:
        rule = await get_existing(self._session, HideRule, rule_id, "Hide rule")
        await self._session.delete(rule)
        await self._session.commit()
        self._broker.publish(RELEASES_CHANGED)

    async def preview(self, repository_id: int, pattern: str) -> HideRulePreview:
        """Releases of the repository a rule with ``pattern`` would hide."""
        await self._require_repository(repository_id)
        context = await load_view_context(self._session)
        total = await self._session.scalar(select(hide_rule_match_count(repository_id, pattern)))
        rows = await self._session.execute(
            select(Release, is_hidden(context.prereleases).label("is_hidden"))
            .where(Release.repository_id == repository_id, matches_pattern(pattern))
            .order_by(Release.published_at.desc(), Release.id.desc())
            .limit(PREVIEW_LIMIT)
        )
        matches = [release_ref(release, hidden) for release, hidden in rows]
        return HideRulePreview(total=total or 0, matches=matches)

    async def _require_repository(self, repository_id: int) -> Repository:
        return await get_existing(self._session, Repository, repository_id, "Repository")


def _to_out(rule: HideRule, match_count: int) -> HideRuleOut:
    return HideRuleOut(
        id=rule.id,
        pattern=rule.pattern,
        created_at=rule.created_at,
        repository=RepositoryOut.model_validate(rule.repository),
        match_count=match_count,
    )
