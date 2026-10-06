"""The notification payload and the interface every delivery channel implements."""

from dataclasses import dataclass
from typing import Protocol

GITHUB_NOTIFICATIONS_URL = "https://github.com/notifications"


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

    def link(self, public_url: str | None) -> str:
        """Into the app if its address is known, else to GitHub."""
        return f"{public_url.rstrip('/')}{self.path}" if public_url else self.external_url


class NotificationChannel(Protocol):
    @property
    def name(self) -> str: ...

    @property
    def configured(self) -> bool: ...

    async def send(self, notification: Notification) -> bool:
        """Deliver the notification. Returns whether it reached at least one recipient."""
        ...
