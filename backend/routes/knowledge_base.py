# backend/routes/knowledge_base.py
"""
Read-only knowledge-base / taxonomy endpoints.

The frontend reaches taxonomy data through these routes instead of reading
Firestore directly. Nothing here writes to Firestore or hardcodes taxonomy values.
Sources:
  - /objectives: services/knowledge_base_service.py (Firestore KB).
  - /block-subtypes: Python constants in outliner/block_prompts.py (the canonical
    block-format taxonomy shared by the outliner and generation prompts).
"""

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
