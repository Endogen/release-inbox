from typing import Annotated

from fastapi import APIRouter, Query, status

from ghr.api.deps import HideRuleServiceDep
from ghr.schemas import HidePattern, HideRuleCreate, HideRuleOut, HideRulePreview

router = APIRouter(prefix="/hide-rules", tags=["hide rules"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_hide_rule(payload: HideRuleCreate, rules: HideRuleServiceDep) -> HideRuleOut:
    return await rules.create(payload.repository_id, payload.pattern)


@router.get("/preview")
async def preview_hide_rule(
    rules: HideRuleServiceDep,
    repository_id: int,
    pattern: Annotated[HidePattern, Query()],
) -> HideRulePreview:
    """Releases that a rule with this pattern would hide."""
    return await rules.preview(repository_id, pattern)


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_hide_rule(rule_id: int, rules: HideRuleServiceDep) -> None:
    await rules.delete(rule_id)
