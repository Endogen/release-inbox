"""The notification payload and the interface every delivery channel implements."""

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class Notification:
    title: str
    body: str
    #: Where the notification leads inside the app, e.g. ``/inbox?release=1``.
    path: str
    #: Fallback link on GitHub for channels that can't open the app.
    external_url: str
    #: Notifications with the same tag replace each other on the device.
    tag: str


class NotificationChannel(Protocol):
    @property
    def name(self) -> str: ...

    @property
    def configured(self) -> bool: ...

    async def send(self, notification: Notification) -> bool:
        """Deliver the notification. Returns whether it reached at least one recipient."""
        ...
