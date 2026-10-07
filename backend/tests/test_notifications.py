"""Notification channels, what gets announced, and the push subscription API."""

import base64
import json
import os
from collections.abc import AsyncIterator
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest
import respx
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
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
from tests.conftest import (
    SentNotifications,
    build_client,
    make_settings,
    running_container,
    sign_in,
)
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
                target=("https://ntfy.example/", "releases"),
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
                http, target=("https://ntfy.sh/", "topic"), token=None, public_url=None
            )

            assert not await channel.send(NOTIFICATION)

        assert json.loads(route.calls.last.request.content)["click"] == NOTIFICATION.external_url


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
        assert sent[0].unread == 2  # inbox entries, for the badge on the app icon

    @pytest.mark.parametrize("mode", ["mute", "hide"])
    async def test_skips_prereleases_unless_shown_normally(
        self,
        container: Container,
        github_api: respx.MockRouter,
        user_client: AsyncClient,
        sent: SentNotifications,
        mode: str,
    ) -> None:
        await user_client.patch("/api/preferences", json={"prereleases": mode})

        await self.announce(container, github_api, user_client)

        assert [notification.title for notification in sent] == ["acme/app"]

    async def test_skips_muted_repositories(
        self,
        container: Container,
        github_api: respx.MockRouter,
        user_client: AsyncClient,
        sent: SentNotifications,
    ) -> None:
        mock_github(github_api, [self.STABLE, self.BETA])
        await container.sync.sync()
        await user_client.put("/api/repositories/10/notifications", json={"enabled": False})

        await container.notifier.announce_new_releases([1, 2])

        assert [notification.title for notification in sent] == ["acme/tool"]


async def test_channels_and_test_notification_endpoints(
    user_client: AsyncClient, sent: SentNotifications
) -> None:
    channels = (await user_client.get("/api/notifications/channels")).json()
    assert {channel["name"] for channel in channels} == {"web-push", "ntfy", "telegram"}

    result = await user_client.post("/api/notifications/test")

    assert result.json() == {"delivered": {"test": True}}
    assert sent[0].tag == "test"


async def test_web_push_sends_json_and_removes_expired_subscriptions(
    container: Container, monkeypatch: pytest.MonkeyPatch
) -> None:
    channel = WebPushChannel(
        container.session_factory, private_key=vapid_key_pair()[1], subject="mailto:a@b"
    )
    await channel.subscribe("https://push.example/alive", "p256dh", "auth")
    await channel.subscribe("https://push.example/gone", "p256dh", "auth")

    payloads: list[str] = []

    async def fake_webpush(*, subscription_info: dict[str, object], data: str, **_: object) -> None:
        payloads.append(data)
        if str(subscription_info["endpoint"]).endswith("gone"):
            raise WebPushException("gone", response=SimpleNamespace(status_code=410))

    monkeypatch.setattr("ghr.services.notifications.web_push.webpush_async", fake_webpush)

    assert await channel.send(replace(NOTIFICATION, unread=3))
    assert json.loads(payloads[0]) == {
        "title": NOTIFICATION.title,
        "body": NOTIFICATION.body,
        "url": NOTIFICATION.path,
        "tag": NOTIFICATION.tag,
        "unread": 3,
    }
    async with container.session_factory() as session:
        endpoints = set(await session.scalars(select(PushSubscription.endpoint)))
    assert endpoints == {"https://push.example/alive"}


@pytest.fixture
async def push_client(tmp_path: Path) -> AsyncIterator[AsyncClient]:
    """Signed-in client of an app with browser push configured."""
    public_key, private_key = vapid_key_pair()
    settings = make_settings(tmp_path, vapid_public_key=public_key, vapid_private_key=private_key)
    async with (
        running_container(settings) as container,
        build_client(settings, container) as client,
    ):
        await sign_in(client)
        yield client


def push_keys() -> dict[str, str]:
    """Keys like a browser's: an uncompressed P-256 public key and a 16-byte secret."""
    public_key = ec.generate_private_key(ec.SECP256R1()).public_key()
    point = public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
    return {
        "p256dh": base64.urlsafe_b64encode(point).rstrip(b"=").decode(),
        "auth": base64.urlsafe_b64encode(os.urandom(16)).rstrip(b"=").decode(),
    }


async def test_push_subscription_api(push_client: AsyncClient) -> None:
    subscription = {"endpoint": "https://push.example/device", "keys": push_keys()}

    config = (await push_client.get("/api/push/config")).json()
    subscribed = await push_client.post("/api/push/subscriptions", json=subscription)
    resubscribed = await push_client.post("/api/push/subscriptions", json=subscription)
    removed = await push_client.request(
        "DELETE", "/api/push/subscriptions", json={"endpoint": subscription["endpoint"]}
    )

    assert config["enabled"] is True and config["public_key"]
    assert [subscribed.status_code, resubscribed.status_code, removed.status_code] == [204] * 3


@pytest.mark.parametrize(
    "keys",
    [
        {"p256dh": "not base64!", "auth": "AAAAAAAAAAAAAAAAAAAAAA"},
        {"p256dh": "BAAA", "auth": "AAAAAAAAAAAAAAAAAAAAAA"},
        {"auth": "short"},
    ],
)
async def test_rejects_malformed_push_keys(push_client: AsyncClient, keys: dict[str, str]) -> None:
    valid = push_keys()
    response = await push_client.post(
        "/api/push/subscriptions",
        json={"endpoint": "https://push.example/device", "keys": {**valid, **keys}},
    )

    assert response.status_code == 422


async def test_push_subscriptions_need_server_keys(user_client: AsyncClient) -> None:
    response = await user_client.post(
        "/api/push/subscriptions",
        json={"endpoint": "https://push.example/device", "keys": push_keys()},
    )

    assert (await user_client.get("/api/push/config")).json() == {
        "enabled": False,
        "public_key": None,
    }
    assert response.status_code == 409
