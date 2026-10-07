"""Release note summaries by Claude.

Only imported when an Anthropic API key is set: the SDK takes seconds to load.
"""

import logging
from collections.abc import Sequence

import anthropic

from ghr.errors import SummaryError
from ghr.services.summaries import ReleaseNotes, format_notes

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
                messages=[{"role": "user", "content": format_notes(notes)}],
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
