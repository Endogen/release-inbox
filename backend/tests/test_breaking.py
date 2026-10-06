from dataclasses import dataclass

import pytest

from ghr.services.breaking import (
    ComponentVersion,
    classify,
    is_major_bump,
    mentions_breaking_changes,
    parse_version,
)


@dataclass
class FakeRelease:
    tag_name: str
    body: str | None = None
    breaking: bool = False


@pytest.mark.parametrize(
    ("body", "expected"),
    [
        ("## Breaking changes\n- Removed the v1 API", True),
        ("BREAKING CHANGE: config moved", True),
        ("* feat!: drop Node 18 by @someone", True),
        ("- fix(core)!: new defaults", True),
        ("Fixed a crash that was breaking the build in rare cases", False),
        ("Bug fixes and performance improvements", False),
        (None, False),
    ],
)
def test_detects_breaking_notes(body: str | None, expected: bool) -> None:
    assert mentions_breaking_changes(body) is expected


@pytest.mark.parametrize(
    ("tag", "expected"),
    [
        ("v1.2.3", ComponentVersion("", 1, 2)),
        ("web@2.0.0", ComponentVersion("web@", 2, 0)),
        ("@scope/pkg@10.1.0-rc.1", ComponentVersion("@scope/pkg@", 10, 1)),
        ("release-2026.10", ComponentVersion("release-", 2026, 10)),
        ("v3060", None),
        ("nightly", None),
    ],
)
def test_parses_component_and_version(tag: str, expected: ComponentVersion | None) -> None:
    assert parse_version(tag) == expected


def test_major_bump_requires_same_component_and_stable_major() -> None:
    assert is_major_bump(ComponentVersion("", 2, 0), ComponentVersion("", 1, 9))
    assert not is_major_bump(ComponentVersion("", 0, 9), ComponentVersion("", 0, 8))
    assert not is_major_bump(ComponentVersion("a@", 2, 0), ComponentVersion("b@", 1, 0))
    assert not is_major_bump(ComponentVersion("", 2, 0), None)
    # Calendar versions roll over every year; that's not a breaking change.
    assert not is_major_bump(ComponentVersion("", 2027, 1), ComponentVersion("", 2026, 12))


def test_build_numbers_are_not_versions() -> None:
    releases = [FakeRelease("v2975"), FakeRelease("v3037"), FakeRelease("v3060")]

    classify(releases)

    assert not any(release.breaking for release in releases)


def test_classify_tracks_components_in_order() -> None:
    releases = [
        FakeRelease("v1.0.0"),
        FakeRelease("v1.1.0"),
        FakeRelease("v2.0.0"),
        FakeRelease("v2.1.0", body="BREAKING: dropped the old flag"),
    ]

    classify(releases)

    assert [release.breaking for release in releases] == [False, False, True, True]
