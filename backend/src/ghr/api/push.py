from fastapi import APIRouter, HTTPException, status

from ghr.api.deps import ContainerDep
from ghr.schemas import PushConfig, PushSubscriptionIn, PushSubscriptionRef
from ghr.services.push import PushMessage

router = APIRouter(prefix="/push", tags=["push notifications"])


@router.get("/config")
async def get_push_config(container: ContainerDep) -> PushConfig:
    return PushConfig(
        enabled=container.push.enabled, public_key=container.settings.vapid_public_key
    )


@router.post("/subscriptions", status_code=status.HTTP_204_NO_CONTENT)
async def subscribe(payload: PushSubscriptionIn, container: ContainerDep) -> None:
    _ensure_enabled(container.push.enabled)
    await container.push.subscribe(str(payload.endpoint), payload.keys.p256dh, payload.keys.auth)


@router.delete("/subscriptions", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe(payload: PushSubscriptionRef, container: ContainerDep) -> None:
    await container.push.unsubscribe(str(payload.endpoint))


@router.post("/test", status_code=status.HTTP_204_NO_CONTENT)
async def send_test_notification(container: ContainerDep) -> None:
    _ensure_enabled(container.push.enabled)
    await container.push.send(
        PushMessage(
            title="Notifications are on",
            body="You'll be notified here when a new release is published.",
            url="/inbox",
            tag="test",
        )
    )


def _ensure_enabled(enabled: bool) -> None:
    if not enabled:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Push notifications are not configured on the server"
        )
