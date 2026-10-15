# backend/schemas/curriculum_schema.py
"""
Curriculum Schema - Single Source of Truth for Field Names
⚠️ CRITICAL: Keep in sync with frontend/src/constants/curriculumSchema.js
Any changes here MUST be reflected in the frontend constants file.
"""


class CurriculumFields:
    """Field names for curriculum documents in Firestore"""
    
    # Core identification
    COURSE_ID = 'courseId'
    TEACHER_UID = 'teacherUid'
    TEACHER_EMAIL = 'teacherEmail'
    ORGANIZATION_ID = 'organizationId'
    
    # Course metadata
    COURSE_NAME = 'courseName'
    SUBJECT = 'subject'  # Auto-detected broad discipline, e.g. "Biology" — never manually typed
    TOPIC = 'topic'  # Auto-detected mid-level category, e.g. "Plants" — never manually typed
    CLASS = 'class'  # Grade level
    TIME_DURATION = 'timeDuration'  # e.g., "6 hours"
    OBJECTIVES = 'objectives'
    AGE_RANGE_START = 'ageRangeStart'
    AGE_RANGE_END = 'ageRangeEnd'
    NUM_STUDENTS = 'numStudents'
    NUM_DAYS = 'numDays'
    HOURS_PER_DAY = 'hoursPerDay'
    NUM_WORKSHEETS = 'numWorksheets'
    NUM_ACTIVITIES = 'numActivities'

    # Course info / project context
    COURSE_ATTACHMENTS = 'courseAttachments'  # List of attachment objects
    COURSE_INFO_NOTES = 'courseInfoNotes'      # Teacher's free-text project notes

    # Course content
    SECTIONS = 'sections'
    GENERATED_TOPICS = 'generatedTopics'  # The boxes generated in Phase 1
    HANDS_ON_RESOURCES = 'handsOnResources'
    OUTLINE = 'outline'  # Contains sections with structure

    # Sharing & permissions
    IS_PUBLIC = 'isPublic'
    SHARED_WITH = 'sharedWith'

    # Timestamps
    CREATED_AT = 'createdAt'
    LAST_MODIFIED = 'lastModified'


class SectionFields:
    """Field names for section objects within curricula"""

    SECTION_ID = 'id'
    SECTION_NAME = 'name'
    TITLE = 'title'
    DESCRIPTION = 'description'
    DURATION_MINUTES = 'duration_minutes'
    TYPE = 'type'  # 'section' or 'break'
    TOPICS = 'topics'

    # Phase 2 additions
    VIDEO_RESOURCES = 'video_resources'
    SEARCH_QUERIES_USED = 'search_queries_used'
    CONTENT_COVERAGE_STATUS = 'content_coverage_status'

    # Phase 3 additions
    WORKSHEET_OPTIONS = 'worksheet_options'
    ACTIVITY_OPTIONS = 'activity_options'
    NEEDS_WORKSHEETS = 'needs_worksheets'
    NEEDS_ACTIVITIES = 'needs_activities'

    # Learning content
    LEARNING_OBJECTIVES = 'learning_objectives'
    CONTENT_KEYWORDS = 'content_keywords'
    SUBTOPICS = 'subtopics'
    PLA_PILLARS = 'pla_pillars'

    # Phase 1.5 additions
    DEPTH_CEILING = 'depth_ceiling'  # 'Basics' | 'Intermediate' | 'Advanced' — how deep this section may go

    # Course Builder additions (Stage 1 day cards; a section is one day)
    BULLETS = 'bullets'  # exactly 3 short strings — what the day covers
    LEADS_TO = 'leads_to'  # one sentence — how this day sets up the next
    OBJECTIVE_IDS = 'objective_ids'  # kb_objectives category ids the day touches

    # Course Builder additions (Stage 2 day plan; set only on sections built by the Course Builder)
    DAY_SCHEDULE = 'day_schedule'  # ordered list of block ids: the teacher's exact order for the day
    SLOTS = 'slots'  # int — 15-minute blocks the day holds (hours_per_day x 4, rounded down)
    BLOCK_MINUTES = 'block_minutes'  # int — length of every block in the day (15)
    DAY_TOPICS = 'day_topics'  # list of {id, title, icon, priority} — the day's topics (= its subsections)


class SubsectionFields:
    """Field names for subsection objects within sections (Phase 1.5 taxonomy)"""

    SUBSECTION_ID = 'id'
    CORE_CONCEPT = 'core_concept'  # one sentence — the single idea this subsection teaches
    DEPTH_LEVEL = 'depth_level'  # 'Basics' | 'Intermediate' | 'Advanced', relative to its section
    PREREQUISITE_SUBSECTION_ID = 'prerequisite_subsection_id'  # nullable — subsection this one builds on
    CHAIN_ID = 'chain_id'  # groups subsections into an independent Basics->Intermediate->Advanced chain
    BLOCKS = 'blocks'  # ordered list of block-spec dicts (see BlockSpecFields)
    EXCLUDED_BLOCK_IDS = 'excluded_block_ids'  # block ids the teacher unchecked at selection time

    # Course Builder additions (a topic is a subsection)
    ICON = 'icon'  # one emoji picturing the topic
    PRIORITY = 'priority'  # 'essential' | 'supporting' | 'extension'
    TOPIC_ID = 'topic_id'  # same value as the subsection id
    SOURCE = 'source'  # 'course_builder' when built by the Course Builder


class BlockSpecFields:
    """Field names for the block-spec placeholders produced by Phase 1.5 (titles/subtypes only, no full content yet)"""

    BLOCK_ID = 'id'
    TYPE = 'type'  # 'content' | 'worksheet' | 'activity'
    SUBTYPE = 'subtype'  # closed taxonomy value — the allowed labels come from the knowledge base via get_content_subtypes() / get_worksheet_subtypes() / get_activity_subtypes() in outliner/block_prompts.py
    TITLE = 'title'
    DESCRIPTION = 'description'  # 1-2 sentence preview of what this block will contain, shown to the teacher before full content is generated
    SOURCE_BLOCK_IDS = 'source_block_ids'  # worksheet only — content block id(s) it draws its questions from

    # Course Builder additions (set on blocks built from a Stage 2 plan; all optional)
    FORMAT_ID = 'format_id'  # knowledge-base id: content type / worksheet format / activity format
    FORMAT_LABEL = 'format_label'  # display label of that format
    TOPIC_ID = 'topic_id'  # id of the topic (= subsection) the block belongs to
    ICON = 'icon'  # the topic's emoji, repeated on each of its blocks
    PART = 'part'  # int >= 1
    PART_COUNT = 'part_count'  # int >= 1; blocks with equal PART_GROUP_ID are parts of one item
    PART_GROUP_ID = 'part_group_id'
    GOES_WITH = 'goes_with'  # id of the block this worksheet/activity belongs with, else null
    OBJECTIVE_ID = 'objective_id'  # one kb_objectives category id
    GROUP_SIZE = 'group_size'  # activity only: individual | pairs | small_groups | whole_class
    RESOURCES = 'resources'  # worksheet/activity only: [{name, quantity}] for the whole class
    IS_REVISION = 'is_revision'  # bool
    DAY_POSITION = 'day_position'  # int, 0-based index in the teacher's order for the day
    GENERATION_FAILED = 'generation_failed'  # bool; empty stub when content generation failed for this block
    DURATION_MINUTES = 'duration_minutes'  # always 15 for Course Builder blocks
    NEEDS_REVIEW = 'needs_review'  # bool; Stage 2 block whose format/title the AI could not make consistent; kept in the library
    REVIEW_NOTE = 'review_note'  # short human-readable reason shown with the flag ('' when not flagged)


# Course Builder constants (mirror in frontend/src/constants/curriculumSchema.js)
COURSE_BUILDER_BLOCK_MINUTES = 15
COURSE_BUILDER_BLOCK_TYPES = ('content', 'worksheet', 'activity')
COURSE_BUILDER_PRIORITIES = ('essential', 'supporting', 'extension')
# group sizes / thinking levels come from knowledge_base_service.get_taxonomy()['vocabularies'], not here


class TopicFields:
    """Field names for topic/box objects"""
    
    TOPIC_ID = 'id'
    BOX_ID = 'box_id'
    TITLE = 'title'
    DESCRIPTION = 'description'
    DURATION = 'duration'  # Formatted string like "20 min"
    DURATION_MINUTES = 'duration_minutes'  # Integer
    PLA_TYPE = 'plaType'  # e.g., "Knowledge", "Application"
    PLA_PILLARS = 'pla_pillars'
    
    # Content details
    SUBTOPICS = 'subtopics'
    LEARNING_OBJECTIVES = 'learningObjectives'
    CONTENT_KEYWORDS = 'keywords'
    
    # Resources (populated in Phase 2 & 3)
    RESOURCES = 'resources'
    VIDEO_RESOURCES = 'video_resources'
    WORKSHEETS = 'worksheets'
    ACTIVITIES = 'activities'


# Helper function to create curriculum response for API
def format_curriculum_for_api(firestore_doc):
    """
    Format Firestore document for API response.
    Ensures all field names match the schema.
    """
    F = CurriculumFields
    
    return {
        F.COURSE_ID: firestore_doc.get(F.COURSE_ID),
        F.TEACHER_UID: firestore_doc.get(F.TEACHER_UID),
        F.TEACHER_EMAIL: firestore_doc.get(F.TEACHER_EMAIL),
        F.ORGANIZATION_ID: firestore_doc.get(F.ORGANIZATION_ID),
        F.COURSE_NAME: firestore_doc.get(F.COURSE_NAME),
        F.SUBJECT: firestore_doc.get(F.SUBJECT, ''),
        F.TOPIC: firestore_doc.get(F.TOPIC, ''),
        F.CLASS: firestore_doc.get(F.CLASS),
        F.TIME_DURATION: firestore_doc.get(F.TIME_DURATION),
        F.OBJECTIVES: firestore_doc.get(F.OBJECTIVES),
        F.AGE_RANGE_START: firestore_doc.get(F.AGE_RANGE_START, ''),
        F.AGE_RANGE_END: firestore_doc.get(F.AGE_RANGE_END, ''),
        F.NUM_STUDENTS: firestore_doc.get(F.NUM_STUDENTS, 0),
        F.NUM_DAYS: firestore_doc.get(F.NUM_DAYS, 0),
        F.HOURS_PER_DAY: firestore_doc.get(F.HOURS_PER_DAY, 0),
        F.NUM_WORKSHEETS: firestore_doc.get(F.NUM_WORKSHEETS, 0),
        F.NUM_ACTIVITIES: firestore_doc.get(F.NUM_ACTIVITIES, 0),
        F.COURSE_ATTACHMENTS: firestore_doc.get(F.COURSE_ATTACHMENTS, []),
        F.COURSE_INFO_NOTES: firestore_doc.get(F.COURSE_INFO_NOTES, ''),
        F.SECTIONS: firestore_doc.get(F.SECTIONS, []),
        F.GENERATED_TOPICS: firestore_doc.get(F.GENERATED_TOPICS, []),
        F.HANDS_ON_RESOURCES: firestore_doc.get(F.HANDS_ON_RESOURCES, {}),
        F.OUTLINE: firestore_doc.get(F.OUTLINE, {}),
        F.IS_PUBLIC: firestore_doc.get(F.IS_PUBLIC, False),
        F.SHARED_WITH: firestore_doc.get(F.SHARED_WITH, []),
        F.CREATED_AT: firestore_doc.get(F.CREATED_AT),
        F.LAST_MODIFIED: firestore_doc.get(F.LAST_MODIFIED)
    }