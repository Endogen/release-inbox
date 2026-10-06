"""AI summaries of release notes, generated with Claude on request and cached."""

import hashlib
import logging
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

import anthropic
from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ghr.db import utcnow
from ghr.errors import NotFoundError
from ghr.models import Release, Summary
from ghr.schemas import SummaryOut

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You summarize software release notes for a developer deciding whether and how to upgrade.

Write 3 to 7 short markdown bullet points covering what matters most: breaking changes and \
required migration steps first, then notable features, then important fixes. Mention versions \
when several releases are summarized together. Skip contributor lists, dependency bumps and \
housekeeping unless they affect users. If the notes say little, say so in one bullet. Answer \
with the bullet points only."""

# Summaries are short; the headroom also covers the model's thinking.
_MAX_TOKENS = 4096
# Roughly 100k tokens: far more than typical release notes, and a predictable cost ceiling.
_MAX_NOTES_CHARACTERS = 400_000


class SummaryError(Exception):
    """The summary couldn't be created; the message is safe to show to the user."""


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


class ClaudeSummarizer:
    def __init__(self, *, api_key: str, model: str) -> None:
        self._client = anthropic.AsyncAnthropic(api_key=api_key, timeout=120.0)
        self._model = model

    @property
    def model(self) -> str:
        return self._model

    async def aclose(self) -> None:
        await self._client.close()

    async def summarize(self, notes: Sequence[ReleaseNotes]) -> str:
        try:
            response = await self._client.beta.messages.create(
                model=self._model,
                max_tokens=_MAX_TOKENS,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": _format_notes(notes)}],
                output_config={"effort": "low"},
                # Retries a declined request on Anthropic's recommended fallback model.
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
            )
        except anthropic.AuthenticationError as error:
            raise SummaryError("The Anthropic API key is invalid.") from error
        except anthropic.RateLimitError as error:
            raise SummaryError("Claude is rate limited right now. Try again shortly.") from error
        except anthropic.APIStatusError as error:
            logger.warning("Summary request failed: %s", error)
            raise SummaryError("Claude couldn't create a summary. Try again later.") from error
        except anthropic.APIConnectionError as error:
            raise SummaryError("Couldn't reach the Claude API.") from error

        if response.stop_reason == "refusal":
            raise SummaryError("Claude declined to summarize these release notes.")
        text = "".join(block.text for block in response.content if block.type == "text").strip()
        if not text:
            raise SummaryError("Claude returned an empty summary.")
        return text


class SummaryService:
    def __init__(self, session: AsyncSession, summarizer: Summarizer | None) -> None:
        self._session = session
        self._summarizer = summarizer

    async def summarize(self, release_ids: Sequence[int]) -> SummaryOut:
        if self._summarizer is None:
            raise SummaryError("Summaries aren't configured. Set GHR_ANTHROPIC_API_KEY.")

        releases = list(
            await self._session.scalars(
                select(Release)
                .options(selectinload(Release.repository))
                .where(Release.id.in_(release_ids))
                .order_by(Release.published_at.desc())
            )
        )
        missing = set(release_ids) - {release.id for release in releases}
        if missing:
            raise NotFoundError("Release", sorted(missing)[0])

        notes = [_notes(release) for release in releases]
        key = _cache_key(self._summarizer.model, notes)
        if cached := await self._session.get(Summary, key):
            return SummaryOut(content=cached.content, model=cached.model)

        content = await self._summarizer.summarize(notes)
        statement = sqlite_insert(Summary).values(
            key=key, content=content, model=self._summarizer.model, created_at=utcnow()
        )
        await self._session.execute(statement.on_conflict_do_nothing())
        await self._session.commit()
        return SummaryOut(content=content, model=self._summarizer.model)


def _notes(release: Release) -> ReleaseNotes:
    return ReleaseNotes(
        repository=release.repository.full_name,
        title=release.name or release.tag_name,
        tag=release.tag_name,
        published=release.published_at.date().isoformat(),
        body=(release.body or "").strip() or "(no release notes)",
    )


def _format_notes(notes: Sequence[ReleaseNotes]) -> str:
    sections = [
        f"## {item.repository} {item.title} ({item.tag}, {item.published})\n\n{item.body}"
        for item in notes
    ]
    text = "\n\n---\n\n".join(sections)
    if len(text) > _MAX_NOTES_CHARACTERS:
        raise SummaryError("These release notes are too long to summarize. Pick fewer releases.")
    return f"<release_notes>\n{text}\n</release_notes>"


def _cache_key(model: str, notes: Sequence[ReleaseNotes]) -> str:
    digest = hashlib.sha256(model.encode())
    for item in notes:
        digest.update(f"\0{item.tag}\0{item.title}\0{item.body}".encode())
    return digest.hexdigest()
