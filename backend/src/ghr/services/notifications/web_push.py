"""Web Push (VAPID) to the browsers that subscribed in the app."""

import json
import logging
from enum import Enum, auto

import aiohttp
from py_vapid import Vapid
from pywebpush import WebPushException, webpush_async
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from ghr.concurrency import gather_limited
from ghr.models import PushSubscription
from ghr.services.notifications.message import Notification

logger = logging.getLogger(__name__)

# Keep undelivered notifications for a day so devices that are offline still receive them.
_TIME_TO_LIVE_SECONDS = 24 * 60 * 60
_TIMEOUT_SECONDS = 10
_CONCURRENCY = 8
_EXPIRED_STATUS_CODES = frozenset({404, 410})


class _Delivery(Enum):
    DELIVERED = auto()
    FAILED = auto()
    #: The push service no longer knows the subscription; it should be removed.
    EXPIRED = auto()


class WebPushChannel:
    name = "web-push"

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        *,
        private_key: str | None,
        subject: str,
    ) -> None:
        self._session_factory = session_factory
        self._vapid: Vapid | None = Vapid.from_string(private_key) if private_key else None
        self._subject = subject

    @property
    def configured(self) -> bool:
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

    async def send(self, notification: Notification) -> bool:
        if self._vapid is None:
            return False
        async with self._session_factory() as session:
            subscriptions = list(await session.scalars(select(PushSubscription)))

        payload = json.dumps(
            {
                "title": notification.title,
                "body": notification.body,
                "url": notification.path,
                "tag": notification.tag,
            }
        )
        results = await gather_limited(
            (self._deliver(item, payload) for item in subscriptions), limit=_CONCURRENCY
        )
        expired = [
            item.id
            for item, result in zip(subscriptions, results, strict=True)
            if result is _Delivery.EXPIRED
        ]
        if expired:
            await self._remove(expired)
        return _Delivery.DELIVERED in results

    async def _deliver(self, subscription: PushSubscription, payload: str) -> _Delivery:
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
                timeout=_TIMEOUT_SECONDS,
            )
            return _Delivery.DELIVERED
        except WebPushException as error:
            if error.status_code in _EXPIRED_STATUS_CODES:
                return _Delivery.EXPIRED
            logger.warning("Push to subscription %s failed: %s", subscription.id, error)
        except (aiohttp.ClientError, TimeoutError) as error:
            logger.warning("Push to subscription %s failed: %s", subscription.id, error)
        return _Delivery.FAILED

    async def _remove(self, subscription_ids: list[int]) -> None:
        logger.info("Removing %d expired push subscriptions", len(subscription_ids))
        async with self._session_factory() as session:
            await session.execute(
                delete(PushSubscription).where(PushSubscription.id.in_(subscription_ids))
            )
            await session.commit()
