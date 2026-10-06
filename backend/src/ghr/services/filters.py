"""Reusable SQL expressions for selecting releases by view, hide rules and search terms."""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from sqlalchemy import ColumnElement, and_, exists, func, or_

from ghr.models import HideRule, Release, Repository

_LIKE_ESCAPE = "\\"


class View(StrEnum):
    INBOX = "inbox"
    SNOOZED = "snoozed"
    READ = "read"
    HIDDEN = "hidden"


@dataclass(frozen=True, slots=True)
class ViewContext:
    """Inputs that decide which releases a view contains, besides the view itself."""

    now: datetime
    include_prereleases: bool = True


def glob_matches(
    value: ColumnElement[str], pattern: ColumnElement[str] | str
) -> ColumnElement[bool]:
    """Case-insensitive SQLite GLOB (``*``, ``?`` and ``[...]`` wildcards)."""
    return func.lower(value).op("GLOB")(func.lower(pattern))


def matches_pattern(pattern: ColumnElement[str] | str) -> ColumnElement[bool]:
    """True if the release name or tag matches the given glob pattern."""
    return or_(
        glob_matches(func.coalesce(Release.name, ""), pattern),
        glob_matches(Release.tag_name, pattern),
    )


def is_hidden() -> ColumnElement[bool]:
    """True if any hide rule of the release's repository matches the release."""
    return exists().where(
        HideRule.repository_id == Release.repository_id,
        matches_pattern(HideRule.pattern),
    )


def is_snoozed(now: datetime) -> ColumnElement[bool]:
    return and_(Release.snoozed_until.is_not(None), Release.snoozed_until > now)


def in_view(view: View, context: ViewContext) -> ColumnElement[bool]:
    """Filter for releases belonging to a view. Requires ``Repository`` to be joined.

    Unread releases of unsubscribed repositories only exist if the user marked them unread
    again, so they belong in the inbox like any other unread release.
    """
    match view:
        case View.INBOX:
            condition = and_(Release.read_at.is_(None), ~is_snoozed(context.now), ~is_hidden())
        case View.SNOOZED:
            condition = and_(Release.read_at.is_(None), is_snoozed(context.now), ~is_hidden())
        case View.READ:
            condition = and_(Release.read_at.is_not(None), ~is_hidden())
        case View.HIDDEN:
            condition = is_hidden()
    if not context.include_prereleases and view is not View.HIDDEN:
        condition = and_(condition, Release.prerelease.is_(False))
    return condition


def matches_search(query: str | None) -> ColumnElement[bool] | None:
    """Every whitespace-separated term must appear in the repository, name, tag or notes."""
    terms = (query or "").split()
    if not terms:
        return None
    return and_(*(_term_matches(term) for term in terms))


def _term_matches(term: str) -> ColumnElement[bool]:
    like = f"%{_escape_like(term)}%"
    return or_(
        Repository.full_name.ilike(like, escape=_LIKE_ESCAPE),
        Release.name.ilike(like, escape=_LIKE_ESCAPE),
        Release.tag_name.ilike(like, escape=_LIKE_ESCAPE),
        Release.body.ilike(like, escape=_LIKE_ESCAPE),
    )


def _escape_like(term: str) -> str:
    return (
        term.replace(_LIKE_ESCAPE, _LIKE_ESCAPE * 2)
        .replace("%", f"{_LIKE_ESCAPE}%")
        .replace("_", f"{_LIKE_ESCAPE}_")
    )
