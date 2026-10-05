"""Hide rules: per-repository glob patterns matched against release names and tags."""

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ghr.errors import ConflictError, NotFoundError
from ghr.events import Event, EventBroker
from ghr.models import HideRule, Release, Repository
from ghr.schemas import HideRuleOut, HideRulePreview, ReleaseRef, RepositoryOut
from ghr.services.filters import is_hidden, matches_pattern

PREVIEW_LIMIT = 10


class HideRuleService:
    def __init__(self, session: AsyncSession, broker: EventBroker) -> None:
        self._session = session
        self._broker = broker

    async def list(self) -> list[HideRuleOut]:
        rules = await self._session.scalars(
            select(HideRule)
            .options(selectinload(HideRule.repository))
            .join(HideRule.repository)
            .order_by(Repository.full_name, HideRule.pattern)
        )
        return [await self._to_out(rule) for rule in rules]

    async def create(self, repository_id: int, pattern: str) -> HideRuleOut:
        repository = await self._session.get(Repository, repository_id)
        if repository is None:
            raise NotFoundError("Repository", repository_id)

        rule = HideRule(repository=repository, pattern=pattern)
        self._session.add(rule)
        try:
            await self._session.commit()
        except IntegrityError as error:
            await self._session.rollback()
            raise ConflictError(f"A rule for {pattern!r} already exists") from error

        self._broker.publish(Event("releases-changed"))
        return await self._to_out(rule)

    async def delete(self, rule_id: int) -> None:
        rule = await self._session.get(HideRule, rule_id)
        if rule is None:
            raise NotFoundError("Hide rule", rule_id)
        await self._session.delete(rule)
        await self._session.commit()
        self._broker.publish(Event("releases-changed"))

    async def preview(self, repository_id: int, pattern: str) -> HideRulePreview:
        """Releases of the repository a rule with ``pattern`` would hide."""
        condition = (Release.repository_id == repository_id, matches_pattern(pattern))
        total = await self._session.scalar(select(func.count()).where(*condition))
        rows = await self._session.execute(
            select(Release, is_hidden().label("is_hidden"))
            .where(*condition)
            .order_by(Release.published_at.desc())
            .limit(PREVIEW_LIMIT)
        )
        matches = [
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
        return HideRulePreview(total=total or 0, matches=matches)

    async def _to_out(self, rule: HideRule) -> HideRuleOut:
        match_count = await self._session.scalar(
            select(func.count()).where(
                Release.repository_id == rule.repository_id, matches_pattern(rule.pattern)
            )
        )
        return HideRuleOut(
            id=rule.id,
            pattern=rule.pattern,
            created_at=rule.created_at,
            repository=RepositoryOut.model_validate(rule.repository),
            match_count=match_count or 0,
        )
