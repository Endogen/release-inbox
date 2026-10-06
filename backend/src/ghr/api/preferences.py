from fastapi import APIRouter

from ghr.api.deps import PreferencesServiceDep
from ghr.schemas import PreferencesOut, PreferencesUpdate

router = APIRouter(prefix="/preferences", tags=["preferences"])


@router.get("")
async def get_preferences(preferences: PreferencesServiceDep) -> PreferencesOut:
    return await preferences.get()


@router.patch("")
async def update_preferences(
    changes: PreferencesUpdate, preferences: PreferencesServiceDep
) -> PreferencesOut:
    return await preferences.update(changes)
