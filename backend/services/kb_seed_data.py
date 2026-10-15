"""
Knowledge base seed data: the single, human-editable source for the taxonomy
that is written to the kb_* Firestore collections by
scripts/seed_knowledge_base.py, and that knowledge_base_service.py falls back
to when Firestore is unreachable or a field has not been seeded yet.

All pedagogy values here (age-band notes, thinking levels, group sizes, class-size
limits, teacher attention, which formats suit which ages, the pairing table) are
FIRST DRAFTS for the teacher/founder to review. Edit them here and re-seed with
--force, or edit them in Firestore directly (a normal re-seed will not overwrite
hand-edited values).

Age bands are filter lenses, not walls: bands overlap on purpose, and a format
lists every band it works in, so adjacent-band reuse is always possible.

Pure data, no imports from firebase.
"""

# ---------------------------------------------------------------------------
# Fixed vocabularies (documented; used by the service and the route)
# ---------------------------------------------------------------------------

# The three vocabularies below are first-class knowledge base items: each entry has
# an id (what is stored on blocks and formats), a teacher-facing label and a short
# description. They are seeded into kb_thinking_levels, kb_group_sizes and
# kb_teacher_attention_levels. The plain id lists (THINKING_LEVELS, GROUP_SIZES,
# TEACHER_ATTENTION_LEVELS) are derived from them and kept for compatibility.

# Worksheet thinking level: what the student has to do with the content.
THINKING_LEVEL_ITEMS = [
    {"id": "recall", "label": "Recall",
     "description": "Retrieve a fact, term, or position (label, fill in, match, pick)."},
    {"id": "understanding", "label": "Understanding",
     "description": "Explain, order, sort, or apply what was taught in the student's own terms."},
    {"id": "critical_thinking", "label": "Critical thinking",
     "description": "Compare, judge, justify, or create something original."},
]

# Activity group size. The order is the display order (smallest to largest).
# Which sizes a given activity format allows is the format's own `group_sizes` field.
# DEFAULT_GROUP_SIZE is the size used when an activity block has no valid size and
# its format lists none (also stored as `is_default: True` on that item).
GROUP_SIZE_ITEMS = [
    {"id": "individual", "label": "Individual", "description": "Each student works on their own."},
    {"id": "pairs", "label": "Pairs", "description": "Students work in twos."},
    {"id": "small_groups", "label": "Small groups", "description": "Students work in groups of about three to five."},
    {"id": "whole_class", "label": "Whole class", "description": "The whole class works together as one group."},
]
DEFAULT_GROUP_SIZE = "small_groups"

# How much teacher attention per student an activity needs while it runs.
TEACHER_ATTENTION_ITEMS = [
    {"id": "low", "label": "Low", "description": "Students can work mostly alone once started."},
    {"id": "medium", "label": "Medium", "description": "Teacher circulates and checks in."},
    {"id": "high", "label": "High",
     "description": "Teacher needs to be hands-on with most groups (materials, safety, facilitation)."},
]

THINKING_LEVELS = [i["id"] for i in THINKING_LEVEL_ITEMS]
GROUP_SIZES = [i["id"] for i in GROUP_SIZE_ITEMS]
TEACHER_ATTENTION_LEVELS = [i["id"] for i in TEACHER_ATTENTION_ITEMS]

# Stored on the default group size doc so the default is data, not code.
for _i in GROUP_SIZE_ITEMS:
    if _i["id"] == DEFAULT_GROUP_SIZE:
        _i["is_default"] = True

# Document fields that are blank are treated as "not filled in yet" by the seeder
# and by the service fallback (so docs seeded by the first version of the seeder,
# which wrote "" and [], get filled in without --force).
def is_blank(value):
    return value is None or value == "" or value == [] or value == {}


# ---------------------------------------------------------------------------
# Age bands
# ---------------------------------------------------------------------------

AGE_BANDS = [
    {
        "id": "4.5-6", "label": "4.5-6", "age_min": 4.5, "age_max": 6,
        "developmental_notes": (
            "Just learning to read and write; most children cannot read instructions or write "
            "sentences alone. Attention lasts about 5-10 minutes on one task. Learn through "
            "touching, moving, singing and play. Fine motor control is still developing "
            "(chunky crayons, big cut-outs)."
        ),
        "pedagogy_notes": (
            "Teacher talks and shows; keep any reading to a single word or picture. Tasks should "
            "be physical and short: sorting, matching pictures, drawing, building, acting out. "
            "No writing beyond a name or single letters; use picture labels and word banks. "
            "Work in pairs or whole-class circles; expect high adult attention for every activity."
        ),
    },
    {
        "id": "6-8", "label": "6-8", "age_min": 6, "age_max": 8,
        "developmental_notes": (
            "Reading short sentences, writing is slow and effortful. Attention lasts about "
            "10-15 minutes. Still concrete thinkers: need to see and handle things before "
            "ideas make sense. Enjoy stories, games and being first or best."
        ),
        "pedagogy_notes": (
            "Use one-sentence instructions read aloud as well as written. Keep writing to a word "
            "or a short sentence; prefer circling, matching, labelling with a word bank and "
            "drawing. Hands-on and story-based tasks work best. Pairs and small groups of 3-4; "
            "expect to circulate constantly. Short passages only (3-4 sentences)."
        ),
    },
    {
        "id": "7-9", "label": "7-9", "age_min": 7, "age_max": 9,
        "developmental_notes": (
            "Reads independently and writes short paragraphs, though spelling and speed vary. "
            "Attention lasts about 15-20 minutes. Starting to reason in steps and to compare "
            "two things, but still best with concrete examples. Cares about fairness and "
            "working with friends."
        ),
        "pedagogy_notes": (
            "Instructions can be written, up to 3 short steps. Worksheets can ask for a sentence "
            "or two; short passages (a paragraph) with simple questions are fine. Good age for "
            "experiments, building and design challenges in small groups, and for first simple "
            "presentations and discussions. Give clear roles in groups."
        ),
    },
    {
        "id": "9-13", "label": "9-13", "age_min": 9, "age_max": 13,
        "developmental_notes": (
            "Fluent readers and writers; can handle multi-paragraph text and multi-step "
            "instructions. Attention lasts 20-30+ minutes on a task they find interesting. "
            "Abstract and comparative thinking is growing, and so is the wish to argue a "
            "position and to have real choices. Peer opinion matters a lot."
        ),
        "pedagogy_notes": (
            "Use open questions, comparison, justification and multi-step problems. Writing "
            "tasks can be paragraphs; research from provided sources works. Suits debate, "
            "design challenges, investigations and presentations. Lower-end of the band "
            "(9-10) still benefits from concrete examples and scaffolds; older students "
            "like autonomy, so give choices and keep teacher attention light."
        ),
    },
]

ALL_BANDS = ["4.5-6", "6-8", "7-9", "9-13"]

# ---------------------------------------------------------------------------
# Objectives (existing ids/labels/structure unchanged; `description` is new)
# ---------------------------------------------------------------------------

OBJECTIVES = [
    {
        "id": "thinking_self_awareness",
        "label": "Thinking and Self-Awareness",
        "description": "Understanding yourself as a learner and thinking carefully: managing feelings, noticing how you learn, comparing, weighing evidence and judging.",
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
        "description": "Working well with other people: communicating, teamwork, leading, resolving disagreements, managing time and speaking in front of others.",
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
        "description": "The core facts and ideas of the subject: definitions, concepts, types, parts, processes, rules and the systems they form.",
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
        "description": "Where the subject came from and what it means for people and the planet: history, culture, other viewpoints, ethical questions and consequences.",
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
        "description": "Using what was learned to make, design, investigate, perform, argue or plan something real, and reflecting on the result.",
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

# ---------------------------------------------------------------------------
# Content types (the *kind of content* a block teaches, e.g. "Parts/Components").
# This is a different axis from kb_content_formats (text / image / video = the
# media a block is delivered in), so it gets its own collection
# `kb_content_types` rather than overloading kb_content_formats.
#
# `label` is EXACTLY the string the old-flow content subtype list uses and that
# existing courses store as a block's subtype. Never change a label.
# `legacy` False = new here, not part of the old-flow subtype list.
#
# Pairing table (per content type):
#   worksheet_format_ids : worksheet formats that can test this content
#   activity_format_ids  : activity formats that put it to use
# The first id in each list is the default suggestion.
# ---------------------------------------------------------------------------

CONTENT_TYPES = [
    {"id": "definition", "label": "Definition", "legacy": True,
     "description": "A key term or idea is defined precisely.",
     "worksheet_format_ids": ["fill_in_blank", "multiple_choice", "short_answer"],
     "activity_format_ids": ["art_creation", "presentations", "reflection_journaling"]},
    {"id": "categories_types", "label": "Categories/Types", "legacy": True,
     "description": "Kinds or groups of something, and what puts a thing in each group.",
     "worksheet_format_ids": ["matching", "cut_paste", "multiple_choice"],
     "activity_format_ids": ["problem_solving", "hands_on_building", "research_investigation"]},
    {"id": "examples", "label": "Examples", "legacy": True,
     "description": "Concrete examples that show the idea at work.",
     "worksheet_format_ids": ["matching", "fill_in_blank", "cut_paste"],
     "activity_format_ids": ["research_investigation", "art_creation", "design_challenge"]},
    {"id": "terminology", "label": "Terminology", "legacy": True,
     "description": "Vocabulary the student needs to use the subject.",
     "worksheet_format_ids": ["fill_in_blank", "matching"],
     "activity_format_ids": ["role_play_simulation", "presentations", "art_creation"]},
    {"id": "process", "label": "Process", "legacy": True,
     "description": "Steps or a sequence that happen in order.",
     "worksheet_format_ids": ["sequencing", "diagram_completion"],
     "activity_format_ids": ["experimentation", "modelling", "role_play_simulation"]},
    {"id": "parts_components", "label": "Parts/Components", "legacy": True,
     "description": "The parts of an object or system and what each does.",
     "worksheet_format_ids": ["labeling", "diagram_completion"],
     "activity_format_ids": ["hands_on_building", "modelling", "design_challenge"]},
    {"id": "comparison", "label": "Comparison", "legacy": True,
     "description": "Two or more things set side by side: how they are alike and different.",
     "worksheet_format_ids": ["compare_contrast", "short_answer"],
     "activity_format_ids": ["debate_discussion", "problem_solving", "presentations"]},
    {"id": "perspectives", "label": "Perspectives", "legacy": True,
     "description": "Different points of view on the same question.",
     "worksheet_format_ids": ["compare_contrast", "composition"],
     "activity_format_ids": ["debate_discussion", "role_play_simulation", "reflection_journaling"]},
    {"id": "context_history", "label": "Context/History", "legacy": True,
     "description": "Where something came from and how it developed over time.",
     "worksheet_format_ids": ["sequencing", "multiple_choice", "comprehension"],
     "activity_format_ids": ["research_investigation", "role_play_simulation", "presentations"]},
    {"id": "story_narrative", "label": "Story/Narrative", "legacy": False,
     "description": "A story or narrative passage the student reads or hears.",
     "worksheet_format_ids": ["composition", "comprehension", "sequencing"],
     "activity_format_ids": ["role_play_simulation", "art_creation", "reflection_journaling"]},
]

# ---------------------------------------------------------------------------
# Worksheet formats
#   existing fields kept verbatim (id, label, description)
#   new: thinking_level, suitable_age_bands, legacy_labels, legacy_order
# `legacy_labels` = the old-flow worksheet subtype string(s) this format stands
# for (the strings stored on existing blocks), so they can be mapped to an id.
# `legacy_order` = a list of ints parallel to `legacy_labels` (same position = same
# label): where each label sits in the old-flow "subtype from: [...]" list. It is
# per label because one format may carry several labels. See
# knowledge_base_service.get_legacy_subtypes().
# ---------------------------------------------------------------------------

WORKSHEET_FORMATS = [
    {"id": "fill_in_blank", "label": "Fill in the Blank", "description": "Numbered sentences with key terms removed; student writes the missing word in each blank. Requires an answer key.",
     "thinking_level": "recall", "suitable_age_bands": ["6-8", "7-9", "9-13"], "legacy_labels": ["Fill-in-the-blank"], "legacy_order": [0]},
    {"id": "labeling", "label": "Labeling", "description": "A diagram or image with numbered blank lines pointing to parts; student writes the correct term for each. Requires an image reference + label list.",
     "thinking_level": "recall", "suitable_age_bands": ["4.5-6", "6-8", "7-9", "9-13"], "legacy_labels": ["Labeling/diagramming"], "legacy_order": [3]},
    {"id": "matching", "label": "Matching", "description": "Two columns of related items; student draws lines or writes letters connecting matching pairs. Requires equal-length paired lists.",
     "thinking_level": "recall", "suitable_age_bands": ["4.5-6", "6-8", "7-9", "9-13"], "legacy_labels": ["Matching"], "legacy_order": [1]},
    {"id": "comprehension", "label": "Comprehension", "description": "A short passage followed by questions testing understanding of it. Requires passage text + question set + answer key.",
     "thinking_level": "understanding", "suitable_age_bands": ["7-9", "9-13"], "legacy_labels": []},
    {"id": "cut_paste", "label": "Cut & Paste", "description": "Printable elements the student cuts out and pastes into matching positions or categories. Requires distinct cut-zone and paste-zone layout.",
     "thinking_level": "understanding", "suitable_age_bands": ["4.5-6", "6-8", "7-9"], "legacy_labels": []},
    {"id": "composition", "label": "Composition", "description": "Open-ended writing prompt; student produces original sentences/paragraphs. Requires a prompt + optional word/line-count guidance, no fixed answer key.",
     "thinking_level": "critical_thinking", "suitable_age_bands": ["7-9", "9-13"], "legacy_labels": []},
    {"id": "sequencing", "label": "Sequencing", "description": "A set of steps/events presented out of order; student numbers or reorders them correctly. Requires an ordered reference sequence.",
     "thinking_level": "understanding", "suitable_age_bands": ["4.5-6", "6-8", "7-9", "9-13"], "legacy_labels": ["Sequencing/ordering"], "legacy_order": [2]},
    {"id": "short_answer", "label": "Short Answer", "description": "Direct questions requiring a brief written response (not multiple choice). Requires question set + answer key or rubric.",
     "thinking_level": "understanding", "suitable_age_bands": ["7-9", "9-13"], "legacy_labels": []},
    {"id": "diagram_completion", "label": "Diagram Completion", "description": "A partially drawn/labeled diagram; student fills in missing elements (arrows, parts, values). Requires a base diagram + missing-element list.",
     "thinking_level": "understanding", "suitable_age_bands": ["6-8", "7-9", "9-13"], "legacy_labels": []},
    {"id": "word_problem", "label": "Word Problem", "description": "A short narrative scenario requiring calculation or applied reasoning to solve. Requires scenario text + solution/answer key.",
     "thinking_level": "critical_thinking", "suitable_age_bands": ["7-9", "9-13"], "legacy_labels": []},
    # New formats: no legacy label (not in the old-flow subtype list).
    {"id": "multiple_choice", "label": "Multiple Choice", "description": "Questions with one correct answer among several options; student circles or ticks the answer. Requires question set, distractors and an answer key.",
     "thinking_level": "recall", "suitable_age_bands": ["6-8", "7-9", "9-13"], "legacy_labels": ["Multiple choice"], "legacy_order": [5]},
    {"id": "compare_contrast", "label": "Compare & Contrast", "description": "Short written answers (or a simple two-column chart) on how two things are alike and different. Requires the items to compare + answer key or rubric.",
     "thinking_level": "critical_thinking", "suitable_age_bands": ["7-9", "9-13"], "legacy_labels": ["Compare/contrast short answer"], "legacy_order": [4]},
]

# ---------------------------------------------------------------------------
# Activity formats
#   existing fields kept verbatim (id, label, description)
#   new: suitable_age_bands, group_sizes, min_class_size, max_class_size,
#        teacher_attention, legacy_labels, legacy_order
# (`legacy_labels` / `legacy_order` work as for worksheet formats above.)
# min/max_class_size = the class sizes the format is sensible for as a whole-class
# activity (not the size of each group).
# ---------------------------------------------------------------------------

ACTIVITY_FORMATS = [
    {"id": "hands_on_building", "label": "Hands-on Building", "description": "Student physically constructs something (model, structure, craft) using provided or found materials. Requires a materials list + build steps.",
     "suitable_age_bands": ["4.5-6", "6-8", "7-9", "9-13"], "group_sizes": ["individual", "pairs", "small_groups"],
     "min_class_size": 1, "max_class_size": 30, "teacher_attention": "medium", "legacy_labels": ["Group project/build"], "legacy_order": [4]},
    {"id": "art_creation", "label": "Art Creation", "description": "Student produces an original visual/creative work (drawing, collage, design) expressing understanding of the topic. Requires a creative prompt, no fixed correct output.",
     "suitable_age_bands": ["4.5-6", "6-8", "7-9", "9-13"], "group_sizes": ["individual", "pairs", "small_groups"],
     "min_class_size": 1, "max_class_size": 40, "teacher_attention": "low", "legacy_labels": []},
    {"id": "experimentation", "label": "Experimentation", "description": "Student runs a simple test/experiment and observes/records results. Requires materials, procedure steps, and an observation/recording format.",
     "suitable_age_bands": ["6-8", "7-9", "9-13"], "group_sizes": ["pairs", "small_groups"],
     "min_class_size": 2, "max_class_size": 24, "teacher_attention": "high", "legacy_labels": []},
    {"id": "modelling", "label": "Modelling", "description": "Student builds a physical or diagrammatic model representing a concept, system, or process. Requires a target concept + model components.",
     "suitable_age_bands": ["6-8", "7-9", "9-13"], "group_sizes": ["individual", "pairs", "small_groups"],
     "min_class_size": 1, "max_class_size": 30, "teacher_attention": "medium", "legacy_labels": []},
    {"id": "presentations", "label": "Presentations", "description": "Student prepares and delivers a short spoken or visual presentation on a topic. Requires a topic prompt + structure guidance (time/format).",
     "suitable_age_bands": ["7-9", "9-13"], "group_sizes": ["individual", "small_groups", "whole_class"],
     "min_class_size": 2, "max_class_size": 25, "teacher_attention": "medium", "legacy_labels": ["Presentation/teach-back"], "legacy_order": [3]},
    {"id": "problem_solving", "label": "Problem Solving", "description": "Student works through an applied challenge with no single obvious answer, using reasoning/strategy. Requires a scenario + constraints, open-ended resolution.",
     "suitable_age_bands": ["6-8", "7-9", "9-13"], "group_sizes": ["pairs", "small_groups"],
     "min_class_size": 2, "max_class_size": 30, "teacher_attention": "medium", "legacy_labels": []},
    {"id": "role_play_simulation", "label": "Role Play & Simulation", "description": "Students act out roles or a scenario to explore a concept experientially. Requires role descriptions + scenario setup.",
     "suitable_age_bands": ["4.5-6", "6-8", "7-9", "9-13"], "group_sizes": ["small_groups", "whole_class"],
     "min_class_size": 4, "max_class_size": 30, "teacher_attention": "high", "legacy_labels": ["Roleplay/simulation"], "legacy_order": [1]},
    {"id": "research_investigation", "label": "Research & Investigation", "description": "Student gathers information from provided or external sources to answer a guiding question. Requires a research question + source guidance.",
     "suitable_age_bands": ["7-9", "9-13"], "group_sizes": ["individual", "pairs", "small_groups"],
     "min_class_size": 1, "max_class_size": 30, "teacher_attention": "medium", "legacy_labels": []},
    # New formats: no legacy label (not in the old-flow subtype list).
    {"id": "design_challenge", "label": "Design Challenge", "description": "Students design and make their own solution to a stated challenge within constraints. Requires a challenge brief, constraints and a materials list.",
     "suitable_age_bands": ["6-8", "7-9", "9-13"], "group_sizes": ["pairs", "small_groups"],
     "min_class_size": 2, "max_class_size": 30, "teacher_attention": "medium", "legacy_labels": ["Create-your-own/design challenge"], "legacy_order": [0]},
    {"id": "debate_discussion", "label": "Debate & Discussion", "description": "Students discuss or debate a question, giving reasons and responding to others. Requires a discussion question, sides or roles, and ground rules.",
     "suitable_age_bands": ["7-9", "9-13"], "group_sizes": ["small_groups", "whole_class"],
     "min_class_size": 4, "max_class_size": 30, "teacher_attention": "medium", "legacy_labels": ["Debate/discussion"], "legacy_order": [2]},
    {"id": "reflection_journaling", "label": "Reflection & Journaling", "description": "Student reflects on what they learned in a short journal entry, drawing or voice note. Requires reflection prompts.",
     "suitable_age_bands": ["6-8", "7-9", "9-13"], "group_sizes": ["individual"],
     "min_class_size": 1, "max_class_size": 40, "teacher_attention": "low", "legacy_labels": ["Reflection/journaling"], "legacy_order": [5]},
]

# ---------------------------------------------------------------------------
# Content formats (media: text / image / video). Only suitable_age_bands is new.
# ---------------------------------------------------------------------------

CONTENT_FORMATS = [
    {"id": "text", "label": "Text", "description": "Written material introducing or explaining the topic, sourced from an article, book excerpt, website, or paper — relevant paragraphs selected/excerpted. Requires source text + citation/reference to origin.",
     "suitable_age_bands": ["6-8", "7-9", "9-13"]},
    {"id": "image", "label": "Image", "description": "A visual representation of the topic — photo, illustration, or diagram — used either standalone or alongside text. Requires image + optional caption/labels.",
     "suitable_age_bands": ["4.5-6", "6-8", "7-9", "9-13"]},
    {"id": "video", "label": "Video", "description": "A short instructional or illustrative video clip, sourced (existing video, not generated). Requires a source video reference + relevance justification.",
     "suitable_age_bands": ["4.5-6", "6-8", "7-9", "9-13"]},
]

# Collection name -> seed list. Used by the seeder and the service fallback.
COLLECTIONS = {
    "kb_age_bands": AGE_BANDS,
    "kb_objectives": OBJECTIVES,
    "kb_worksheet_formats": WORKSHEET_FORMATS,
    "kb_activity_formats": ACTIVITY_FORMATS,
    "kb_content_formats": CONTENT_FORMATS,
    "kb_content_types": CONTENT_TYPES,
    "kb_thinking_levels": THINKING_LEVEL_ITEMS,
    "kb_group_sizes": GROUP_SIZE_ITEMS,
    "kb_teacher_attention_levels": TEACHER_ATTENTION_ITEMS,
}


# Old top-level collection name -> category under EdCube/knowledge_base
# (backend/firebase/paths.kb_col). The first five are the reorg's own mapping
# (tasks/firestore-reorg-spec.md); the last four are Course Builder additions
# and get new categories. The Firestore rules' wildcard
# `EdCube/knowledge_base/{category}/{docId}` already covers them (read-only).
KB_CATEGORY = {
    "kb_age_bands": "age",
    "kb_objectives": "pedagogy",
    "kb_worksheet_formats": "worksheets",
    "kb_activity_formats": "activities",
    "kb_content_formats": "content",
    "kb_content_types": "content_types",
    "kb_thinking_levels": "thinking_levels",
    "kb_group_sizes": "group_sizes",
    "kb_teacher_attention_levels": "teacher_attention",
}
