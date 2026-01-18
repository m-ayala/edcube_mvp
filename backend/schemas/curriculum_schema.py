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
    
    # Course metadata
    COURSE_NAME = 'courseName'
    CLASS = 'class'  # Grade level
    SUBJECT = 'subject'
    TOPIC = 'topic'
    TIME_DURATION = 'timeDuration'  # e.g., "6 hours"
    OBJECTIVES = 'objectives'
    
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
        F.COURSE_NAME: firestore_doc.get(F.COURSE_NAME),
        F.CLASS: firestore_doc.get(F.CLASS),
        F.SUBJECT: firestore_doc.get(F.SUBJECT),
        F.TOPIC: firestore_doc.get(F.TOPIC),
        F.TIME_DURATION: firestore_doc.get(F.TIME_DURATION),
        F.OBJECTIVES: firestore_doc.get(F.OBJECTIVES),
        F.SECTIONS: firestore_doc.get(F.SECTIONS, []),
        F.GENERATED_TOPICS: firestore_doc.get(F.GENERATED_TOPICS, []),
        F.HANDS_ON_RESOURCES: firestore_doc.get(F.HANDS_ON_RESOURCES, {}),
        F.OUTLINE: firestore_doc.get(F.OUTLINE, {}),
        F.IS_PUBLIC: firestore_doc.get(F.IS_PUBLIC, False),
        F.SHARED_WITH: firestore_doc.get(F.SHARED_WITH, []),
        F.CREATED_AT: firestore_doc.get(F.CREATED_AT),
        F.LAST_MODIFIED: firestore_doc.get(F.LAST_MODIFIED)
    }