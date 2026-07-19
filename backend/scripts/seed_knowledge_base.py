#!/usr/bin/env python3
"""
Seed the taxonomy knowledge base collections in Firestore:
kb_age_bands, kb_objectives, kb_worksheet_formats, kb_activity_formats,
kb_content_formats.

Safe to re-run: every document is written with .set() keyed by a fixed
document ID, so re-running overwrites in place instead of duplicating.

Run from the backend/ directory:
    python scripts/seed_knowledge_base.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import firebase_admin
from firebase_admin import firestore


AGE_BANDS = [
    {"id": "4.5-6", "label": "4.5-6", "age_min": 4.5, "age_max": 6},
    {"id": "6-8", "label": "6-8", "age_min": 6, "age_max": 8},
    {"id": "7-9", "label": "7-9", "age_min": 7, "age_max": 9},
    {"id": "9-13", "label": "9-13", "age_min": 9, "age_max": 13},
]

OBJECTIVES = [
    {
        "id": "thinking_self_awareness",
        "label": "Thinking and Self-Awareness",
        "allowed_types": ["content", "worksheet", "activity"],
        "clusters": [
            {
                "label": "Self-Awareness",
                "subcategories": [
                    "Emotional Intelligence",
                    "Self-Regulation",
                    "Growth Mindset",
                    "Metacognition",
                    "Identity & Values",
                    "Resilience",
                ],
            },
            {
                "label": "Critical Thinking",
                "subcategories": [
                    "Critical Thinking",
                    "Compare & Contrast",
                    "Pattern Recognition",
                    "Examine Evidence",
                    "Synthesize",
                    "Critique & Debate",
                    "Evaluate & Judge",
                    "Make Connections",
                ],
            },
        ],
    },
    {
        "id": "soft_skills",
        "label": "Soft Skills",
        "allowed_types": ["content", "worksheet", "activity"],
        "clusters": [
            {
                "label": "Soft Skills",
                "subcategories": [
                    "Communication",
                    "Teamwork",
                    "Leadership",
                    "Collaboration",
                    "Conflict Resolution",
                    "Time Management",
                    "Public Speaking",
                ],
            },
        ],
    },
    {
        "id": "knowledge_theory",
        "label": "Knowledge and Theory",
        "allowed_types": ["content", "worksheet", "activity"],
        "clusters": [
            {
                "label": "Knowledge and Theory",
                "subcategories": [
                    "Definitions",
                    "Concepts",
                    "Theories",
                    "Types of",
                    "Parts of",
                    "Process",
                    "Methodologies",
                    "Techniques",
                    "Principles",
                    "Frameworks",
                    "Systems",
                    "Rules & Formulas",
                ],
            },
        ],
    },
    {
        "id": "ethics_perspectives",
        "label": "Ethics and Global Perspectives",
        "allowed_types": ["content", "worksheet", "activity"],
        "clusters": [
            {
                "label": "Ethics and Global Perspectives",
                "subcategories": [
                    "History",
                    "Evolution",
                    "Culture",
                    "Perspectives",
                    "Ethical Issues",
                    "Ethical Practices",
                    "Impact & Consequences",
                    "Sustainability",
                ],
            },
        ],
    },
    {
        "id": "application_impact",
        "label": "Application and Impact",
        "allowed_types": ["content", "worksheet", "activity"],
        "clusters": [
            {
                "label": "Building & Making",
                "subcategories": [
                    "Model/diorama building",
                    "Prototyping",
                    "Design-build challenge",
                    "Construction project",
                    "Coding/app project",
                    "3D modeling",
                ],
            },
            {
                "label": "Design",
                "subcategories": [
                    "Product design",
                    "Poster/infographic design",
                    "Diagram/blueprint design (process or system)",
                    "Game design",
                ],
            },
            {
                "label": "Visual Arts",
                "subcategories": [
                    "Drawing/illustration",
                    "Painting",
                    "Sculpture",
                    "Collage/mixed media",
                    "Photography project",
                    "Comic strip/storyboard",
                    "Digital art",
                ],
            },
            {
                "label": "Writing & Composition",
                "subcategories": [
                    "Essay writing",
                    "Persuasive writing (letter, op-ed, speech)",
                    "Creative/narrative writing",
                    "Poetry writing",
                    "Journal/diary entry",
                    "Script writing",
                    "Research report",
                ],
            },
            {
                "label": "Performance & Presentation",
                "subcategories": [
                    "Oral presentation",
                    "Skit/performance",
                    "Speech/oration",
                    "Music or movement composition",
                    "Podcast/video recording",
                ],
            },
            {
                "label": "Discussion & Argumentation",
                "subcategories": [
                    "Debate",
                    "Seminar/structured discussion",
                    "Panel discussion",
                ],
            },
            {
                "label": "Investigation & Inquiry",
                "subcategories": [
                    "Experiment/investigation",
                    "Field observation/data collection",
                    "Survey or interview project",
                    "Case study analysis",
                ],
            },
            {
                "label": "Simulation & Roleplay",
                "subcategories": [
                    "Roleplay",
                    "Simulation",
                    "Negotiation/decision-making exercise",
                ],
            },
            {
                "label": "Planning & Strategy",
                "subcategories": [
                    "Plan or proposal creation",
                    "Timeline creation",
                    "Campaign or pitch design",
                    "Event planning",
                ],
            },
            {
                "label": "Teaching & Mentoring",
                "subcategories": [
                    "Peer teach-back",
                    "How-to guide/tutorial",
                    "Explainer video",
                ],
            },
            {
                "label": "Reflection & Self-Assessment",
                "subcategories": [
                    "Reflection journal",
                    "Goal-setting exercise",
                    "Portfolio curation",
                ],
            },
        ],
    },
]

WORKSHEET_FORMATS = [
    {"id": "fill_in_blank", "label": "Fill in the Blank", "description": "Numbered sentences with key terms removed; student writes the missing word in each blank. Requires an answer key."},
    {"id": "labeling", "label": "Labeling", "description": "A diagram or image with numbered blank lines pointing to parts; student writes the correct term for each. Requires an image reference + label list."},
    {"id": "matching", "label": "Matching", "description": "Two columns of related items; student draws lines or writes letters connecting matching pairs. Requires equal-length paired lists."},
    {"id": "comprehension", "label": "Comprehension", "description": "A short passage followed by questions testing understanding of it. Requires passage text + question set + answer key."},
    {"id": "cut_paste", "label": "Cut & Paste", "description": "Printable elements the student cuts out and pastes into matching positions or categories. Requires distinct cut-zone and paste-zone layout."},
    {"id": "composition", "label": "Composition", "description": "Open-ended writing prompt; student produces original sentences/paragraphs. Requires a prompt + optional word/line-count guidance, no fixed answer key."},
    {"id": "sequencing", "label": "Sequencing", "description": "A set of steps/events presented out of order; student numbers or reorders them correctly. Requires an ordered reference sequence."},
    {"id": "short_answer", "label": "Short Answer", "description": "Direct questions requiring a brief written response (not multiple choice). Requires question set + answer key or rubric."},
    {"id": "diagram_completion", "label": "Diagram Completion", "description": "A partially drawn/labeled diagram; student fills in missing elements (arrows, parts, values). Requires a base diagram + missing-element list."},
    {"id": "word_problem", "label": "Word Problem", "description": "A short narrative scenario requiring calculation or applied reasoning to solve. Requires scenario text + solution/answer key."},
]

ACTIVITY_FORMATS = [
    {"id": "hands_on_building", "label": "Hands-on Building", "description": "Student physically constructs something (model, structure, craft) using provided or found materials. Requires a materials list + build steps."},
    {"id": "art_creation", "label": "Art Creation", "description": "Student produces an original visual/creative work (drawing, collage, design) expressing understanding of the topic. Requires a creative prompt, no fixed correct output."},
    {"id": "experimentation", "label": "Experimentation", "description": "Student runs a simple test/experiment and observes/records results. Requires materials, procedure steps, and an observation/recording format."},
    {"id": "modelling", "label": "Modelling", "description": "Student builds a physical or diagrammatic model representing a concept, system, or process. Requires a target concept + model components."},
    {"id": "presentations", "label": "Presentations", "description": "Student prepares and delivers a short spoken or visual presentation on a topic. Requires a topic prompt + structure guidance (time/format)."},
    {"id": "problem_solving", "label": "Problem Solving", "description": "Student works through an applied challenge with no single obvious answer, using reasoning/strategy. Requires a scenario + constraints, open-ended resolution."},
    {"id": "role_play_simulation", "label": "Role Play & Simulation", "description": "Students act out roles or a scenario to explore a concept experientially. Requires role descriptions + scenario setup."},
    {"id": "research_investigation", "label": "Research & Investigation", "description": "Student gathers information from provided or external sources to answer a guiding question. Requires a research question + source guidance."},
]

CONTENT_FORMATS = [
    {"id": "text", "label": "Text", "description": "Written material introducing or explaining the topic, sourced from an article, book excerpt, website, or paper — relevant paragraphs selected/excerpted. Requires source text + citation/reference to origin."},
    {"id": "image", "label": "Image", "description": "A visual representation of the topic — photo, illustration, or diagram — used either standalone or alongside text. Requires image + optional caption/labels."},
    {"id": "video", "label": "Video", "description": "A short instructional or illustrative video clip, sourced (existing video, not generated). Requires a source video reference + relevance justification."},
]


def _seed_collection(db, collection_name, items, extra_fields=None):
    col = db.collection(collection_name)
    for item in items:
        doc_id = item["id"]
        data = {k: v for k, v in item.items() if k != "id"}
        if extra_fields:
            data.update(extra_fields)
        col.document(doc_id).set(data)
    print(f"  ✅ {len(items)} document(s) upserted into {collection_name}")


def main():
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    db = firestore.client()

    print("Seeding kb_age_bands...")
    _seed_collection(
        db, "kb_age_bands", AGE_BANDS,
        extra_fields={"pedagogy_notes": "", "developmental_notes": ""},
    )

    print("Seeding kb_objectives...")
    _seed_collection(db, "kb_objectives", OBJECTIVES)

    print("Seeding kb_worksheet_formats...")
    _seed_collection(
        db, "kb_worksheet_formats", WORKSHEET_FORMATS,
        extra_fields={"suitable_age_bands": []},
    )

    print("Seeding kb_activity_formats...")
    _seed_collection(
        db, "kb_activity_formats", ACTIVITY_FORMATS,
        extra_fields={"suitable_age_bands": []},
    )

    print("Seeding kb_content_formats...")
    _seed_collection(
        db, "kb_content_formats", CONTENT_FORMATS,
        extra_fields={"suitable_age_bands": []},
    )

    print()
    print("Done.")


if __name__ == "__main__":
    main()
