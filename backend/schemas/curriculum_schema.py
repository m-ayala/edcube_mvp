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


class SubsectionFields:
    """Field names for subsection objects within sections (Phase 1.5 taxonomy)"""

    SUBSECTION_ID = 'id'
    CORE_CONCEPT = 'core_concept'  # one sentence — the single idea this subsection teaches
    DEPTH_LEVEL = 'depth_level'  # 'Basics' | 'Intermediate' | 'Advanced', relative to its section
    PREREQUISITE_SUBSECTION_ID = 'prerequisite_subsection_id'  # nullable — subsection this one builds on
    CHAIN_ID = 'chain_id'  # groups subsections into an independent Basics->Intermediate->Advanced chain
    BLOCKS = 'blocks'  # ordered list of block-spec dicts (see BlockSpecFields)
    EXCLUDED_BLOCK_IDS = 'excluded_block_ids'  # block ids the teacher unchecked at selection time


class BlockSpecFields:
    """Field names for the block-spec placeholders produced by Phase 1.5 (titles/subtypes only, no full content yet)"""

    BLOCK_ID = 'id'
    TYPE = 'type'  # 'content' | 'worksheet' | 'activity'
    SUBTYPE = 'subtype'  # closed taxonomy value — see CONTENT_SUBTYPES / WORKSHEET_SUBTYPES / ACTIVITY_SUBTYPES in outliner/block_prompts.py
    TITLE = 'title'
    DESCRIPTION = 'description'  # 1-2 sentence preview of what this block will contain, shown to the teacher before full content is generated
    SOURCE_BLOCK_IDS = 'source_block_ids'  # worksheet only — content block id(s) it draws its questions from


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