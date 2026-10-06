from fastapi import APIRouter

from ghr.api.deps import ContainerDep
from ghr.schemas import NotificationChannelOut, NotificationTestResult
from ghr.services.notifications import Notification

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/channels")
async def list_channels(container: ContainerDep) -> list[NotificationChannelOut]:
    """Delivery channels and whether they are configured on the server."""
    return [
        NotificationChannelOut(name=channel.name, configured=channel.configured)
        for channel in container.notifier.channels
    ]


@router.post("/test")
async def send_test_notification(container: ContainerDep) -> NotificationTestResult:
    """Send a test notification through every configured channel."""
    delivered = await container.notifier.send(
        Notification(
            title="Notifications are on",
            body="You'll be notified here when a new release is published.",
            path="/inbox",
            external_url="https://github.com/notifications",
            tag="test",
        )
    )
    return NotificationTestResult(delivered=delivered)
