"""
Requirements Interpreter: a one-shot LLM call, run once before Phase 1 outline
generation, that structures the teacher's raw requirements text into
day/session slices (if the text describes a day-by-day structure) plus a
course-level recurring-track structure (if the text describes one).

This is purely additive to the generation pipeline — every caller MUST treat
a None return as "no structured data available" and fall back to today's
raw-requirements-blob behavior. This function never raises.
"""

import logging
from typing import Dict, Optional

from interpreter.requirements_interpreter_prompts import get_requirements_interpretation_prompt
from utils.llm_handler import call_openai, validate_json_response

logger = logging.getLogger(__name__)


def interpret_requirements(
    raw_requirements: str,
    num_days: int,
    hours_per_day: float,
    course_name: str = '',
    age_range_start: str = '',
    age_range_end: str = '',
) -> Optional[Dict]:
    """
    Interpret the teacher's raw requirements text into structured JSON.

    Returns:
        dict: the interpreter's structured output, or
        None: if there's no text to interpret, the LLM call fails, or the
              response fails validation. Callers MUST treat None as "fall
              back to legacy raw-dump behavior" — never raise.
    """
    if not raw_requirements or not raw_requirements.strip():
        logger.info("Requirements Interpreter: no requirements text provided, skipping")
        return None

    try:
        prompt = get_requirements_interpretation_prompt(
            raw_requirements=raw_requirements,
            num_days=num_days,
            hours_per_day=hours_per_day,
            course_name=course_name,
            age_range_start=age_range_start,
            age_range_end=age_range_end,
        )

        system_message = (
            "You are an expert curriculum analyst. You extract structured information from a "
            "teacher's course requirements text without inventing content the teacher didn't ask "
            "for. Output valid JSON only."
        )

        result = call_openai(prompt, system_message)
        _validate_interpreter_response(result)

        logger.info(
            f"Requirements Interpreter: extracted {len(result.get('days', []))} day slice(s), "
            f"recurring_structure={'yes' if result.get('recurring_structure') else 'no'}, "
            f"detected_subject={result.get('detected_subject', '')!r}, "
            f"detected_topic={result.get('detected_topic', '')!r}"
        )
        return result

    except Exception as e:
        logger.error(f"Requirements Interpreter failed, falling back to legacy behavior: {e}", exc_info=True)
        return None


def _validate_interpreter_response(data: Dict) -> bool:
    """
    Validate the interpreter's response shape. Unlike Phase 1/1.5 validators,
    an empty "days" list is a valid, expected response (it means the teacher's
    text isn't day-by-day) — only the key's presence is required.

    Raises:
        ValueError: If validation fails.
    """
    validate_json_response(data, ['days'], "requirements interpretation response")

    if not isinstance(data['days'], list):
        raise ValueError("'days' must be a list")

    return True
