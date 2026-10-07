"""Reusable SQL expressions for selecting releases by view, hide rules and search terms."""

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import ColumnElement, SQLColumnExpression, and_, exists, false, func, or_, true

from ghr.domain import PrereleaseMode, View
from ghr.models import HideRule, Release, Repository

_LIKE_ESCAPE = "\\"


@dataclass(frozen=True, slots=True)
class ViewContext:
    """Inputs that decide which view a release is in, besides its own state."""

    now: datetime
    prereleases: PrereleaseMode


def _glob_matches(
    value: SQLColumnExpression[str], pattern: SQLColumnExpression[str] | str
) -> ColumnElement[bool]:
    """Case-insensitive SQLite GLOB (``*``, ``?`` and ``[...]`` wildcards)."""
    return func.lower(value).op("GLOB")(func.lower(pattern))


def matches_pattern(pattern: SQLColumnExpression[str] | str) -> ColumnElement[bool]:
    """True if the release name or tag matches the given glob pattern."""
    return or_(
        _glob_matches(func.coalesce(Release.name, ""), pattern),
        _glob_matches(Release.tag_name, pattern),
    )


def is_hidden(prereleases: PrereleaseMode) -> ColumnElement[bool]:
    """True if a hide rule matches the release, or it is a pre-release and those are hidden."""
    matches_rule = exists().where(
        HideRule.repository_id == Release.repository_id,
        matches_pattern(HideRule.pattern),
    )
    hidden_prerelease = Release.prerelease if prereleases is PrereleaseMode.HIDE else false()
    return or_(matches_rule, hidden_prerelease)


def _is_snoozed(now: datetime) -> ColumnElement[bool]:
    return and_(Release.snoozed_until.is_not(None), Release.snoozed_until > now)


def in_view(view: View, context: ViewContext) -> ColumnElement[bool]:
    """Filter for the releases of a view; every release is in exactly one view.

    Hidden wins over everything else. Unread releases of unsubscribed repositories only
    exist if the user marked them unread again, so they belong in the inbox like any other.
    """
    hidden = is_hidden(context.prereleases)
    match view:
        case View.HIDDEN:
            return hidden
        case View.INBOX:
            return and_(Release.read_at.is_(None), ~_is_snoozed(context.now), ~hidden)
        case View.SNOOZED:
            return and_(Release.read_at.is_(None), _is_snoozed(context.now), ~hidden)
        case View.READ:
            return and_(Release.read_at.is_not(None), ~hidden)


def matches_search(query: str | None) -> ColumnElement[bool]:
    """Every whitespace-separated term must appear in the repository, name, tag or notes. No
    terms match everything.

    Requires ``Repository`` to be joined.
    """
    return and_(true(), *(_term_matches(term) for term in (query or "").split()))


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
