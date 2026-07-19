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
  PLA_PILLARS: 'pla_pillars',

  // Phase 1.5 additions
  DEPTH_CEILING: 'depth_ceiling'  // 'Basics' | 'Intermediate' | 'Advanced' — how deep this section may go
};

export const SubsectionFields = {
  SUBSECTION_ID: 'id',
  CORE_CONCEPT: 'core_concept',  // one sentence — the single idea this subsection teaches
  DEPTH_LEVEL: 'depth_level',  // 'Basics' | 'Intermediate' | 'Advanced', relative to its section
  PREREQUISITE_SUBSECTION_ID: 'prerequisite_subsection_id',  // nullable — subsection this one builds on
  CHAIN_ID: 'chain_id',  // groups subsections into an independent Basics->Intermediate->Advanced chain
  BLOCKS: 'blocks',  // ordered list of block-spec dicts (see BlockSpecFields)
  EXCLUDED_BLOCK_IDS: 'excluded_block_ids'  // block ids the teacher unchecked at selection time
};

export const BlockSpecFields = {
  BLOCK_ID: 'id',
  TYPE: 'type',  // 'content' | 'worksheet' | 'activity'
  SUBTYPE: 'subtype',  // closed taxonomy value — see CONTENT_SUBTYPES / WORKSHEET_SUBTYPES / ACTIVITY_SUBTYPES in curriculumApi.js/backend block_prompts.py
  TITLE: 'title',
  DESCRIPTION: 'description',  // 1-2 sentence preview of what this block will contain, shown to the teacher before full content is generated
  SOURCE_BLOCK_IDS: 'source_block_ids'  // worksheet only — content block id(s) it draws its questions from
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