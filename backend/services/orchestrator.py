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
        Run Phase 1: Generate course outline (sections = days, subsections = hours).
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
                return None

            logger.info(f"Phase 1 complete: Generated {len(outline_data.get('sections', []))} sections")
            return create_final_outline(outline_data)

        except Exception as e:
            logger.error(f"Phase 1 error: {e}", exc_info=True)
            return None

    async def run_phase2_blocks(
        self,
        teacher_input: Dict,
        outline_data: Dict,
        num_worksheets: int,
        num_activities: int,
    ) -> AsyncGenerator[Dict, None]:
        """
        Phase 2: Generate content blocks for every subsection in the outline.

        Yields dicts:
          {'type': 'progress', 'message': str, 'progress': int}
          {'type': 'done', 'blocks_by_subsection': {subsection_id: [block, ...]}}
        """
        from outliner.block_prompts import get_block_generation_prompt
        from utils.llm_handler import call_openai

        sections = outline_data.get('sections', [])
        all_pairs = [
            (section, sub)
            for section in sections
            for sub in section.get('subsections', [])
        ]
        total_subs = len(all_pairs)

        if total_subs == 0:
            yield {'type': 'done', 'blocks_by_subsection': {}}
            return

        # Distribute worksheets evenly across subsections
        worksheet_indices: set = set()
        if num_worksheets > 0:
            step = total_subs / num_worksheets
            for i in range(min(num_worksheets, total_subs)):
                worksheet_indices.add(round(i * step))

        # Distribute activities evenly, nudging off worksheet slots when possible
        activity_indices: set = set()
        if num_activities > 0:
            step = total_subs / num_activities
            for i in range(min(num_activities, total_subs)):
                idx = round(i * step)
                if idx in worksheet_indices and idx + 1 < total_subs:
                    idx += 1
                activity_indices.add(idx)

        blocks_by_subsection: Dict[str, List] = {}
        hours_per_day = int(teacher_input.get('hours_per_day', 1)) or 1

        for flat_idx, (section, sub) in enumerate(all_pairs):
            sub_id = sub.get('id', f'sub-{flat_idx}')
            section_title = section.get('title', f'Day {flat_idx + 1}')
            hour_num = (flat_idx % hours_per_day) + 1

            pct = 55 + int(flat_idx / total_subs * 40)
            yield {
                'type': 'progress',
                'message': f'Generating blocks: {section_title} — Hour {hour_num} ({flat_idx + 1}/{total_subs})',
                'progress': pct,
            }

            worksheet_slots = 1 if flat_idx in worksheet_indices else 0
            activity_slots = 1 if flat_idx in activity_indices else 0

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
                    worksheet_slots=worksheet_slots,
                    activity_slots=activity_slots,
                )

                result = call_openai(
                    prompt,
                    system_message=(
                        "You are an expert elementary education curriculum designer. "
                        "Generate content blocks as valid JSON only."
                    ),
                )

                # Defensively extract the blocks list
                raw_blocks = result.get('blocks', []) if isinstance(result, dict) else []
                if not isinstance(raw_blocks, list):
                    raw_blocks = []

                stamped = []
                for block in raw_blocks:
                    if not isinstance(block, dict):
                        continue  # skip malformed entries
                    block['id'] = f"block-{sub_id}-{int(time.time() * 1000)}-{len(stamped)}"
                    block.setdefault('addedAt', None)
                    stamped.append(block)

            except Exception as e:
                logger.error(f"Block generation failed for subsection {sub_id}: {e}", exc_info=True)
                stamped = []

            blocks_by_subsection[sub_id] = stamped

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