"""Telegram: messages from your own bot to a chat."""

import html
import logging

import httpx

from ghr.services.notifications.message import Notification

logger = logging.getLogger(__name__)

TELEGRAM_API_URL = "https://api.telegram.org"


class TelegramChannel:
    name = "telegram"

    def __init__(
        self,
        http: httpx.AsyncClient,
        *,
        bot_token: str | None,
        chat_id: str | None,
        public_url: str | None,
    ) -> None:
        self._http = http
        self._bot_token = bot_token
        self._chat_id = chat_id
        self._public_url = public_url.rstrip("/") if public_url else None

    @property
    def configured(self) -> bool:
        return bool(self._bot_token and self._chat_id)

    async def send(self, notification: Notification) -> bool:
        if not self.configured:
            return False
        link = (
            f"{self._public_url}{notification.path}"
            if self._public_url
            else notification.external_url
        )
        text = (
            f"<b>{html.escape(notification.title)}</b>\n"
            f"{html.escape(notification.body)}\n"
            f'<a href="{html.escape(link, quote=True)}">Open</a>'
        )
        try:
            response = await self._http.post(
                f"{TELEGRAM_API_URL}/bot{self._bot_token}/sendMessage",
                json={
                    "chat_id": self._chat_id,
                    "text": text,
                    "parse_mode": "HTML",
                    "link_preview_options": {"is_disabled": True},
                },
            )
            response.raise_for_status()
        except httpx.HTTPError as error:
            # The bot token is part of the URL; log only the status, never the request URL.
            status = (
                error.response.status_code if isinstance(error, httpx.HTTPStatusError) else None
            )
            logger.warning(
                "Telegram notification failed (status %s)", status or type(error).__name__
            )
            return False
        return True
