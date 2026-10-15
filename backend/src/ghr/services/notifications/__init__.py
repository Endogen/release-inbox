"""Notifications about new releases, delivered through Web Push, ntfy, Telegram
and the desktop app."""

from ghr.services.notifications.message import Notification
from ghr.services.notifications.notifier import Notifier

__all__ = ["Notification", "Notifier"]
