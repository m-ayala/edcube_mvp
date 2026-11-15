"""Teacher intent: worked out once by the Requirements Interpreter and fed to every generation prompt."""
import asyncio

from interpreter.requirements_interpreter import (
    format_teacher_intent, requirements_with_intent, teacher_intent_of,
)
from interpreter.requirements_interpreter_prompts import get_requirements_interpretation_prompt
from services.orchestrator import _requirements

SOLDERING_REQUEST = """Help me design a mini course where the students will cover:
1. How to solder.
2. The different parts of soldering.
3. How to solder and safe practices.
4. Soldering pins to a sensor.
5. Most applications of soldering, very quickly, not more than 40 minutes.
6. Spending some time soldering their own sensors, which is the accelerometer that they're given.
7. An introduction to the accelerometer: what an accelerometer is and how it works.
8. The concepts of XYZ axis, roll, yaw, and pitch.
9. The OLED screen.
This is the exact OLED screen we have: 0.96" OLED I2C IIC Display Module 128x64 SSD1306.
And this is the exact accelerometer we'll be using: ADXL345 Accelerometer"""

INTERPRETATION = {
    "days": [],
    "teacher_intent": {
        "requested_topics": ["How to solder and safe practices", "Introduction to the accelerometer",
                             "XYZ axes, roll, pitch and yaw", "The OLED screen"],
        "focus_per_topic": [
            {"topic": "Introduction to the accelerometer",
             "focus": "what it measures and how it works — NOT pinouts or wiring"},
            {"topic": "", "focus": "dropped: no topic"},
        ],
        "constraints": ["Applications of soldering: no more than 40 minutes"],
        "equipment": ["ADXL345 accelerometer", "0.96in SSD1306 I2C OLED"],
        "not_requested": ["ADXL345 pin wiring"],
        "emphasis": "not a list — ignored",
    },
}


def test_interpreter_prompt_always_asks_for_teacher_intent():
    prompt = get_requirements_interpretation_prompt(SOLDERING_REQUEST, num_days=1, hours_per_day=3)
    assert "TEACHER INTENT (ALWAYS fill this" in prompt
    assert '"teacher_intent"' in prompt and '"not_requested"' in prompt


def test_teacher_intent_is_cleaned():
    intent = teacher_intent_of(INTERPRETATION)
    assert intent["focus_per_topic"] == [INTERPRETATION["teacher_intent"]["focus_per_topic"][0]]
    assert intent["emphasis"] == []
    assert teacher_intent_of({"days": []}) is None
    assert teacher_intent_of(None) is None
    assert teacher_intent_of({"teacher_intent": {"requested_topics": []}}) is None


def test_intent_block_carries_focus_constraints_and_not_requested():
    block = format_teacher_intent(teacher_intent_of(INTERPRETATION))
    assert "1. How to solder and safe practices" in block
    assert "what it measures and how it works — NOT pinouts or wiring" in block
    assert "no more than 40 minutes" in block
    assert "ADXL345 pin wiring" in block and "RULES:" in block
    assert format_teacher_intent(None) == ""


def test_requirements_keep_the_teachers_words_first():
    text = requirements_with_intent(SOLDERING_REQUEST, teacher_intent_of(INTERPRETATION))
    assert text.startswith("Help me design a mini course")
    assert text.index("ADXL345 Accelerometer") < text.index("TEACHER INTENT")
    assert requirements_with_intent("", None) == "None"
    assert requirements_with_intent("raw only", None) == "raw only"


def test_orchestrator_reads_intent_from_interpretation_or_outline():
    from_interp = _requirements({"objectives": SOLDERING_REQUEST, "interpreted_requirements": INTERPRETATION})
    from_outline = _requirements({"objectives": SOLDERING_REQUEST,
                                  "teacher_intent": teacher_intent_of(INTERPRETATION)})
    assert "TEACHER INTENT" in from_interp and from_interp == from_outline
    assert _requirements({"objectives": SOLDERING_REQUEST}) == SOLDERING_REQUEST


def test_phase1_outline_prompt_input_includes_intent(monkeypatch):
    import outliner.outline_generator as OG
    from services.orchestrator import CurriculumOrchestrator
    seen = {}

    def fake_generate_boxes(teacher_input, images=None):
        seen.update(teacher_input)
        return {"sections": [{"id": "s1", "title": "Soldering"}]}

    monkeypatch.setattr(OG, "generate_boxes", fake_generate_boxes)
    monkeypatch.setattr(OG, "create_final_outline", lambda o, **kw: o)
    orch = CurriculumOrchestrator.__new__(CurriculumOrchestrator)
    asyncio.run(orch.run_phase1({"course_name": "Sensors", "objectives": SOLDERING_REQUEST,
                                 "interpreted_requirements": INTERPRETATION}))
    assert "NOT pinouts or wiring" in seen["requirements"]
    assert seen["requirements"].startswith("Help me design")
