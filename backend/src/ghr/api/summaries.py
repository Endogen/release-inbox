from typing import Annotated

from fastapi import APIRouter, Query

from ghr.api.deps import ContainerDep, SummaryServiceDep
from ghr.errors import NotFoundError
from ghr.schemas import MAX_SUMMARIZED_RELEASES, SummaryConfig, SummaryOut, SummaryRequest

router = APIRouter(prefix="/summaries", tags=["summaries"])


@router.get("/config")
async def get_summary_config(container: ContainerDep) -> SummaryConfig:
    summarizer = container.summarizer
    return SummaryConfig(
        enabled=summarizer is not None, model=summarizer.model if summarizer else None
    )


@router.get("")
async def find_summary(
    summaries: SummaryServiceDep,
    release_ids: Annotated[list[int], Query(min_length=1, max_length=MAX_SUMMARIZED_RELEASES)],
) -> SummaryOut:
    """The cached summary of these releases; 404 if none was created yet."""
    summary = await summaries.find(release_ids)
    if summary is None:
        raise NotFoundError("Summary", ",".join(map(str, release_ids)))
    return summary


@router.post("")
async def summarize(payload: SummaryRequest, summaries: SummaryServiceDep) -> SummaryOut:
    """Summarize the notes of one or more releases with Claude. Results are cached."""
    return await summaries.summarize(payload.release_ids)
