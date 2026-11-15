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
from typing import Dict, List, Optional

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


def _strings(value, limit: int = 20) -> List[str]:
    if not isinstance(value, list):
        return []
    return [str(v).strip() for v in value if isinstance(v, (str, int, float)) and str(v).strip()][:limit]


def teacher_intent_of(interpretation: Optional[Dict]) -> Optional[Dict]:
    """The cleaned `teacher_intent` object from an interpretation, or None when there is none."""
    raw = (interpretation or {}).get('teacher_intent')
    if not isinstance(raw, dict):
        return None
    focus = []
    for item in raw.get('focus_per_topic') or []:
        if isinstance(item, dict) and str(item.get('topic', '')).strip() and str(item.get('focus', '')).strip():
            focus.append({'topic': str(item['topic']).strip(), 'focus': str(item['focus']).strip()})
    intent = {
        'requested_topics': _strings(raw.get('requested_topics'), 30),
        'focus_per_topic': focus[:30],
        'deduced_objectives': _strings(raw.get('deduced_objectives'), 8),
        'emphasis': _strings(raw.get('emphasis'), 8),
        'constraints': _strings(raw.get('constraints'), 10),
        'equipment': _strings(raw.get('equipment'), 10),
        'not_requested': _strings(raw.get('not_requested'), 12),
    }
    return intent if any(intent.values()) else None


def format_teacher_intent(intent: Optional[Dict]) -> str:
    """Teacher intent as a prompt block, with the rules every generation phase must follow.
    Returns '' when there is no intent (callers then use the raw requirements text only)."""
    if not intent:
        return ''
    lines = ["TEACHER INTENT (worked out from the teacher's request — follow it):"]
    if intent.get('requested_topics'):
        lines.append("Requested topics, in the teacher's order:")
        lines += [f"  {i}. {t}" for i, t in enumerate(intent['requested_topics'], 1)]
    if intent.get('focus_per_topic'):
        lines.append("What each topic is really about:")
        lines += [f"  - {f['topic']}: {f['focus']}" for f in intent['focus_per_topic']]
    for key, label in (('deduced_objectives', 'By the end students should be able to'),
                       ('emphasis', 'Teacher emphasis'),
                       ('constraints', 'Constraints'),
                       ('equipment', 'Equipment students have (context for examples, not extra topics)'),
                       ('not_requested', 'NOT requested — do not build sections, topics or blocks around these')):
        if intent.get(key):
            lines.append(f"{label}:")
            lines += [f"  - {v}" for v in intent[key]]
    lines += [
        "RULES:",
        "  - Every section, topic and block must trace back to a requested topic. Add a prerequisite only if a "
        "requested topic cannot be taught without it, and keep it short.",
        "  - Follow each topic's focus. When a topic is about concepts (what something is, how it works), teach "
        "the concepts — do not swap in setup, connection or procedure steps the teacher did not ask for.",
        "  - Respect the constraints (time caps, order) and give the emphasised parts the most time.",
    ]
    return "\n".join(lines)


def requirements_with_intent(raw_requirements: str, intent: Optional[Dict]) -> str:
    """The raw requirements text followed by the teacher-intent block (if any)."""
    block = format_teacher_intent(intent)
    raw = raw_requirements or ''
    if not block:
        return raw or 'None'
    return f"{raw}\n\n{block}" if raw else block
