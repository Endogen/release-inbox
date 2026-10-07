"""Decides what to announce and fans notifications out to every configured channel."""

import asyncio
import logging
from collections.abc import Sequence
from dataclasses import replace

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import contains_eager

from ghr.domain import NotifyAbout, PrereleaseMode, View
from ghr.models import Release, Repository
from ghr.services.filters import is_hidden
from ghr.services.notifications.message import (
    GITHUB_NOTIFICATIONS_URL,
    Notification,
    NotificationChannel,
)
from ghr.services.preferences import load_preferences
from ghr.services.releases import ReleaseQueries

logger = logging.getLogger(__name__)

_MAX_NAMES_IN_SUMMARY = 3


class Notifier:
    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        channels: Sequence[NotificationChannel],
    ) -> None:
        self._session_factory = session_factory
        self._channels = tuple(channels)

    @property
    def channels(self) -> tuple[NotificationChannel, ...]:
        return self._channels

    async def send(self, notification: Notification) -> dict[str, bool]:
        """Deliver to every configured channel. Returns per-channel success."""
        configured = [channel for channel in self._channels if channel.configured]
        results = await asyncio.gather(
            *(channel.send(notification) for channel in configured), return_exceptions=True
        )
        outcome: dict[str, bool] = {}
        for channel, result in zip(configured, results, strict=True):
            if isinstance(result, BaseException):
                logger.error("Notification channel %s failed", channel.name, exc_info=result)
                outcome[channel.name] = False
            else:
                outcome[channel.name] = result
        return outcome

    async def send_test(self) -> dict[str, bool]:
        return await self.send(
            Notification(
                title="Notifications are on",
                body="You'll be notified here when a new release is published.",
                path="/inbox",
                external_url=GITHUB_NOTIFICATIONS_URL,
                tag="test",
            )
        )

    async def announce_new_releases(self, release_ids: Sequence[int]) -> None:
        """Announce new releases, except hidden ones, those of muted repositories,
        pre-releases unless the user shows them normally, and releases without breaking
        changes if the user only wants to hear about those."""
        async with self._session_factory() as session:
            preferences = await load_preferences(session)
            mode = preferences.prereleases
            statement = (
                select(Release)
                .join(Release.repository)
                .options(contains_eager(Release.repository))
                .where(
                    Release.id.in_(release_ids),
                    Repository.notifications_muted_at.is_(None),
                    ~is_hidden(mode),
                )
                .order_by(Release.published_at.desc())
            )
            if mode is not PrereleaseMode.SHOW:
                statement = statement.where(Release.prerelease.is_(False))
            if preferences.notify_about is NotifyAbout.BREAKING:
                statement = statement.where(Release.breaking.is_(True))
            releases = list(await session.scalars(statement))
        if releases:
            await self._announce(_new_releases_notification(releases))

    async def announce_snooze_ended(self, releases: Sequence[Release]) -> None:
        """Remind about snoozed releases; the user asked for this, so mutes don't apply."""
        if releases:
            await self._announce(_snooze_ended_notification(releases))

    async def _announce(self, notification: Notification) -> None:
        """Send with the number of inbox entries, which installed apps show on their icon
        unless the user turned that off."""
        async with self._session_factory() as session:
            preferences = await load_preferences(session)
            unread = (
                await ReleaseQueries(session).count(View.INBOX) if preferences.app_badge else None
            )
        await self.send(replace(notification, unread=unread))


def _title(release: Release) -> str:
    return release.name or release.tag_name


def _new_releases_notification(releases: Sequence[Release]) -> Notification:
    if len(releases) == 1:
        release = releases[0]
        return Notification(
            title=release.repository.full_name,
            body=f"{_title(release)} was released"
            + (" · may contain breaking changes" if release.breaking else ""),
            path=f"/inbox?release={release.id}",
            external_url=release.html_url,
            tag=f"release-{release.id}",
        )
    return Notification(
        title=f"{len(releases)} new releases",
        body=_summarise_names(releases),
        path="/inbox",
        external_url=GITHUB_NOTIFICATIONS_URL,
        tag="releases",
    )


def _snooze_ended_notification(releases: Sequence[Release]) -> Notification:
    if len(releases) == 1:
        release = releases[0]
        return Notification(
            title=f"Back from snooze: {release.repository.full_name}",
            body=_title(release),
            path=f"/inbox?release={release.id}",
            external_url=release.html_url,
            tag=f"snooze-{release.id}",
        )
    return Notification(
        title=f"{len(releases)} snoozed releases are back",
        body=_summarise_names(releases),
        path="/inbox",
        external_url=GITHUB_NOTIFICATIONS_URL,
        tag="snooze",
    )


def _summarise_names(releases: Sequence[Release]) -> str:
    names = [release.repository.full_name for release in releases[:_MAX_NAMES_IN_SUMMARY]]
    remaining = len(releases) - len(names)
    return ", ".join(names) + (f" and {remaining} more" if remaining else "")
