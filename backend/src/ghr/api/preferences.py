from fastapi import APIRouter

from ghr.api.deps import PreferencesServiceDep
from ghr.schemas import PreferenceSettings

router = APIRouter(prefix="/preferences", tags=["preferences"])


@router.get("")
async def get_preferences(preferences: PreferencesServiceDep) -> PreferenceSettings:
    return await preferences.get()


@router.patch("")
async def update_preferences(
    changes: PreferenceSettings, preferences: PreferencesServiceDep
) -> PreferenceSettings:
    return await preferences.update(changes)
