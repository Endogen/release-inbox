"""Settings the user changes in the app (as opposed to deployment configuration)."""

from sqlalchemy.ext.asyncio import AsyncSession

from ghr.events import Event, EventBroker
from ghr.models import Preferences
from ghr.schemas import PreferencesOut, PreferencesUpdate

_PREFERENCES_ID = 1


async def load_preferences(session: AsyncSession) -> Preferences:
    """The preferences row; defaults apply until the user changes something."""
    return await session.get(Preferences, _PREFERENCES_ID) or Preferences(
        id=_PREFERENCES_ID, show_prereleases=True, notify_prereleases=True
    )


class PreferencesService:
    def __init__(self, session: AsyncSession, broker: EventBroker) -> None:
        self._session = session
        self._broker = broker

    async def get(self) -> PreferencesOut:
        return PreferencesOut.model_validate(await load_preferences(self._session))

    async def update(self, changes: PreferencesUpdate) -> PreferencesOut:
        preferences = await load_preferences(self._session)
        for field, value in changes.model_dump(exclude_unset=True).items():
            setattr(preferences, field, value)
        await self._session.merge(preferences)
        await self._session.commit()
        self._broker.publish(Event("releases-changed"))
        return PreferencesOut.model_validate(preferences)
