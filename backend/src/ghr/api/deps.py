"""FastAPI dependencies shared by the routers."""

from collections.abc import AsyncIterator
from datetime import timedelta
from typing import Annotated

from fastapi import Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from ghr.container import Container
from ghr.schemas import MAX_SEARCH_LENGTH
from ghr.security import (
    SESSION_CREDENTIAL_KEY,
    SESSION_USER_KEY,
    credential_fingerprint,
    is_same_origin_request,
)
from ghr.services.hide_rules import HideRuleService
from ghr.services.inbox import InboxService
from ghr.services.preferences import PreferencesService
from ghr.services.readme import ReadmeService
from ghr.services.releases import ReleaseQueries
from ghr.services.repositories import RepositoryService
from ghr.services.summaries import SummaryService

_UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})

SearchQuery = Annotated[str | None, Query(max_length=MAX_SEARCH_LENGTH, description="Search terms")]


async def get_container(request: Request) -> Container:
    container: Container = request.app.state.container
    return container


ContainerDep = Annotated[Container, Depends(get_container)]


async def get_session(container: ContainerDep) -> AsyncIterator[AsyncSession]:
    async with container.session_factory() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def verify_same_origin(request: Request) -> None:
    """Block cross-site requests that change state (CSRF), on top of ``SameSite=Lax``."""
    if request.method not in _UNSAFE_METHODS:
        return
    if not is_same_origin_request(
        sec_fetch_site=request.headers.get("sec-fetch-site"),
        origin=request.headers.get("origin"),
        expected_origin=f"{request.url.scheme}://{request.url.netloc}",
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cross-site requests aren't allowed")


async def require_user(request: Request, container: ContainerDep) -> str:
    settings = container.settings
    expected = credential_fingerprint(settings.username, settings.password_hash.get_secret_value())
    username: str | None = request.session.get(SESSION_USER_KEY)
    if username is None or request.session.get(SESSION_CREDENTIAL_KEY) != expected:
        # Sessions from before a password change are no longer valid.
        request.session.clear()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in to continue")
    return username


CurrentUserDep = Annotated[str, Depends(require_user)]


async def get_release_queries(session: SessionDep) -> ReleaseQueries:
    return ReleaseQueries(session)


async def get_inbox_service(session: SessionDep, container: ContainerDep) -> InboxService:
    return InboxService(session, container.github, container.broker)


async def get_hide_rule_service(session: SessionDep, container: ContainerDep) -> HideRuleService:
    return HideRuleService(session, container.broker)


async def get_repository_service(session: SessionDep, container: ContainerDep) -> RepositoryService:
    return RepositoryService(session, container.broker)


async def get_preferences_service(
    session: SessionDep, container: ContainerDep
) -> PreferencesService:
    return PreferencesService(session, container.broker)


async def get_summary_service(session: SessionDep, container: ContainerDep) -> SummaryService:
    return SummaryService(session, container.summarizer)


async def get_readme_service(session: SessionDep, container: ContainerDep) -> ReadmeService:
    return ReadmeService(
        session, container.github, timedelta(seconds=container.settings.readme_cache_seconds)
    )


ReleaseQueriesDep = Annotated[ReleaseQueries, Depends(get_release_queries)]
InboxServiceDep = Annotated[InboxService, Depends(get_inbox_service)]
HideRuleServiceDep = Annotated[HideRuleService, Depends(get_hide_rule_service)]
ReadmeServiceDep = Annotated[ReadmeService, Depends(get_readme_service)]
RepositoryServiceDep = Annotated[RepositoryService, Depends(get_repository_service)]
PreferencesServiceDep = Annotated[PreferencesService, Depends(get_preferences_service)]
SummaryServiceDep = Annotated[SummaryService, Depends(get_summary_service)]
