"""Files attached to releases.

They arrive with the release data the sync fetches anyway. Releases stored before the app kept
them have none recorded yet (``None``); those are fetched once, when first asked for.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from ghr.db import get_existing
from ghr.github.client import FetchedRelease, GitHubClient
from ghr.github.models import GitHubRelease
from ghr.models import Release, StoredAsset
from ghr.schemas import ReleaseAssetOut


class ReleaseAssetService:
    def __init__(self, session: AsyncSession, github: GitHubClient) -> None:
        self._session = session
        self._github = github

    async def list(self, release_id: int) -> list[ReleaseAssetOut]:
        release = await get_existing(self._session, Release, release_id, "Release")
        if release.assets is None:
            # The stored ETag stays: it belongs to the fields the refresh compares.
            fetched = await self._github.get_release(
                GitHubClient.release_path(release.repository_id, release.id)
            )
            release.assets = (
                asset_records(fetched.release) if isinstance(fetched, FetchedRelease) else []
            )
            await self._session.commit()
        return [ReleaseAssetOut.model_validate(asset) for asset in release.assets]


def asset_records(release: GitHubRelease) -> list[StoredAsset]:
    """The uploaded files of a release, as stored with it."""
    return [
        StoredAsset(
            id=asset.id,
            name=asset.name,
            size=asset.size,
            download_count=asset.download_count,
            url=asset.browser_download_url,
            content_type=asset.content_type,
        )
        for asset in release.assets
        if asset.state == "uploaded"
    ]
