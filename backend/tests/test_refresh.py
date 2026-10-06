"""Refreshing recently published releases."""

from dataclasses import replace
from datetime import timedelta

import pytest
import respx
from httpx import Response
from sqlalchemy import select

from ghr.container import Container
from ghr.models import Release
from tests.conftest import SentNotifications, timestamp
from tests.github_fixtures import FakeRelease, mock_github

WINDOW = timedelta(days=14)


@pytest.fixture
def beta() -> FakeRelease:
    return FakeRelease(
        1, 10, "acme/app", "v2.0.0-rc.1", timestamp(days_ago=1), prerelease=True, body="Draft"
    )


@pytest.fixture
async def imported(
    container: Container, github_api: respx.MockRouter, beta: FakeRelease
) -> FakeRelease:
    ancient = FakeRelease(2, 20, "acme/tool", "v1.0.0", timestamp(days_ago=60))
    mock_github(github_api, [beta, ancient])
    await container.sync.sync()
    await container.tasks.wait()
    return beta


async def load(container: Container, release_id: int) -> Release | None:
    async with container.session_factory() as session:
        return await session.get(Release, release_id)


async def test_picks_up_edits_conditionally_and_only_for_recent_releases(
    container: Container, github_api: respx.MockRouter, imported: FakeRelease
) -> None:
    edited = replace(imported, body="Final notes\n\nBREAKING CHANGE: new API")
    route = github_api.get(imported.refresh_url).mock(
        return_value=Response(200, json=edited.release(), headers={"ETag": '"v2"'})
    )
    calls_before = len(github_api.calls)

    assert (await container.sync.refresh_recent(published_within=WINDOW)).refreshed == 1

    release = await load(container, imported.id)
    assert release is not None
    assert (release.body, release.etag, release.breaking) == (edited.body, '"v2"', True)
    assert route.calls.last.request.headers["If-None-Match"] == '"v1"'
    refreshed = {str(call.request.url) for call in github_api.calls[calls_before:]}
    assert refreshed == {imported.refresh_url}


async def test_unchanged_releases_are_cheap(
    container: Container, github_api: respx.MockRouter, imported: FakeRelease
) -> None:
    github_api.get(imported.refresh_url).mock(return_value=Response(304))

    assert (await container.sync.refresh_recent(published_within=WINDOW)).refreshed == 0


async def test_promotion_to_a_release_is_announced(
    container: Container,
    github_api: respx.MockRouter,
    imported: FakeRelease,
    sent: SentNotifications,
) -> None:
    promoted = replace(imported, prerelease=False)
    github_api.get(imported.refresh_url).mock(return_value=Response(200, json=promoted.release()))

    await container.sync.refresh_recent(published_within=WINDOW)
    await container.tasks.wait()

    assert [notification.title for notification in sent] == ["acme/app"]


async def test_deletes_releases_only_when_the_repository_is_still_there(
    container: Container, github_api: respx.MockRouter, imported: FakeRelease
) -> None:
    github_api.get(imported.refresh_url).mock(return_value=Response(404))
    github_api.get("/repositories/10").mock(return_value=Response(200, json={"id": 10}))

    assert (await container.sync.refresh_recent(published_within=WINDOW)).refreshed == 1
    assert await load(container, imported.id) is None


@pytest.mark.parametrize(
    ("release_status", "repository_status"),
    [(403, None), (451, None), (404, 404), (404, 403)],
    ids=["sso", "takedown", "repository-gone", "access-lost"],
)
async def test_keeps_releases_that_are_only_inaccessible(
    container: Container,
    github_api: respx.MockRouter,
    imported: FakeRelease,
    release_status: int,
    repository_status: int | None,
) -> None:
    github_api.get(imported.refresh_url).mock(
        return_value=Response(release_status, json={"message": "Resource protected"})
    )
    if repository_status is not None:
        github_api.get("/repositories/10").mock(return_value=Response(repository_status))

    assert (await container.sync.refresh_recent(published_within=WINDOW)).refreshed == 0
    assert await load(container, imported.id) is not None


async def test_unexpected_responses_are_skipped(
    container: Container, github_api: respx.MockRouter, imported: FakeRelease
) -> None:
    github_api.get(imported.refresh_url).mock(return_value=Response(200, json={"id": 10}))

    assert (await container.sync.refresh_recent(published_within=WINDOW)).refreshed == 0
    assert await load(container, imported.id) is not None


async def test_major_versions_are_flagged_as_breaking(
    container: Container, github_api: respx.MockRouter
) -> None:
    releases = [
        FakeRelease(3, 30, "acme/lib", "lib@1.4.0", "2026-09-01T00:00:00Z"),
        FakeRelease(4, 30, "acme/lib", "lib@2.0.0", "2026-09-02T00:00:00Z"),
        FakeRelease(5, 30, "acme/lib", "cli@3.0.0", "2026-09-03T00:00:00Z"),
    ]
    mock_github(github_api, releases)

    await container.sync.sync()

    async with container.session_factory() as session:
        flags = dict(list(await session.execute(select(Release.tag_name, Release.breaking))))
    # cli@3.0.0 is the first release of its component, so there's nothing to compare with.
    assert flags == {"lib@1.4.0": False, "lib@2.0.0": True, "cli@3.0.0": False}
