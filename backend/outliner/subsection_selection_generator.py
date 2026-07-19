"""
Phase 1.5: Subsection Ideation & Selection generator.
Calls the LLM to propose candidate subsection chains for one section,
validates the response, and estimates a duration per subsection from its
block composition (Phase 1.5 no longer receives a fixed 60-min slot).
"""

import logging
import time
from typing import Dict, List, Optional

from outliner.subsection_selection_prompts import get_subsection_ideation_prompt
from utils.llm_handler import call_openai, validate_json_response

logger = logging.getLogger(__name__)

# Rough per-block-type duration used to estimate a subsection's total duration
# from its (fixed) block composition, since subsections no longer have a fixed
# 60-minute slot. Mirrors the durations block_prompts.py already assigns.
_BLOCK_DURATION_ESTIMATES = {
    "content": 15,
    "worksheet": 15,
    "activity": 30,
}


def generate_subsection_candidates(
    section: Dict,
    course_context: Dict,
    other_subsections: Optional[List[Dict]] = None,
    hours_per_day: float = 1.0,
    num_days: int = 1,
    num_new_chains: Optional[int] = None,
    worksheet_budget: Optional[int] = None,
    activity_budget: Optional[int] = None,
    day_slice: Optional[Dict] = None,
    recurring_structure: Optional[Dict] = None,
) -> Dict:
    """
    Generate candidate subsection chains for one section. Called both for the
    initial batch (num_new_chains unset, model decides how many) and for a
    single "generate more" request (num_new_chains=1), in which case
    `other_subsections` should also include this section's already-proposed
    subsections so the new chain doesn't repeat them.

    Args:
        worksheet_budget / activity_budget: this section's soft share of the
            teacher's course-wide numWorksheets/numActivities counts (None if
            unknown — treated as "no signal", not "zero").
        day_slice: this section's day slice from the Requirements Interpreter
            (explicit_topics/explicit_deliverables/teacher_emphasis for this day),
            if the teacher's requirements text described day-by-day content.
        recurring_structure: course-level structure (e.g. "every day has a
            30-45 min inspiration video") that must be reflected in every section,
            if the Requirements Interpreter found one.

    Returns:
        dict: {'section_id': str, 'chains': [...]} with stamped ids and
              estimated duration_minutes per subsection.
    """
    section_title = section.get('title', 'Unknown')
    logger.info(f"Generating Phase 1.5 subsection candidates for section: {section_title}")

    prompt = get_subsection_ideation_prompt(
        section=section,
        course_context=course_context,
        other_subsections=other_subsections,
        hours_per_day=hours_per_day,
        num_days=num_days,
        num_new_chains=num_new_chains,
        worksheet_budget=worksheet_budget,
        activity_budget=activity_budget,
        day_slice=day_slice,
        recurring_structure=recurring_structure,
    )

    system_message = (
        "You are an expert curriculum designer. You propose well-structured, "
        "pedagogically sound candidate subsections in JSON format."
    )

    result = call_openai(prompt, system_message)
    _validate_subsection_selection_response(result)

    section_id = section.get('id') or section.get('section_id', '')
    ts = int(time.time() * 1000)

    # Ids are always assigned server-side (never trust the LLM's self-picked ids),
    # so chains generated in separate calls (e.g. repeated "generate more" clicks)
    # never collide. Since the LLM's own prerequisite_subsection_id / source_block_ids
    # references point at its own (discarded) ids, we remap them via the id maps below.
    for chain_idx, chain in enumerate(result.get('chains', [])):
        chain['chain_id'] = f"{section_id}_chain_{ts}_{chain_idx}"
        subsections = chain.get('subsections', [])

        sub_id_map = {}
        for sub_idx, sub in enumerate(subsections):
            depth_key = (sub.get('depth_level') or f"sub{sub_idx}").lower()
            new_id = f"{chain['chain_id']}_{depth_key}"
            old_id = sub.get('subsection_id')
            if old_id:
                sub_id_map[old_id] = new_id
            sub['id'] = new_id
            sub.pop('subsection_id', None)
            sub['chain_id'] = chain['chain_id']

        for sub in subsections:
            prereq = sub.get('prerequisite_subsection_id')
            if prereq:
                sub['prerequisite_subsection_id'] = sub_id_map.get(prereq, prereq)

            blocks = sub.get('blocks', [])
            block_id_map = {}
            for block_idx, block in enumerate(blocks):
                old_block_id = block.get('id')
                new_block_id = f"blockspec-{sub['id']}-{block_idx}"
                if old_block_id:
                    block_id_map[old_block_id] = new_block_id
                block['id'] = new_block_id

            for block in blocks:
                if block.get('source_block_ids'):
                    block['source_block_ids'] = [
                        block_id_map.get(bid, bid) for bid in block['source_block_ids']
                    ]

            sub['duration_minutes'] = sum(
                _BLOCK_DURATION_ESTIMATES.get(b.get('type'), 15) for b in blocks
            )

    return {'section_id': section_id, 'chains': result.get('chains', [])}


def _validate_subsection_selection_response(data: Dict) -> bool:
    """
    Validate the {'chains': [...]} structure from the LLM.

    Raises:
        ValueError: If validation fails.
    """
    validate_json_response(data, ['chains'], "subsection selection response")

    if not isinstance(data['chains'], list) or len(data['chains']) == 0:
        raise ValueError("No candidate chains generated")

    required_sub_fields = ['title', 'core_concept', 'depth_level', 'blocks']

    for i, chain in enumerate(data['chains']):
        subsections = chain.get('subsections')
        if not isinstance(subsections, list) or len(subsections) == 0:
            raise ValueError(f"Chain {i + 1} has no subsections")

        for j, sub in enumerate(subsections):
            try:
                validate_json_response(sub, required_sub_fields, f"chain {i + 1} subsection {j + 1}")
            except ValueError as e:
                raise ValueError(f"Chain {i + 1}, Subsection {j + 1} validation failed: {e}")

            blocks = sub['blocks']
            if not isinstance(blocks, list) or len(blocks) == 0:
                raise ValueError(f"Chain {i + 1} subsection {j + 1} '{sub['title']}' has no blocks")

    logger.info(f"Validated {len(data['chains'])} candidate chain(s)")
    return True
