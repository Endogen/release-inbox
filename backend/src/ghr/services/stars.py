"""Star counts of repositories, refreshed in the background.

Notifications only carry a minimal repository without its star count, so each repository is
fetched once and then again when its count is a day old. Conditional requests keep unchanged
repositories from counting against the rate limit.
"""

import logging
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from ghr.concurrency import gather_limited
from ghr.db import utcnow
from ghr.events import RELEASES_CHANGED, EventBroker
from ghr.github.client import GitHubClient, GitHubError, NotModified, RepositoryStars
from ghr.models import Repository

logger = logging.getLogger(__name__)

#: How old a star count may get before it is fetched again.
_MAX_AGE = timedelta(days=1)
_FETCH_CONCURRENCY = 4

type _Fetched = RepositoryStars | NotModified | None


@dataclass(frozen=True, slots=True)
class StarRefreshResult:
    updated: int
    #: Set when GitHub asked to wait before the next request.
    retry_after_seconds: int | None = None


class StarCounter:
    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        github: GitHubClient,
        broker: EventBroker,
    ) -> None:
        self._session_factory = session_factory
        self._github = github
        self._broker = broker

    async def refresh_due(self) -> StarRefreshResult:
        """Fetch the star counts that are missing or older than the maximum age.

        Counts fetched before a failure are kept; the rest are retried on the next refresh.
        """
        cutoff = utcnow() - _MAX_AGE
        async with self._session_factory() as session:
            due = (
                await session.execute(
                    select(Repository.id, Repository.stars_etag).where(
                        # Repositories the user stopped watching keep their last count.
                        Repository.unsubscribed_at.is_(None),
                        or_(
                            Repository.stars_checked_at.is_(None),
                            Repository.stars_checked_at < cutoff,
                        ),
                    )
                )
            ).all()

        fetched: dict[int, _Fetched] = {}
        retry_after: int | None = None
        try:
            await self._fetch_all(due, into=fetched)
        except GitHubError as error:
            logger.warning("Fetching star counts failed: %s", error)
            retry_after = error.retry_after_seconds

        updated = await self._store(fetched)
        if updated:
            self._broker.publish(RELEASES_CHANGED)
        return StarRefreshResult(updated, retry_after_seconds=retry_after)

    async def _fetch_all(
        self, due: Sequence[tuple[int, str | None]], *, into: dict[int, _Fetched]
    ) -> None:
        # Results go into ``into`` as they arrive, so they survive a failure of another fetch.
        async def fetch(repository_id: int, etag: str | None) -> None:
            into[repository_id] = await self._fetch(repository_id, etag)

        await gather_limited(
            (fetch(repository_id, etag) for repository_id, etag in due),
            limit=_FETCH_CONCURRENCY,
        )

    async def _fetch(self, repository_id: int, etag: str | None) -> _Fetched:
        try:
            return await self._github.get_repository_stars(repository_id, etag=etag)
        except GitHubError as error:
            # A repository that is gone or no longer accessible keeps its last count.
            if error.is_resource_unavailable:
                return None
            raise

    async def _store(self, fetched: dict[int, _Fetched]) -> int:
        if not fetched:
            return 0
        now = utcnow()
        updated = 0
        async with self._session_factory() as session:
            repositories = await session.scalars(
                select(Repository).where(Repository.id.in_(fetched))
            )
            for repository in repositories:
                result = fetched[repository.id]
                repository.stars_checked_at = now
                if isinstance(result, RepositoryStars):
                    repository.stars_etag = result.etag
                    if repository.stargazers_count != result.count:
                        repository.stargazers_count = result.count
                        updated += 1
            await session.commit()
        return updated
