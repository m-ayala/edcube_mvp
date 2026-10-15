# backend/routes/knowledge_base.py
"""
Read-only knowledge-base / taxonomy endpoints.

The frontend reaches taxonomy data through these routes instead of reading
Firestore directly. Nothing here writes to Firestore or hardcodes taxonomy values.
Sources:
  - /objectives: services/knowledge_base_service.py (Firestore KB).
  - /block-subtypes: Python constants in outliner/block_prompts.py (the canonical
    block-format taxonomy shared by the outliner and generation prompts).
  - /taxonomy: the Course Builder taxonomy (services/knowledge_base_service.get_taxonomy).

All routes use `require_org` (token + registered org), matching main's convention
for KB reads. Only backend-agent's seeder writes the KB.
"""

from typing import Optional

from fastapi import APIRouter, Depends

from routes.teachers import require_org
from services import knowledge_base_service
from outliner.block_prompts import (
    CONTENT_SUBTYPES,
    WORKSHEET_SUBTYPES,
    ACTIVITY_SUBTYPES,
    WORKSHEET_SUBTYPE_COMPATIBILITY,
)

router = APIRouter(prefix="/api/knowledge-base", tags=["knowledge_base"])


@router.get("/objectives")
async def get_objectives(current_user: dict = Depends(require_org)):
    """Return the pedagogical-objectives taxonomy (kb 'pedagogy' category)."""
    return {"objectives": knowledge_base_service.get_objectives()}


@router.get("/block-subtypes")
async def get_block_subtypes(current_user: dict = Depends(require_org)):
    """Return block format subtypes keyed by block type, plus the content->worksheet
    compatibility map. Served straight from outliner/block_prompts.py constants."""
    return {
        "subtypes": {
            "content": list(CONTENT_SUBTYPES),
            "worksheet": list(WORKSHEET_SUBTYPES),
            "activity": list(ACTIVITY_SUBTYPES),
        },
        "worksheet_compatibility": {
            k: list(v) for k, v in WORKSHEET_SUBTYPE_COMPATIBILITY.items()
        },
    }


@router.get("/taxonomy")
def get_taxonomy(
    age_min: Optional[float] = None,
    age_max: Optional[float] = None,
    class_size: Optional[int] = None,
    current_user: dict = Depends(require_org),
):
    """
    Course Builder taxonomy: objective categories, content types, worksheet formats,
    activity formats and the pairing table. Optional age_min/age_max/class_size filter
    the formats (and pairing table) like the Course Builder prompts; none given returns
    everything. `vocabularies` = {thinking_levels, group_sizes, teacher_attention_levels}
    (bare ids); `vocabularies_detail` carries them as labelled items plus
    default_group_size. Plain `def` so the blocking Firestore read runs in the threadpool.
    """
    return knowledge_base_service.get_taxonomy(
        age_min, age_max if age_max is not None else age_min, class_size
    )
