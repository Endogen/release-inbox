"""Repository READMEs, cached locally and revalidated with conditional requests."""

from datetime import timedelta

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

        result = await self._github.get_readme(
            repository.full_name, etag=cached.etag if cached else None
        )
        if result is None:
            if cached is not None:
                await self._session.delete(cached)
                await self._session.commit()
            raise NotFoundError("README of repository", repository.full_name)

        if result is NOT_MODIFIED:
            assert cached is not None  # a conditional request requires a cached etag
            cached.fetched_at = utcnow()
        else:
            cached = await self._session.merge(
                Readme(
                    repository_id=repository_id,
                    content=result.content,
                    html_url=result.html_url,
                    download_url=result.download_url,
                    etag=result.etag,
                    fetched_at=utcnow(),
                )
            )
        await self._session.commit()
        return ReadmeOut.model_validate(cached)
