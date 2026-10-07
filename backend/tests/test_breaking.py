"""Breaking-change detection."""

from dataclasses import dataclass

import pytest

from ghr.services.breaking import (
    ComponentVersion,
    VersionNotes,
    breaking_flags,
    mentions_breaking_changes,
    parse_version,
)


@dataclass
class Classifiable:
    tag_name: str
    body: str | None = None
    prerelease: bool = False


def flags(*releases: Classifiable) -> list[bool]:
    return breaking_flags(
        VersionNotes(release.tag_name, release.body, release.prerelease) for release in releases
    )


@pytest.mark.parametrize(
    ("body", "expected"),
    [
        ("## Breaking changes\n- Removed the v1 API", True),
        ("### ⚠ BREAKING CHANGES", True),
        ("BREAKING CHANGE: config moved", True),
        ("* feat!: drop Node 18 by @someone", True),
        ("- fix(core)!: new defaults", True),
        ("No breaking changes in this release.", False),
        ("Upgrade without breaking changes.", False),
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
        ("v1.2.3", ComponentVersion("", 1)),
        ("web@2.0.0", ComponentVersion("web@", 2)),
        ("@scope/pkg@10.1.0-rc.1", ComponentVersion("@scope/pkg@", 10)),
        ("release-2026.10", ComponentVersion("release-", 2026)),
        ("v3060", None),
        ("nightly", None),
    ],
)
def test_parses_component_and_major(tag: str, expected: ComponentVersion | None) -> None:
    assert parse_version(tag) == expected


def test_new_major_versions_per_component() -> None:
    assert flags(
        Classifiable("web@1.0.0"),
        Classifiable("api@1.0.0"),
        Classifiable("web@2.0.0"),
        Classifiable("api@1.1.0"),
    ) == [False, False, True, False]


def test_the_stable_release_of_a_new_major_is_breaking_after_its_prereleases() -> None:
    assert flags(
        Classifiable("v1.9.0"),
        Classifiable("v2.0.0-rc.1", prerelease=True),
        Classifiable("v2.0.0"),
        Classifiable("v2.0.1"),
    ) == [False, True, True, False]
    # Without an earlier major, a release candidate's stable release is nothing new.
    assert flags(Classifiable("v2.0.0-rc.1", prerelease=True), Classifiable("v2.0.0")) == [
        False,
        False,
    ]


def test_backports_are_not_new_majors() -> None:
    assert flags(Classifiable("v2.0.0"), Classifiable("v1.9.1"), Classifiable("v2.0.1")) == [
        False,
        False,
        False,
    ]


@pytest.mark.parametrize(
    "tags",
    [
        ("v0.9.0", "v0.10.0"),  # 0.x makes no compatibility promise
        ("v2975", "v3037", "v3060"),  # build numbers
        ("2026.12.1", "2027.1.0"),  # calendar versions roll over every year
    ],
)
def test_ignores_non_semantic_versions(tags: tuple[str, ...]) -> None:
    assert not any(flags(*(Classifiable(tag) for tag in tags)))


def test_notes_flag_any_release() -> None:
    assert flags(
        Classifiable("v1.0.0"), Classifiable("v1.1.0", body="BREAKING: dropped a flag")
    ) == [
        False,
        True,
    ]
