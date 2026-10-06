from fastapi import APIRouter

from ghr.api.deps import ContainerDep, SummaryServiceDep
from ghr.schemas import SummaryConfig, SummaryOut, SummaryRequest

router = APIRouter(prefix="/summaries", tags=["summaries"])


@router.get("/config")
async def get_summary_config(container: ContainerDep) -> SummaryConfig:
    summarizer = container.summarizer
    return SummaryConfig(
        enabled=summarizer is not None, model=summarizer.model if summarizer else None
    )


@router.post("")
async def summarize(payload: SummaryRequest, summaries: SummaryServiceDep) -> SummaryOut:
    """Summarize the notes of one or more releases with Claude. Results are cached."""
    return await summaries.summarize(payload.release_ids)
