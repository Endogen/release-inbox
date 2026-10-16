"""Notification actions must only affect the releases named in the notification."""

from datetime import UTC, datetime, timedelta

import respx
from httpx import AsyncClient

from ghr.container import Container
from tests.conftest import SentNotifications
from tests.github_fixtures import FakeRelease, import_releases


async def test_notification_snooze_leaves_older_unnotified_release_in_inbox(
    container: Container,
    github_api: respx.MockRouter,
    user_client: AsyncClient,
    sent: SentNotifications,
) -> None:
    older = FakeRelease(1, 10, "acme/app", "v1", "2026-10-01T10:00:00Z")
    newer = FakeRelease(2, 10, "acme/app", "v2", "2026-10-02T10:00:00Z")
    await import_releases(container, github_api, [older, newer])
    sent.clear()
    await container.notifier.announce_new_releases([newer.id])
    assert sent[0].release_ids == (newer.id,)

    # A notification action explicitly opts out of grouping older inbox releases.
    response = await user_client.post(
        f"/api/releases/{newer.id}/snooze",
        json={
            "until": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
            "view": None,
            "search": None,
        },
    )
    assert response.status_code == 204
    older_detail = (await user_client.get(f"/api/releases/{older.id}")).json()
    newer_detail = (await user_client.get(f"/api/releases/{newer.id}")).json()
    assert newer_detail["snoozed_until"] is not None
    assert older_detail["snoozed_until"] is None


async def test_notification_undo_preserves_an_independent_snooze_with_same_deadline(
    container: Container,
    github_api: respx.MockRouter,
    user_client: AsyncClient,
) -> None:
    older = FakeRelease(1, 10, "acme/app", "v1", "2026-10-01T10:00:00Z")
    newer = FakeRelease(2, 10, "acme/app", "v2", "2026-10-02T10:00:00Z")
    await import_releases(container, github_api, [older, newer])
    # Both independent actions choose the same "Tomorrow" option. The older
    # release is already snoozed when the newer notification is acted on.
    until = (
        (datetime.now(UTC) + timedelta(days=1))
        .replace(hour=9, minute=0, second=0, microsecond=0)
        .isoformat()
    )
    for release in (older, newer):
        response = await user_client.post(
            f"/api/releases/{release.id}/snooze", json={"until": until, "view": "inbox"}
        )
        assert response.status_code == 204

    response = await user_client.delete(
        f"/api/releases/{newer.id}/snooze", params={"include_group": "false"}
    )

    assert response.status_code == 204
    newer_detail = (await user_client.get(f"/api/releases/{newer.id}")).json()
    older_detail = (await user_client.get(f"/api/releases/{older.id}")).json()
    assert newer_detail["snoozed_until"] is None
    assert older_detail["snoozed_until"] is not None
