"""Repository READMEs, cached locally and revalidated with conditional requests.

Private repositories are always fetched in full: their ``download_url`` carries a short-lived
access token for images, and a "not modified" answer would keep serving an expired one.
"""

from datetime import timedelta

from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ghr.db import utcnow
from ghr.errors import NotFoundError
from ghr.github.client import NOT_MODIFIED, GitHubClient
from ghr.models import Readme, Repository
from ghr.schemas import ReadmeOut


class ReadmeService:
    def __init__(self, session: AsyncSession, github: GitHubClient, max_age: timedelta) -> None:
        self._session = session
        self._github = github
        self._max_age = max_age

    async def get(self, repository_id: int) -> ReadmeOut:
        repository = await self._session.get(Repository, repository_id)
        if repository is None:
            raise NotFoundError("Repository", repository_id)

        cached = await self._session.get(Readme, repository_id)
        if cached is not None and utcnow() - cached.fetched_at < self._max_age:
            return ReadmeOut.model_validate(cached)

        etag = cached.etag if cached is not None and not repository.private else None
        result = await self._github.get_readme(repository_id, etag=etag)
        if result is None:
            if cached is not None:
                await self._session.delete(cached)
                await self._session.commit()
            raise NotFoundError("README of repository", repository.full_name)

        if result is NOT_MODIFIED:
            assert cached is not None  # a conditional request requires a cached etag
            cached.fetched_at = utcnow()
            await self._session.commit()
            return ReadmeOut.model_validate(cached)

        # Upsert: two first visits at the same time must not both try to insert.
        values = {
            "repository_id": repository_id,
            "content": result.content,
            "html_url": result.html_url,
            "download_url": result.download_url,
            "etag": result.etag,
            "fetched_at": utcnow(),
        }
        statement = sqlite_insert(Readme).values(**values)
        await self._session.execute(
            statement.on_conflict_do_update(
                index_elements=[Readme.repository_id],
                set_={key: statement.excluded[key] for key in values if key != "repository_id"},
            )
        )
        await self._session.commit()
        return ReadmeOut(
            content=result.content, html_url=result.html_url, download_url=result.download_url
        )
