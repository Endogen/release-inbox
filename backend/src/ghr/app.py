"""FastAPI application factory."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import timedelta

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.sessions import SessionMiddleware

from ghr.api import build_api_router
from ghr.config import Settings, get_settings
from ghr.container import Container
from ghr.errors import ConflictError, NotFoundError
from ghr.github.client import GitHubError
from ghr.services.summaries import SummaryError

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        container = Container.build(settings)
        app.state.container = container
        container.scheduler.start()
        try:
            yield
        finally:
            await container.aclose()

    app = FastAPI(
        title="GitHub Release Inbox",
        lifespan=lifespan,
        # The API schema documents every endpoint; only expose it where that's wanted.
        docs_url="/api/docs" if settings.enable_api_docs else None,
        openapi_url="/api/openapi.json" if settings.enable_api_docs else None,
        redoc_url=None,
    )
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.session_secret.get_secret_value(),
        session_cookie="ghr_session",
        max_age=int(timedelta(days=settings.session_max_age_days).total_seconds()),
        same_site="lax",
        https_only=settings.secure_cookies,
    )
    app.include_router(build_api_router())
    _register_error_handlers(app)
    return app


def _register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(NotFoundError)
    async def _not_found(_: Request, error: NotFoundError) -> JSONResponse:
        return _error(status.HTTP_404_NOT_FOUND, str(error))

    @app.exception_handler(ConflictError)
    async def _conflict(_: Request, error: ConflictError) -> JSONResponse:
        return _error(status.HTTP_409_CONFLICT, str(error))

    @app.exception_handler(SummaryError)
    async def _summary(_: Request, error: SummaryError) -> JSONResponse:
        return _error(status.HTTP_503_SERVICE_UNAVAILABLE, str(error))

    @app.exception_handler(GitHubError)
    async def _github(_: Request, error: GitHubError) -> JSONResponse:
        logger.warning("GitHub request failed: %s", error)
        return _error(status.HTTP_502_BAD_GATEWAY, str(error))


def _error(status_code: int, detail: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"detail": detail})
