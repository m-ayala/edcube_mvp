"""
Read-only knowledge base taxonomy for the frontend (Course Builder).
No writes: only backend-agent's seeder writes kb_* collections.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends

from .teachers import verify_firebase_token
from services import knowledge_base_service as kb

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/knowledge-base", tags=["knowledge-base"])


@router.get("/taxonomy")
def get_taxonomy(
    age_min: Optional[float] = None,
    age_max: Optional[float] = None,
    class_size: Optional[int] = None,
    current_user: dict = Depends(verify_firebase_token),
):
    """
    Objective categories, content types, worksheet formats, activity formats and the
    pairing table. Optional age_min/age_max/class_size filter the formats (and the
    pairing table) the same way the Course Builder prompts are filtered; with none
    given everything is returned.

    `vocabularies` is unchanged: {thinking_levels, group_sizes, teacher_attention_levels},
    each a list of bare ids. `vocabularies_detail` (additive) carries the same
    vocabularies as labelled items:
      {thinking_levels: [{id, label, description}], group_sizes: [{id, label, description,
       is_default?}], teacher_attention_levels: [{id, label, description}],
       default_group_size: "<id>"}
    Use `label` for display instead of humanising ids. Plain `def` so the blocking Firestore read runs
    in the threadpool.
    """
    return kb.get_taxonomy(age_min, age_max if age_max is not None else age_min, class_size)
