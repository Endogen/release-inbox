"""ntfy (https://ntfy.sh or self-hosted): push to the ntfy app without installing anything else."""

import logging
from urllib.parse import urlsplit, urlunsplit

import httpx

from ghr.services.notifications.message import Notification

logger = logging.getLogger(__name__)


class NtfyChannel:
    name = "ntfy"

    def __init__(
        self,
        http: httpx.AsyncClient,
        *,
        topic_url: str | None,
        token: str | None,
        public_url: str | None,
    ) -> None:
        self._http = http
        self._target = _split_topic_url(topic_url) if topic_url else None
        self._token = token
        self._public_url = public_url.rstrip("/") if public_url else None

    @property
    def configured(self) -> bool:
        return self._target is not None

    async def send(self, notification: Notification) -> bool:
        if self._target is None:
            return False
        server, topic = self._target
        click = (
            f"{self._public_url}{notification.path}"
            if self._public_url
            else notification.external_url
        )
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
                    "click": click,
                    "tags": ["package"],
                },
            )
            response.raise_for_status()
        except httpx.HTTPError as error:
            logger.warning("ntfy notification failed: %s", error)
            return False
        return True


def _split_topic_url(topic_url: str) -> tuple[str, str]:
    """``https://ntfy.sh/releases`` → (``https://ntfy.sh/``, ``releases``)."""
    parts = urlsplit(topic_url)
    path, _, topic = parts.path.rstrip("/").rpartition("/")
    if not topic:
        raise ValueError(
            f"ntfy URL must include the topic, e.g. https://ntfy.sh/topic: {topic_url}"
        )
    return urlunsplit((parts.scheme, parts.netloc, f"{path}/", "", "")), topic
