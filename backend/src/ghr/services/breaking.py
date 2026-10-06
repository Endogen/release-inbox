"""Detects releases that are likely to break existing users."""

import re
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Protocol

# "Breaking changes" headings and "breaking change" mentions, in any case.
_BREAKING_CHANGES = re.compile(r"breaking[\s_-]+changes?", re.IGNORECASE)
# An upper-case "BREAKING" marker, or a conventional-commit entry like "feat!:" / "fix(api)!:".
_BREAKING_MARKERS = re.compile(r"\bBREAKING\b|^\s*[-*]?\s*\w+(?:\([^)]*\))?!:", re.MULTILINE)
# A version starts where a digit (optionally prefixed by "v") begins a new word.
_VERSION = re.compile(r"(?<![a-z0-9])v?(?P<major>\d+)(?:\.(?P<minor>\d+))?(?:\.\d+)?", re.I)


@dataclass(frozen=True, slots=True)
class ComponentVersion:
    """``web@2.1.0`` → component ``web@``, major 2, minor 1."""

    component: str
    major: int
    minor: int


def parse_version(tag: str) -> ComponentVersion | None:
    match = _VERSION.search(tag)
    if match is None:
        return None
    return ComponentVersion(
        component=tag[: match.start()].lower(),
        major=int(match["major"]),
        minor=int(match["minor"] or 0),
    )


def mentions_breaking_changes(body: str | None) -> bool:
    if not body:
        return False
    return bool(_BREAKING_CHANGES.search(body) or _BREAKING_MARKERS.search(body))


def is_major_bump(current: ComponentVersion, previous: ComponentVersion | None) -> bool:
    """A new major version of the same component; ``0.x`` releases are not considered."""
    return (
        previous is not None
        and current.component == previous.component
        and current.major >= 1
        and current.major > previous.major
    )


class ClassifiableRelease(Protocol):
    tag_name: str
    body: str | None
    breaking: bool


def classify(releases_oldest_first: Iterable[ClassifiableRelease]) -> None:
    """Set ``breaking`` on releases of one repository, given in publication order."""
    latest_by_component: dict[str, ComponentVersion] = {}
    for release in releases_oldest_first:
        version = parse_version(release.tag_name)
        previous = latest_by_component.get(version.component) if version else None
        release.breaking = mentions_breaking_changes(release.body) or (
            version is not None and is_major_bump(version, previous)
        )
        if version is not None:
            latest_by_component[version.component] = version
