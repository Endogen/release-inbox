"""AI summaries of release notes, generated on request (``ghr.services.claude``) and cached."""

import hashlib
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ghr.errors import ConflictError, InvalidRequestError, NotFoundError
from ghr.models import Release, Summary
from ghr.schemas import SummaryOut

# Roughly 100k tokens: far more than typical release notes, and a predictable cost ceiling.
_MAX_NOTES_CHARACTERS = 400_000


@dataclass(frozen=True, slots=True)
class ReleaseNotes:
    repository: str
    title: str
    tag: str
    published: str
    body: str


class Summarizer(Protocol):
    @property
    def model(self) -> str: ...

    async def summarize(self, notes: Sequence[ReleaseNotes]) -> str: ...

    async def aclose(self) -> None: ...


class SummaryService:
    def __init__(self, session: AsyncSession, summarizer: Summarizer | None) -> None:
        self._session = session
        self._summarizer = summarizer

    async def find(self, release_ids: Sequence[int]) -> SummaryOut | None:
        """The cached summary of these releases, if one was created before."""
        summarizer = self._require_summarizer()
        notes = await self._load_notes(release_ids)
        cached = await self._session.get(Summary, _cache_key(summarizer.model, notes))
        return SummaryOut(content=cached.content, model=cached.model) if cached else None

    async def summarize(self, release_ids: Sequence[int]) -> SummaryOut:
        """Summarize the releases with Claude, or return the cached summary."""
        summarizer = self._require_summarizer()
        notes = await self._load_notes(release_ids)
        key = _cache_key(summarizer.model, notes)
        if cached := await self._session.get(Summary, key):
            return SummaryOut(content=cached.content, model=cached.model)

        content = await summarizer.summarize(notes)
        statement = sqlite_insert(Summary).values(key=key, content=content, model=summarizer.model)
        await self._session.execute(statement.on_conflict_do_nothing())
        await self._session.commit()
        return SummaryOut(content=content, model=summarizer.model)

    def _require_summarizer(self) -> Summarizer:
        if self._summarizer is None:
            raise ConflictError("Summaries aren't configured. Set GHR_ANTHROPIC_API_KEY.")
        return self._summarizer

    async def _load_notes(self, release_ids: Sequence[int]) -> list[ReleaseNotes]:
        releases = list(
            await self._session.scalars(
                select(Release)
                .options(selectinload(Release.repository))
                .where(Release.id.in_(release_ids))
                .order_by(Release.published_at.desc(), Release.id.desc())
            )
        )
        missing = set(release_ids) - {release.id for release in releases}
        if missing:
            raise NotFoundError("Release", min(missing))
        return [_notes(release) for release in releases]


def _notes(release: Release) -> ReleaseNotes:
    return ReleaseNotes(
        repository=release.repository.full_name,
        title=release.name or release.tag_name,
        tag=release.tag_name,
        published=release.published_at.date().isoformat(),
        body=(release.body or "").strip() or "(no release notes)",
    )


def format_notes(notes: Sequence[ReleaseNotes]) -> str:
    """The notes as one prompt; raises ``InvalidRequestError`` if they are too long."""
    sections = [
        f"## {item.repository} {item.title} ({item.tag}, {item.published})\n\n{item.body}"
        for item in notes
    ]
    text = "\n\n---\n\n".join(sections)
    if len(text) > _MAX_NOTES_CHARACTERS:
        raise InvalidRequestError(
            "These release notes are too long to summarize. Pick fewer releases."
        )
    return f"<release_notes>\n{text}\n</release_notes>"


def _cache_key(model: str, notes: Sequence[ReleaseNotes]) -> str:
    digest = hashlib.sha256(model.encode())
    for item in notes:
        digest.update(f"\0{item.tag}\0{item.title}\0{item.body}".encode())
    return digest.hexdigest()
