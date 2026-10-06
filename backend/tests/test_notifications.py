import json
from types import SimpleNamespace

import httpx
import pytest
import respx
from httpx import AsyncClient, Response
from pywebpush import WebPushException
from sqlalchemy import select

from ghr.cli import vapid_key_pair
from ghr.container import Container
from ghr.models import PushSubscription
from ghr.services.notifications import Notification, Notifier
from ghr.services.notifications.ntfy import NtfyChannel
from ghr.services.notifications.telegram import TELEGRAM_API_URL, TelegramChannel
from ghr.services.notifications.web_push import WebPushChannel
from tests.conftest import SentNotifications
from tests.github_fixtures import FakeRelease, mock_github

NOTIFICATION = Notification(
    title="acme/app <beta>",
    body="v2.0.0 was released",
    path="/inbox?release=2",
    external_url="https://github.com/acme/app/releases/tag/v2.0.0",
    tag="release-2",
)


class TestNtfy:
    async def test_publishes_json_with_a_link_into_the_app(self) -> None:
        async with httpx.AsyncClient() as http, respx.mock() as router:
            route = router.post("https://ntfy.example/").mock(return_value=Response(200))
            channel = NtfyChannel(
                http,
                topic_url="https://ntfy.example/releases",
                token="secret",
                public_url="https://releases.example/",
            )

            assert await channel.send(NOTIFICATION)

        request = route.calls.last.request
        assert request.headers["Authorization"] == "Bearer secret"
        assert json.loads(request.content) == {
            "topic": "releases",
            "title": "acme/app <beta>",
            "message": "v2.0.0 was released",
            "click": "https://releases.example/inbox?release=2",
            "tags": ["package"],
        }

    async def test_links_to_github_without_a_public_url_and_reports_failures(self) -> None:
        async with httpx.AsyncClient() as http, respx.mock() as router:
            route = router.post("https://ntfy.sh/").mock(return_value=Response(500))
            channel = NtfyChannel(
                http, topic_url="https://ntfy.sh/topic", token=None, public_url=None
            )

            assert not await channel.send(NOTIFICATION)

        assert json.loads(route.calls.last.request.content)["click"] == NOTIFICATION.external_url

    def test_requires_a_topic(self) -> None:
        with pytest.raises(ValueError, match="topic"):
            NtfyChannel(
                httpx.AsyncClient(), topic_url="https://ntfy.sh/", token=None, public_url=None
            )


class TestTelegram:
    async def test_sends_escaped_html(self) -> None:
        async with httpx.AsyncClient() as http, respx.mock() as router:
            route = router.post(f"{TELEGRAM_API_URL}/bot123:abc/sendMessage").mock(
                return_value=Response(200, json={"ok": True})
            )
            channel = TelegramChannel(
                http, bot_token="123:abc", chat_id="42", public_url="https://releases.example"
            )

            assert await channel.send(NOTIFICATION)

        payload = json.loads(route.calls.last.request.content)
        assert payload["chat_id"] == "42"
        assert payload["parse_mode"] == "HTML"
        assert payload["text"] == (
            "<b>acme/app &lt;beta&gt;</b>\nv2.0.0 was released\n"
            '<a href="https://releases.example/inbox?release=2">Open</a>'
        )

    def test_needs_token_and_chat(self) -> None:
        channel = TelegramChannel(httpx.AsyncClient(), bot_token="t", chat_id=None, public_url=None)
        assert not channel.configured


class FailingChannel:
    name = "broken"
    configured = True

    async def send(self, notification: Notification) -> bool:
        raise RuntimeError("boom")


class RecordingChannel:
    name = "recording"
    configured = True

    def __init__(self) -> None:
        self.sent: list[Notification] = []

    async def send(self, notification: Notification) -> bool:
        self.sent.append(notification)
        return True


class UnconfiguredChannel(RecordingChannel):
    name = "off"
    configured = False


async def test_notifier_isolates_channel_failures(container: Container) -> None:
    recording, unconfigured = RecordingChannel(), UnconfiguredChannel()
    notifier = Notifier(container.session_factory, [FailingChannel(), recording, unconfigured])

    result = await notifier.send(NOTIFICATION)

    assert result == {"broken": False, "recording": True}
    assert recording.sent == [NOTIFICATION]
    assert unconfigured.sent == []


class TestAnnouncementFilters:
    STABLE = FakeRelease(1, 10, "acme/app", "web@1.0.0", "2026-10-01T10:00:00Z")
    BETA = FakeRelease(2, 20, "acme/tool", "v2.0.0-rc.1", "2026-10-02T10:00:00Z", prerelease=True)
    HIDDEN = FakeRelease(3, 10, "acme/app", "docs@1.0.0", "2026-10-03T10:00:00Z")

    async def announce(
        self, container: Container, github_api: respx.MockRouter, user_client: AsyncClient
    ) -> None:
        mock_github(github_api, [self.STABLE, self.BETA, self.HIDDEN])
        await container.sync.sync()
        await user_client.post("/api/hide-rules", json={"repository_id": 10, "pattern": "docs@*"})
        await container.notifier.announce_new_releases([1, 2, 3])

    async def test_skips_hidden_releases(
        self,
        container: Container,
        github_api: respx.MockRouter,
        user_client: AsyncClient,
        sent: SentNotifications,
    ) -> None:
        await self.announce(container, github_api, user_client)

        assert [notification.title for notification in sent] == ["2 new releases"]
        assert sent[0].body == "acme/tool, acme/app"

    async def test_skips_prereleases_when_turned_off(
        self,
        container: Container,
        github_api: respx.MockRouter,
        user_client: AsyncClient,
        sent: SentNotifications,
    ) -> None:
        await user_client.patch("/api/preferences", json={"notify_prereleases": False})

        await self.announce(container, github_api, user_client)

        assert [notification.title for notification in sent] == ["acme/app"]


async def test_channels_and_test_notification_endpoints(
    user_client: AsyncClient, sent: SentNotifications
) -> None:
    channels = (await user_client.get("/api/notifications/channels")).json()
    assert {channel["name"] for channel in channels} == {"web-push", "ntfy", "telegram"}

    result = await user_client.post("/api/notifications/test")

    assert result.json() == {"delivered": {"test": True}}
    assert sent[0].tag == "test"


async def test_web_push_removes_expired_subscriptions(
    container: Container, monkeypatch: pytest.MonkeyPatch
) -> None:
    channel = WebPushChannel(
        container.session_factory, private_key=vapid_key_pair()[1], subject="mailto:a@b"
    )
    await channel.subscribe("https://push.example/alive", "p256dh", "auth")
    await channel.subscribe("https://push.example/gone", "p256dh", "auth")

    async def fake_webpush(*, subscription_info: dict[str, object], **_: object) -> None:
        if subscription_info["endpoint"].endswith("gone"):  # type: ignore[union-attr]
            raise WebPushException("gone", response=SimpleNamespace(status_code=410))

    monkeypatch.setattr("ghr.services.notifications.web_push.webpush_async", fake_webpush)

    assert await channel.send(NOTIFICATION)
    async with container.session_factory() as session:
        endpoints = set(await session.scalars(select(PushSubscription.endpoint)))
    assert endpoints == {"https://push.example/alive"}
