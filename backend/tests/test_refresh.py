from dataclasses import replace
from datetime import UTC, datetime, timedelta

import respx
from httpx import Response
from sqlalchemy import select

from ghr.container import Container
from ghr.models import Release
from tests.github_fixtures import FakeRelease, mock_github

RECENT = (datetime.now(UTC) - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
OLD = (datetime.now(UTC) - timedelta(days=60)).strftime("%Y-%m-%dT%H:%M:%SZ")
WINDOW = timedelta(days=14)

BETA = FakeRelease(1, 10, "acme/app", "v2.0.0-beta.1", RECENT, prerelease=True, body="Draft notes")
ANCIENT = FakeRelease(2, 20, "acme/tool", "v1.0.0", OLD)


async def load(container: Container, release_id: int) -> Release | None:
    async with container.session_factory() as session:
        return await session.get(Release, release_id)


async def test_picks_up_edited_notes_and_promotions(
    container: Container, github_api: respx.MockRouter
) -> None:
    mock_github(github_api, [BETA, ANCIENT])
    await container.sync.sync()
    promoted = replace(BETA, prerelease=False, body="Final notes\n\nBREAKING CHANGE: new API")
    route = github_api.get(BETA.api_url).mock(
        return_value=Response(200, json=promoted.release(), headers={"ETag": '"v2"'})
    )
    calls_before = len(github_api.calls)

    changed = await container.sync.refresh_recent(published_within=WINDOW)

    assert changed == 1
    release = await load(container, BETA.id)
    assert release is not None
    assert (release.prerelease, release.body, release.etag) == (False, promoted.body, '"v2"')
    assert release.breaking
    # The refresh is a conditional request; old releases aren't checked at all.
    assert route.calls.last.request.headers["If-None-Match"] == '"v1"'
    refreshed = {str(call.request.url) for call in github_api.calls[calls_before:]}
    assert refreshed == {BETA.api_url}


async def test_unchanged_releases_are_cheap(
    container: Container, github_api: respx.MockRouter
) -> None:
    mock_github(github_api, [BETA])
    await container.sync.sync()
    github_api.get(BETA.api_url).mock(return_value=Response(304))

    assert await container.sync.refresh_recent(published_within=WINDOW) == 0


async def test_deleted_releases_are_removed(
    container: Container, github_api: respx.MockRouter
) -> None:
    mock_github(github_api, [BETA])
    await container.sync.sync()
    github_api.get(BETA.api_url).mock(return_value=Response(404))

    assert await container.sync.refresh_recent(published_within=WINDOW) == 1
    assert await load(container, BETA.id) is None


async def test_major_versions_are_flagged_as_breaking(
    container: Container, github_api: respx.MockRouter
) -> None:
    old = FakeRelease(3, 30, "acme/lib", "lib@1.4.0", "2026-09-01T00:00:00Z")
    new = FakeRelease(4, 30, "acme/lib", "lib@2.0.0", "2026-09-02T00:00:00Z")
    other = FakeRelease(5, 30, "acme/lib", "cli@3.0.0", "2026-09-03T00:00:00Z")
    mock_github(github_api, [old, new, other])

    await container.sync.sync()

    async with container.session_factory() as session:
        rows = await session.execute(select(Release.tag_name, Release.breaking))
        flags = {tag: flag for tag, flag in rows}
    # cli@3.0.0 is the first release of its component, so there's nothing to compare with.
    assert flags == {"lib@1.4.0": False, "lib@2.0.0": True, "cli@3.0.0": False}
