from fastapi import APIRouter, status

from ghr.api.deps import ContainerDep
from ghr.errors import ConflictError
from ghr.schemas import PushConfig, PushSubscriptionIn, PushSubscriptionRef

router = APIRouter(prefix="/push", tags=["push notifications"])


@router.get("/config")
async def get_push_config(container: ContainerDep) -> PushConfig:
    return PushConfig(
        enabled=container.web_push.configured, public_key=container.settings.vapid_public_key
    )


@router.post("/subscriptions", status_code=status.HTTP_204_NO_CONTENT)
async def subscribe(payload: PushSubscriptionIn, container: ContainerDep) -> None:
    if not container.web_push.configured:
        raise ConflictError("Push notifications are not configured on the server")
    await container.web_push.subscribe(
        str(payload.endpoint), payload.keys.p256dh, payload.keys.auth
    )


@router.delete("/subscriptions", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe(payload: PushSubscriptionRef, container: ContainerDep) -> None:
    await container.web_push.unsubscribe(str(payload.endpoint))
