from fastapi import APIRouter

from ghr.api.deps import ContainerDep
from ghr.schemas import NotificationChannelOut, NotificationTestResult

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
    return NotificationTestResult(delivered=await container.notifier.send_test())
