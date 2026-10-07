"""Settings the user changes in the app (as opposed to deployment configuration)."""

from sqlalchemy.ext.asyncio import AsyncSession

from ghr.db import utcnow
from ghr.domain import NotifyAbout, PrereleaseMode
from ghr.events import RELEASES_CHANGED, EventBroker
from ghr.models import Preferences
from ghr.schemas import PreferenceChanges, PreferenceSettings
from ghr.services.filters import ViewContext

_PREFERENCES_ID = 1


async def load_preferences(session: AsyncSession) -> Preferences:
    """The preferences row; defaults apply until the user changes something."""
    return await session.get(Preferences, _PREFERENCES_ID) or Preferences(
        id=_PREFERENCES_ID,
        prereleases=PrereleaseMode.SHOW,
        notify_about=NotifyAbout.ALL,
        mark_read_after_viewing=False,
        app_badge=True,
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

    async def update(self, changes: PreferenceChanges) -> PreferenceSettings:
        preferences = await load_preferences(self._session)
        hidden_before = preferences.prereleases is PrereleaseMode.HIDE
        for name, value in changes.model_dump(exclude_unset=True).items():
            setattr(preferences, name, value)
        preferences = await self._session.merge(preferences)
        await self._session.commit()
        if hidden_before != (preferences.prereleases is PrereleaseMode.HIDE):
            # Pre-releases moved between the Hidden view and the others.
            self._broker.publish(RELEASES_CHANGED)
        return PreferenceSettings.model_validate(preferences)
