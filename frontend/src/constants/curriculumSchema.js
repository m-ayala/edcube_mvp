// frontend/src/constants/curriculumSchema.js
/**
 * Curriculum Schema - Single Source of Truth for Field Names
 * ⚠️ CRITICAL: Keep in sync with backend/schemas/curriculum_schema.py
 * Any changes here MUST be reflected in the backend schema file.
 */

export const CurriculumFields = {
  // Core identification
  COURSE_ID: 'courseId',
  TEACHER_UID: 'teacherUid',
  TEACHER_EMAIL: 'teacherEmail',
  ORGANIZATION_ID: 'organizationId',
  
  // Course metadata
  COURSE_NAME: 'courseName',
  CLASS: 'class',  // Grade level
  SUBJECT: 'subject',
  TOPIC: 'topic',
  TIME_DURATION: 'timeDuration',  // e.g., "6 hours"
  OBJECTIVES: 'objectives',
  
  // Course content
  SECTIONS: 'sections',
  GENERATED_TOPICS: 'generatedTopics',  // The boxes generated in Phase 1
  HANDS_ON_RESOURCES: 'handsOnResources',
  OUTLINE: 'outline',  // Contains sections with structure
  
  // Sharing & permissions
  IS_PUBLIC: 'isPublic',
  SHARED_WITH: 'sharedWith',
  
  // Timestamps
  CREATED_AT: 'createdAt',
  LAST_MODIFIED: 'lastModified'
};

export const SectionFields = {
  SECTION_ID: 'id',
  SECTION_NAME: 'name',
  TITLE: 'title',
  DESCRIPTION: 'description',
  DURATION_MINUTES: 'duration_minutes',
  TYPE: 'type',  // 'section' or 'break'
  TOPICS: 'topics',
  
  // Phase 2 additions
  VIDEO_RESOURCES: 'video_resources',
  SEARCH_QUERIES_USED: 'search_queries_used',
  CONTENT_COVERAGE_STATUS: 'content_coverage_status',
  
  // Phase 3 additions
  WORKSHEET_OPTIONS: 'worksheet_options',
  ACTIVITY_OPTIONS: 'activity_options',
  NEEDS_WORKSHEETS: 'needs_worksheets',
  NEEDS_ACTIVITIES: 'needs_activities',
  
  // Learning content
  LEARNING_OBJECTIVES: 'learning_objectives',
  CONTENT_KEYWORDS: 'content_keywords',
  SUBTOPICS: 'subtopics',
  PLA_PILLARS: 'pla_pillars'
};

export const TopicFields = {
  TOPIC_ID: 'id',
  BOX_ID: 'box_id',
  TITLE: 'title',
  DESCRIPTION: 'description',
  DURATION: 'duration',  // Formatted string like "20 min"
  DURATION_MINUTES: 'duration_minutes',  // Integer
  PLA_TYPE: 'plaType',  // e.g., "Knowledge", "Application"
  PLA_PILLARS: 'pla_pillars',
  
  // Content details
  SUBTOPICS: 'subtopics',
  LEARNING_OBJECTIVES: 'learningObjectives',
  CONTENT_KEYWORDS: 'keywords',
  
  // Resources (populated in Phase 2 & 3)
  RESOURCES: 'resources',
  VIDEO_RESOURCES: 'video_resources',
  WORKSHEETS: 'worksheets',
  ACTIVITIES: 'activities'
};

// Helper to safely access nested fields
export const getCurriculumField = (curriculum, field, defaultValue = null) => {
  return curriculum?.[field] ?? defaultValue;
};