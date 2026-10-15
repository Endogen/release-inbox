"""Notifications for the desktop app, sent over the live-update stream it keeps open."""

from ghr.events import Event, EventBroker
from ghr.services.notifications.message import Notification


class DesktopChannel:
    name = "desktop"
    #: Nothing to set up on the server: running desktop apps subscribe to the event stream.
    configured = True

    def __init__(self, broker: EventBroker) -> None:
        self._broker = broker

    async def send(self, notification: Notification) -> bool:
        """Reaches only desktop apps that are connected right now; there is no queue for
        the others. They refetch the inbox when they reconnect."""
        event = Event(
            "notification",
            {
                "title": notification.title,
                "body": notification.body,
                "url": notification.path,
                "tag": notification.tag,
                "unread": notification.unread,
                "release_ids": list(notification.release_ids),
                "repository_id": notification.repository_id,
            },
        )
        return self._broker.publish(event) > 0
