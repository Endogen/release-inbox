"""FastAPI dependencies shared by the routers."""

from collections.abc import AsyncIterator
from datetime import timedelta
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from ghr.container import Container
from ghr.security import SESSION_USER_KEY
from ghr.services.hide_rules import HideRuleService
from ghr.services.inbox import InboxService
from ghr.services.readme import ReadmeService
from ghr.services.releases import ReleaseQueries
from ghr.services.repositories import RepositoryService


def get_container(request: Request) -> Container:
    container: Container = request.app.state.container
    return container


ContainerDep = Annotated[Container, Depends(get_container)]


async def get_session(container: ContainerDep) -> AsyncIterator[AsyncSession]:
    async with container.session_factory() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]


def require_user(request: Request) -> str:
    username: str | None = request.session.get(SESSION_USER_KEY)
    if username is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in to continue")
    return username


CurrentUserDep = Annotated[str, Depends(require_user)]


def get_release_queries(session: SessionDep) -> ReleaseQueries:
    return ReleaseQueries(session)


def get_inbox_service(session: SessionDep, container: ContainerDep) -> InboxService:
    return InboxService(session, container.github, container.broker)


def get_hide_rule_service(session: SessionDep, container: ContainerDep) -> HideRuleService:
    return HideRuleService(session, container.broker)


def get_repository_service(session: SessionDep, container: ContainerDep) -> RepositoryService:
    return RepositoryService(session, container.broker)


def get_readme_service(session: SessionDep, container: ContainerDep) -> ReadmeService:
    return ReadmeService(
        session, container.github, timedelta(seconds=container.settings.readme_cache_seconds)
    )


ReleaseQueriesDep = Annotated[ReleaseQueries, Depends(get_release_queries)]
InboxServiceDep = Annotated[InboxService, Depends(get_inbox_service)]
HideRuleServiceDep = Annotated[HideRuleService, Depends(get_hide_rule_service)]
ReadmeServiceDep = Annotated[ReadmeService, Depends(get_readme_service)]
RepositoryServiceDep = Annotated[RepositoryService, Depends(get_repository_service)]
