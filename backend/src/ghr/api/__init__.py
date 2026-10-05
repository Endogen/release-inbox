"""HTTP API routers."""

from fastapi import APIRouter, Depends

from ghr.api import auth, events, hide_rules, push, releases, repositories, sync
from ghr.api.deps import require_user


def build_api_router() -> APIRouter:
    api = APIRouter(prefix="/api")
    api.include_router(auth.router)

    protected = APIRouter(dependencies=[Depends(require_user)])
    for module in (releases, repositories, hide_rules, sync, events, push):
        protected.include_router(module.router)
    api.include_router(protected)
    return api
