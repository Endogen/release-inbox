from collections.abc import Sequence
from dataclasses import replace
from datetime import timedelta
from types import SimpleNamespace
from typing import Any

import pytest
import respx
from httpx import AsyncClient, Response

from ghr.container import Container
from ghr.services.summaries import ClaudeSummarizer, ReleaseNotes, SummaryError
from tests.github_fixtures import FakeRelease, mock_github

RELEASE = FakeRelease(1, 10, "acme/app", "v1.0.0", "2026-10-01T10:00:00Z", body="Added a thing")


class FakeSummarizer:
    model = "fake-model"

    def __init__(self) -> None:
        self.calls: list[Sequence[ReleaseNotes]] = []

    async def summarize(self, notes: Sequence[ReleaseNotes]) -> str:
        self.calls.append(notes)
        return f"- {len(notes)} release(s)"

    async def aclose(self) -> None:
        pass


@pytest.fixture
def summarizer(container: Container) -> FakeSummarizer:
    fake = FakeSummarizer()
    # The container is frozen; the summarizer is only read through this attribute.
    object.__setattr__(container, "summarizer", fake)
    return fake


async def test_summaries_are_cached_until_the_notes_change(
    container: Container,
    github_api: respx.MockRouter,
    user_client: AsyncClient,
    summarizer: FakeSummarizer,
) -> None:
    mock_github(github_api, [RELEASE])
    await container.sync.sync()

    first = await user_client.post("/api/summaries", json={"release_ids": [RELEASE.id]})
    second = await user_client.post("/api/summaries", json={"release_ids": [RELEASE.id]})

    assert first.json() == {"content": "- 1 release(s)", "model": "fake-model"}
    assert second.json() == first.json()
    assert len(summarizer.calls) == 1

    edited = replace(RELEASE, body="Added a thing and fixed another")
    github_api.get(RELEASE.api_url).mock(return_value=Response(200, json=edited.release()))
    await container.sync.refresh_recent(published_within=timedelta(days=30))
    await user_client.post("/api/summaries", json={"release_ids": [RELEASE.id]})

    assert len(summarizer.calls) == 2


async def test_unknown_releases_and_missing_configuration(
    container: Container, user_client: AsyncClient
) -> None:
    config = await user_client.get("/api/summaries/config")
    assert config.json() == {"enabled": False, "model": None}

    response = await user_client.post("/api/summaries", json={"release_ids": [1]})

    assert response.status_code == 503
    assert "GHR_ANTHROPIC_API_KEY" in response.json()["detail"]


async def test_rejects_empty_requests(user_client: AsyncClient) -> None:
    response = await user_client.post("/api/summaries", json={"release_ids": []})
    assert response.status_code == 422


class StubMessages:
    def __init__(self, response: Any) -> None:
        self.response = response
        self.kwargs: dict[str, Any] = {}

    async def create(self, **kwargs: Any) -> Any:
        self.kwargs = kwargs
        return self.response


def stub_claude(summarizer: ClaudeSummarizer, response: Any) -> StubMessages:
    messages = StubMessages(response)
    summarizer._client = SimpleNamespace(beta=SimpleNamespace(messages=messages))  # type: ignore[assignment]
    return messages


NOTES = [ReleaseNotes("acme/app", "v1.0.0", "v1.0.0", "2026-10-01", "Added a thing")]


async def test_claude_summarizer_request_and_response() -> None:
    summarizer = ClaudeSummarizer(api_key="test", model="claude-opus-5-5")
    messages = stub_claude(
        summarizer,
        SimpleNamespace(
            stop_reason="end_turn",
            content=[
                SimpleNamespace(type="thinking", thinking=""),
                SimpleNamespace(type="text", text="- Adds a thing\n"),
            ],
        ),
    )

    summary = await summarizer.summarize(NOTES)

    assert summary == "- Adds a thing"
    assert messages.kwargs["model"] == "claude-opus-5-5"
    assert messages.kwargs["fallbacks"] == "default"
    assert messages.kwargs["betas"] == ["server-side-fallback-2026-07-01"]
    assert "<release_notes>" in messages.kwargs["messages"][0]["content"]


async def test_claude_summarizer_reports_refusals() -> None:
    summarizer = ClaudeSummarizer(api_key="test", model="claude-opus-5-5")
    stub_claude(summarizer, SimpleNamespace(stop_reason="refusal", content=[]))

    with pytest.raises(SummaryError, match="declined"):
        await summarizer.summarize(NOTES)


async def test_very_long_notes_are_rejected_instead_of_truncated() -> None:
    summarizer = ClaudeSummarizer(api_key="test", model="claude-opus-5-5")
    stub_claude(summarizer, SimpleNamespace(stop_reason="end_turn", content=[]))
    huge = [replace(NOTES[0], body="x" * 500_000)]

    with pytest.raises(SummaryError, match="too long"):
        await summarizer.summarize(huge)
