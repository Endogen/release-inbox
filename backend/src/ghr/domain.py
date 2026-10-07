"""Domain vocabulary shared by the models, the services and the API."""

from enum import StrEnum


class View(StrEnum):
    """Where a release shows up in the app. Every release is in exactly one view."""

    INBOX = "inbox"
    SNOOZED = "snoozed"
    READ = "read"
    HIDDEN = "hidden"


class PrereleaseMode(StrEnum):
    """How pre-releases (betas, release candidates, nightlies) are treated."""

    #: Like any other release.
    SHOW = "show"
    #: In the inbox, but without notifications.
    MUTE = "mute"
    #: Moved to the Hidden view, without notifications.
    HIDE = "hide"


class NotifyAbout(StrEnum):
    """Which new releases send a notification."""

    ALL = "all"
    #: Only releases with breaking changes.
    BREAKING = "breaking"
