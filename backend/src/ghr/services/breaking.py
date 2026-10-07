"""Detects releases that are likely to break existing users."""

import re
from collections.abc import Iterable
from dataclasses import dataclass
from typing import NamedTuple

# "Breaking changes" headings and mentions in any case, but not "no breaking changes".
_BREAKING_CHANGES = re.compile(r"(?<!no )(?<!without )breaking[\s_-]+changes?", re.IGNORECASE)
# An upper-case "BREAKING" marker, or a conventional-commit entry like "feat!:" / "fix(api)!:".
_BREAKING_MARKERS = re.compile(r"\bBREAKING\b|^\s*[-*]?\s*\w+(?:\([^)]*\))?!:", re.MULTILINE)
# A dotted version ("1.2", "v2.0.1") starting where a digit (optionally after "v") begins a
# word. Single numbers ("v57") are build counters, not semantic versions.
_VERSION = re.compile(r"(?<![a-z0-9])v?(?P<major>\d+)\.\d+", re.I)
# Majors this large are build numbers or calendar versions (2026.10), not semantic versions.
_MAX_SEMANTIC_MAJOR = 999


@dataclass(frozen=True, slots=True)
class ComponentVersion:
    """``web@2.1.0`` → component ``web@``, major 2."""

    component: str
    major: int


def parse_version(tag: str) -> ComponentVersion | None:
    match = _VERSION.search(tag)
    if match is None:
        return None
    return ComponentVersion(component=tag[: match.start()].lower(), major=int(match["major"]))


def mentions_breaking_changes(body: str | None) -> bool:
    if not body:
        return False
    return bool(_BREAKING_CHANGES.search(body) or _BREAKING_MARKERS.search(body))


def _is_semantic_major(major: int) -> bool:
    """``0.x`` releases make no compatibility promise; huge majors are calendar versions."""
    return 1 <= major <= _MAX_SEMANTIC_MAJOR


class VersionNotes(NamedTuple):
    tag_name: str
    body: str | None
    prerelease: bool


def breaking_flags(releases_oldest_first: Iterable[VersionNotes]) -> list[bool]:
    """Whether each release of one repository is breaking, given in publication order.

    A release is breaking if its notes say so, or if it is a new major version of its
    component: higher than any stable release before it (or any release, while there is no
    stable one yet). Backports (2.0.0, then 1.9.1, then 2.0.1) therefore aren't new majors, and
    the stable 2.0.0 after 2.0.0-rc.1 still is, for those who skip pre-releases.
    """
    highest_stable: dict[str, int] = {}
    highest_any: dict[str, int] = {}
    flags: list[bool] = []
    for tag_name, body, prerelease in releases_oldest_first:
        version = parse_version(tag_name)
        new_major = False
        if version is not None:
            component = version.component
            baseline = highest_stable.get(component, highest_any.get(component))
            new_major = (
                baseline is not None
                and version.major > baseline
                and _is_semantic_major(version.major)
            )
            highest_any[component] = max(highest_any.get(component, 0), version.major)
            if not prerelease:
                highest_stable[component] = max(highest_stable.get(component, 0), version.major)
        flags.append(new_major or mentions_breaking_changes(body))
    return flags
