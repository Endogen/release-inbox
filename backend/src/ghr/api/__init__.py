"""HTTP API routers."""

from fastapi import APIRouter, Depends

from ghr.api import (
    auth,
    events,
    hide_rules,
    notifications,
    preferences,
    push,
    releases,
    repositories,
    summaries,
    sync,
)
from ghr.api.deps import require_user, verify_same_origin


def build_api_router() -> APIRouter:
    api = APIRouter(prefix="/api", dependencies=[Depends(verify_same_origin)])
    api.include_router(auth.router)

    protected = APIRouter(dependencies=[Depends(require_user)])
    for module in (
        releases,
        repositories,
        hide_rules,
        preferences,
        notifications,
        summaries,
        sync,
        events,
        push,
    ):
        protected.include_router(module.router)
    api.include_router(protected)
    return api
