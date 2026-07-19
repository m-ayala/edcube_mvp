# FILE 2: backend/services/orchestrator.py

"""
Orchestrator for curriculum generation - PHASE 1 ONLY VERSION

This version ONLY supports Phase 1 (box generation).
Phase 2 and Phase 3 are commented out for testing.
"""

import logging
import asyncio
import time
from typing import Dict, List, Optional, AsyncGenerator

logger = logging.getLogger(__name__)


def _distribute_budget(total: int, buckets: int) -> List[int]:
    """
    Split a course-wide total (e.g. numWorksheets) evenly across `buckets` days/
    sections, as a soft per-section target for Phase 1.5 — not a hard quota.
    Remainder goes to the earliest days. E.g. _distribute_budget(10, 3) -> [4, 3, 3].
    """
    if buckets <= 0:
        return []
    base, remainder = divmod(max(total, 0), buckets)
    return [base + (1 if i < remainder else 0) for i in range(buckets)]


class CurriculumOrchestrator:
    """
    Orchestrator for curriculum generation - PHASE 1 ONLY VERSION
    
    This version ONLY supports Phase 1 (box generation).
    Phase 2 and Phase 3 are commented out for testing.
    """
    
    def __init__(self):
        """Initialize the orchestrator"""
        logger.info("Initialized CurriculumOrchestrator (Phase 1 Only)")
    
    async def run_phase1(self, teacher_input: Dict, images: Optional[List[str]] = None) -> Dict:
        """
        Run Phase 1: Generate course outline (sections only — each a day/theme with a
        depth_ceiling). Subsections are proposed later in Phase 1.5 (run_phase1_5).
        """
        from outliner.outline_generator import generate_boxes, create_final_outline

        logger.info(f"Running Phase 1 for: {teacher_input.get('topic', 'Unknown')}")

        try:
            num_days = teacher_input.get('num_days', 1)
            hours_per_day = teacher_input.get('hours_per_day', 1.0)

            teacher_input_formatted = {
                'age_range_start': teacher_input.get('age_range_start', ''),
                'age_range_end':   teacher_input.get('age_range_end', ''),
                'num_students':    teacher_input.get('num_students', ''),
                'subject':         teacher_input.get('subject'),
                'topic':           teacher_input.get('topic'),
                'num_days':        num_days,
                'hours_per_day':   hours_per_day,
                'requirements':    teacher_input.get('objectives', 'None'),
            }

            # Call synchronously — blocks the event loop but acceptable for single-user SSE
            outline_data = generate_boxes(teacher_input_formatted, images=images)

            if not outline_data:
                logger.error("Phase 1 failed: No outline generated")
                raise ValueError("No outline generated")

            logger.info(f"Phase 1 complete: Generated {len(outline_data.get('sections', []))} sections")
            return create_final_outline(outline_data)

        except Exception as e:
            logger.error(f"Phase 1 error: {e}", exc_info=True)
            raise

    async def run_phase1_5(
        self,
        teacher_input: Dict,
        outline_data: Dict,
    ) -> AsyncGenerator[Dict, None]:
        """
        Phase 1.5: Propose candidate subsection chains for every section.

        Yields dicts:
          {'type': 'progress', 'message': str, 'progress': int}
          {'type': 'subsections_ready', 'section_id': str, 'chains': [...]}
          {'type': 'candidates_complete'}
        """
        from outliner.subsection_selection_generator import generate_subsection_candidates
        from outliner.context_utils import build_subsection_labels

        sections = outline_data.get('sections', [])
        total_sections = len(sections)

        if total_sections == 0:
            yield {'type': 'candidates_complete'}
            return

        course_context = {
            'subject':          teacher_input.get('subject', ''),
            'topic':            teacher_input.get('topic', ''),
            'age_range_start':  teacher_input.get('age_range_start', ''),
            'age_range_end':    teacher_input.get('age_range_end', ''),
            'requirements':     teacher_input.get('objectives', 'None'),
        }
        hours_per_day = teacher_input.get('hours_per_day', 1.0)
        num_days = teacher_input.get('num_days', 1)

        # Course-wide worksheet/activity counts split evenly across days as a soft
        # per-section target — Phase 1.5 no longer forces exactly 1 of each per
        # subsection (see subsection_selection_prompts.py).
        worksheet_budgets = _distribute_budget(teacher_input.get('num_worksheets', 0), total_sections)
        activity_budgets = _distribute_budget(teacher_input.get('num_activities', 0), total_sections)

        # Structured requirements (recurring daily elements + per-day explicit asks),
        # if the Requirements Interpreter produced any — None means fall back to the
        # raw requirements text only.
        interpreted_requirements = teacher_input.get('interpreted_requirements')
        recurring_structure = (interpreted_requirements or {}).get('recurring_structure')
        day_slices_by_number = {
            d.get('day_number'): d for d in (interpreted_requirements or {}).get('days', [])
        }

        # Sections whose candidate chains have been generated so far, used to build
        # the sibling "already proposed" dedup context for sections processed later.
        sections_so_far: List[Dict] = []

        for idx, section in enumerate(sections):
            pct = 50 + int(idx / total_sections * 20)
            yield {
                'type': 'progress',
                'message': f"Proposing subsections for {section.get('title', f'Section {idx + 1}')}...",
                'progress': pct,
            }

            other_subsections = build_subsection_labels(sections_so_far)

            try:
                result = generate_subsection_candidates(
                    section=section,
                    course_context=course_context,
                    other_subsections=other_subsections,
                    hours_per_day=hours_per_day,
                    num_days=num_days,
                    worksheet_budget=worksheet_budgets[idx] if idx < len(worksheet_budgets) else 0,
                    activity_budget=activity_budgets[idx] if idx < len(activity_budgets) else 0,
                    day_slice=day_slices_by_number.get(idx + 1),
                    recurring_structure=recurring_structure,
                )
                chains = result.get('chains', [])
            except Exception as e:
                logger.error(f"Phase 1.5 failed for section {section.get('id')}: {e}", exc_info=True)
                chains = []

            # Feed this section's approved-candidate subsections into the sibling
            # context for subsequent sections, so later sections don't repeat them.
            sections_so_far.append({
                'title': section.get('title', ''),
                'subsections': [sub for chain in chains for sub in chain.get('subsections', [])],
            })

            yield {
                'type': 'subsections_ready',
                'section_id': section.get('id', ''),
                'chains': chains,
                'progress': pct,
            }

        yield {'type': 'candidates_complete'}

    async def generate_more_subsections(
        self,
        section: Dict,
        teacher_input: Dict,
        existing_subsections: List[Dict],
        day_number: Optional[int] = None,
    ) -> Dict:
        """
        Phase 1.5 "generate more": propose one additional independent chain for a
        single section, on demand (triggered by the teacher clicking "+" in the
        matrix UI). `existing_subsections` is the dedup context — every subsection
        already proposed anywhere in the course (other sections AND this one) —
        so the new chain doesn't repeat anything already on screen.

        Returns: {'section_id': str, 'chains': [...]} — same shape as run_phase1_5's
        per-section payload, just generated synchronously for one section.
        """
        from outliner.subsection_selection_generator import generate_subsection_candidates

        course_context = {
            'subject':          teacher_input.get('subject', ''),
            'topic':            teacher_input.get('topic', ''),
            'age_range_start':  teacher_input.get('age_range_start', ''),
            'age_range_end':    teacher_input.get('age_range_end', ''),
            'requirements':     teacher_input.get('objectives', 'None'),
        }
        num_days = teacher_input.get('num_days', 1)

        # This is one extra chain added to a section that already has candidates —
        # give it a small share of that section's soft budget rather than the
        # section's full day-share, so repeated "generate more" clicks don't each
        # think they're the section's only chain.
        idx = (day_number - 1) if day_number else 0
        worksheet_budgets = _distribute_budget(teacher_input.get('num_worksheets', 0), num_days)
        activity_budgets = _distribute_budget(teacher_input.get('num_activities', 0), num_days)

        return generate_subsection_candidates(
            section=section,
            course_context=course_context,
            other_subsections=existing_subsections,
            hours_per_day=teacher_input.get('hours_per_day', 1.0),
            num_days=num_days,
            num_new_chains=1,
            worksheet_budget=min(1, worksheet_budgets[idx]) if idx < len(worksheet_budgets) else 0,
            activity_budget=activity_budgets[idx] if idx < len(activity_budgets) else 0,
        )

    async def run_phase2_blocks_for_selection(
        self,
        teacher_input: Dict,
        approved_subsections: List[Dict],
    ) -> AsyncGenerator[Dict, None]:
        """
        Phase 2: Generate full block content for teacher-approved subsections only.

        Each entry in `approved_subsections` carries its fixed composition from
        Phase 1.5 (`blocks`, each a block-spec dict with id/type/subtype/title and,
        for worksheets, `source_block_ids`) plus `excluded_block_ids` reflecting
        what the teacher unchecked. Composition is no longer decided here — only
        expanded into full content, filtered by exclusions.

        Yields dicts:
          {'type': 'progress', 'message': str, 'progress': int}
          {'type': 'subsection_blocks', 'subsection_id': str, 'blocks': [...]}
          {'type': 'done', 'blocks_by_subsection': {subsection_id: [block, ...]}}
        """
        from outliner.block_prompts import get_block_generation_prompt, _filter_excluded_block_specs
        from outliner.context_utils import build_subsection_labels
        from utils.llm_handler import call_openai

        total_subs = len(approved_subsections)
        if total_subs == 0:
            yield {'type': 'done', 'blocks_by_subsection': {}}
            return

        # Sibling context: every OTHER approved subsection's title, grouped by section title.
        sections_for_labels = {}
        for sub in approved_subsections:
            section_title = sub.get('section_title', '')
            sections_for_labels.setdefault(section_title, []).append(sub)
        all_subsection_labels = build_subsection_labels([
            {'title': title, 'subsections': subs} for title, subs in sections_for_labels.items()
        ])

        blocks_by_subsection: Dict[str, List] = {}

        for flat_idx, sub in enumerate(approved_subsections):
            sub_id = sub.get('id', f'sub-{flat_idx}')
            section_title = sub.get('section_title', f'Section {flat_idx + 1}')

            pct = 70 + int(flat_idx / total_subs * 25)
            yield {
                'type': 'progress',
                'message': f'Generating blocks: {section_title} — {sub.get("title", sub_id)} ({flat_idx + 1}/{total_subs})',
                'progress': pct,
            }

            other_subsections = [
                lbl for lbl in all_subsection_labels
                if not (lbl['section'] == section_title and lbl['subsection'] == sub.get('title', ''))
            ]

            excluded_block_ids = sub.get('excluded_block_ids', [])
            block_specs = _filter_excluded_block_specs(sub.get('blocks', []), excluded_block_ids)

            if not block_specs:
                blocks_by_subsection[sub_id] = []
                yield {'type': 'subsection_blocks', 'subsection_id': sub_id, 'blocks': [], 'progress': pct}
                continue

            session_minutes = int(sub.get('duration_minutes') or sum(
                {'content': 15, 'worksheet': 15, 'activity': 30}.get(b.get('type'), 15) for b in block_specs
            ))

            try:
                prompt = get_block_generation_prompt(
                    teacher_input={
                        'age_range_start': teacher_input.get('age_range_start', ''),
                        'age_range_end':   teacher_input.get('age_range_end', ''),
                        'subject':         teacher_input.get('subject', ''),
                        'topic':           teacher_input.get('topic', ''),
                        'requirements':    teacher_input.get('objectives', 'None'),
                    },
                    subsection=sub,
                    section_title=section_title,
                    block_specs=block_specs,
                    other_subsections=other_subsections,
                    session_minutes=session_minutes,
                )

                result = call_openai(
                    prompt,
                    system_message=(
                        "You are an expert elementary education curriculum designer. "
                        "Generate content blocks as valid JSON only."
                    ),
                    max_tokens=8000,
                )

                raw_blocks = result.get('blocks', []) if isinstance(result, dict) else []
                if not isinstance(raw_blocks, list):
                    raw_blocks = []

                # Block ids are stable from Phase 1.5 onward (block_specs already carry
                # real ids, e.g. referenced by worksheet source_block_ids) — keep whatever
                # the LLM echoed back, falling back to the approved spec's id by position
                # if it dropped or mangled one.
                spec_ids_by_position = [spec.get('id') for spec in block_specs]
                stamped = []
                for i, block in enumerate(raw_blocks):
                    if not isinstance(block, dict):
                        continue
                    if not block.get('id') and i < len(spec_ids_by_position):
                        block['id'] = spec_ids_by_position[i]
                    block.setdefault('addedAt', None)
                    stamped.append(block)

                if len(stamped) > 1:
                    group_id = f"group-{sub_id}"
                    for block in stamped:
                        block['groupId'] = group_id

            except Exception as e:
                logger.error(f"Block generation failed for subsection {sub_id}: {e}", exc_info=True)
                stamped = []

            blocks_by_subsection[sub_id] = stamped

            yield {
                'type': 'subsection_blocks',
                'subsection_id': sub_id,
                'blocks': stamped,
                'progress': pct,
            }

        yield {'type': 'done', 'blocks_by_subsection': blocks_by_subsection}

    # PHASE 2 METHODS - COMMENTED OUT FOR PHASE 1 TESTING
    # Uncomment these when ready to test Phase 2
    
    async def run_phase2(self, outline_data: Dict) -> Dict:
        """Run Phase 2: Add video resources (DISABLED FOR TESTING)"""
        logger.warning("Phase 2 is disabled - boxes will not be populated with videos")
        return outline_data
    
    async def populate_single_section(
    self,
    section: Dict,
    grade_level: str,
    teacher_comments: str = ""
) -> Dict:
        """
        Populate a single section with video resources (Phase 2 on-demand).
        """
        from populator.video_generator import generate_videos_for_section
        
        print("Calling Orchstrator HIT", section.get('title', 'Unknown'))
        
        try:
            enriched_section = generate_videos_for_section(
                section=section,
                grade_level=grade_level,
                teacher_comments=teacher_comments
            )
            
            return enriched_section
            
        except Exception as e:
            logger.error(f"Error populating section: {e}", exc_info=True)
            return section  # Return original section if fails
    
    # PHASE 3 METHODS
    async def generate_worksheets(
    self,
    section: dict,
    grade_level: str,
    user_prompt: str,
    num_options: int = 3
) -> dict:
        """
        Generate worksheet options for a section (Phase 3).
        
        Args:
            section: Section data with title, learning_objectives
            grade_level: Target grade level
            user_prompt: Type of worksheet to generate
            num_options: Number of options to return
        
        Returns:
            dict: Section enriched with 'worksheet_options'
        """
        from hands_on.worksheet_generator import generate_worksheets_for_section
        
        logger.info(f"📝 Generating {num_options} worksheet(s) for: {section.get('title', 'Unknown')}")
        
        # Call Phase 3 worksheet generator (runs in thread pool)
        loop = asyncio.get_event_loop()
        enriched_section = await loop.run_in_executor(
            None,
            generate_worksheets_for_section,
            section,
            grade_level,
            user_prompt,
            num_options
        )
        
        return enriched_section


    async def generate_activities(
        self,
        section: dict,
        grade_level: str,
        user_prompt: str,
        num_options: int = 3
    ) -> dict:
        """
        Generate activity options for a section (Phase 3).
        
        Args:
            section: Section data with title, learning_objectives
            grade_level: Target grade level
            user_prompt: Type of activity to generate
            num_options: Number of options to return
        
        Returns:
            dict: Section enriched with 'activity_options'
        """
        from hands_on.activity_generator import generate_activities_for_section
        
        logger.info(f"🎯 Generating {num_options} activit(ies) for: {section.get('title', 'Unknown')}")
        
        # Call Phase 3 activity generator (runs in thread pool)
        loop = asyncio.get_event_loop()
        enriched_section = await loop.run_in_executor(
            None,
            generate_activities_for_section,
            section,
            grade_level,
            user_prompt,
            num_options
        )
        
        return enriched_section