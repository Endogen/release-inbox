"""Web Push notifications (VAPID) delivered to subscribed browsers."""

import json
import logging
from dataclasses import asdict, dataclass

import aiohttp
from py_vapid import Vapid, Vapid01
from pywebpush import WebPushException, webpush_async
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from ghr.models import PushSubscription

logger = logging.getLogger(__name__)

# Keep undelivered notifications for a day so devices that are offline still receive them.
_TIME_TO_LIVE_SECONDS = 24 * 60 * 60
_EXPIRED_STATUS_CODES = frozenset({404, 410})


@dataclass(frozen=True, slots=True)
class PushMessage:
    title: str
    body: str
    url: str
    tag: str


class PushService:
    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        *,
        private_key: str | None,
        subject: str,
    ) -> None:
        self._session_factory = session_factory
        self._vapid: Vapid01 | None = Vapid.from_string(private_key) if private_key else None
        self._subject = subject

    @property
    def enabled(self) -> bool:
        return self._vapid is not None

    async def subscribe(self, endpoint: str, p256dh: str, auth: str) -> None:
        async with self._session_factory() as session:
            subscription = await session.scalar(
                select(PushSubscription).where(PushSubscription.endpoint == endpoint)
            )
            if subscription is None:
                session.add(PushSubscription(endpoint=endpoint, p256dh=p256dh, auth=auth))
            else:
                subscription.p256dh = p256dh
                subscription.auth = auth
            await session.commit()

    async def unsubscribe(self, endpoint: str) -> None:
        async with self._session_factory() as session:
            await session.execute(
                delete(PushSubscription).where(PushSubscription.endpoint == endpoint)
            )
            await session.commit()

    async def send(self, message: PushMessage) -> int:
        """Deliver a message to every subscription. Returns the number of successful deliveries."""
        if self._vapid is None:
            return 0

        async with self._session_factory() as session:
            subscriptions = (await session.scalars(select(PushSubscription))).all()
            payload = json.dumps(asdict(message))
            delivered = 0
            for subscription in subscriptions:
                try:
                    await webpush_async(
                        subscription_info={
                            "endpoint": subscription.endpoint,
                            "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
                        },
                        data=payload,
                        vapid_private_key=self._vapid,
                        vapid_claims={"sub": self._subject},
                        ttl=_TIME_TO_LIVE_SECONDS,
                    )
                    delivered += 1
                except WebPushException as error:
                    if error.status_code in _EXPIRED_STATUS_CODES:
                        logger.info("Removing expired push subscription %s", subscription.id)
                        await session.delete(subscription)
                    else:
                        logger.warning("Push to subscription %s failed: %s", subscription.id, error)
                except aiohttp.ClientError as error:
                    logger.warning("Push to subscription %s failed: %s", subscription.id, error)
            await session.commit()
            return delivered
