"""Settings the user changes in the app (as opposed to deployment configuration)."""

from sqlalchemy.ext.asyncio import AsyncSession

from ghr.db import utcnow
from ghr.domain import PrereleaseMode
from ghr.events import Event, EventBroker
from ghr.models import Preferences
from ghr.schemas import PreferenceSettings
from ghr.services.filters import ViewContext

_PREFERENCES_ID = 1


async def load_preferences(session: AsyncSession) -> Preferences:
    """The preferences row; defaults apply until the user changes something."""
    return await session.get(Preferences, _PREFERENCES_ID) or Preferences(
        id=_PREFERENCES_ID, prereleases=PrereleaseMode.SHOW
    )


async def load_view_context(session: AsyncSession) -> ViewContext:
    """What decides which view a release is in right now."""
    preferences = await load_preferences(session)
    return ViewContext(now=utcnow(), prereleases=preferences.prereleases)


class PreferencesService:
    def __init__(self, session: AsyncSession, broker: EventBroker) -> None:
        self._session = session
        self._broker = broker

    async def get(self) -> PreferenceSettings:
        return PreferenceSettings.model_validate(await load_preferences(self._session))

    async def update(self, changes: PreferenceSettings) -> PreferenceSettings:
        preferences = await load_preferences(self._session)
        hidden_before = preferences.prereleases is PrereleaseMode.HIDE
        preferences.prereleases = changes.prereleases
        preferences = await self._session.merge(preferences)
        await self._session.commit()
        if hidden_before != (preferences.prereleases is PrereleaseMode.HIDE):
            # Pre-releases moved between the Hidden view and the others.
            self._broker.publish(Event("releases-changed"))
        return PreferenceSettings.model_validate(preferences)
