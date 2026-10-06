"""ntfy (https://ntfy.sh or self-hosted): push to the ntfy app without installing anything else."""

import logging

import httpx

from ghr.services.notifications.message import Notification

logger = logging.getLogger(__name__)


class NtfyChannel:
    name = "ntfy"

    def __init__(
        self,
        http: httpx.AsyncClient,
        *,
        target: tuple[str, str] | None,
        token: str | None,
        public_url: str | None,
    ) -> None:
        """``target`` is the (server URL, topic) pair, see ``Settings.ntfy_target``."""
        self._http = http
        self._target = target
        self._token = token
        self._public_url = public_url

    @property
    def configured(self) -> bool:
        return self._target is not None

    async def send(self, notification: Notification) -> bool:
        if self._target is None:
            return False
        server, topic = self._target
        headers = {"Authorization": f"Bearer {self._token}"} if self._token else {}
        # JSON publishing keeps non-ASCII titles intact (HTTP headers can't carry them).
        try:
            response = await self._http.post(
                server,
                headers=headers,
                json={
                    "topic": topic,
                    "title": notification.title,
                    "message": notification.body,
                    "click": notification.link(self._public_url),
                    "tags": ["package"],
                },
            )
            response.raise_for_status()
        except httpx.HTTPError as error:
            logger.warning("ntfy notification failed: %s", error)
            return False
        return True
