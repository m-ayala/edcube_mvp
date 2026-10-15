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
  SUBJECT: 'subject',  // Auto-detected broad discipline, e.g. "Biology" — never manually typed
  TOPIC: 'topic',  // Auto-detected mid-level category, e.g. "Plants" — never manually typed
  CLASS: 'class',  // Grade level
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
  DEPTH_CEILING: 'depth_ceiling',  // 'Basics' | 'Intermediate' | 'Advanced' — how deep this section may go

  // Course Builder additions (Stage 1 day cards; a section is one day)
  BULLETS: 'bullets',  // exactly 3 short strings — what the day covers
  LEADS_TO: 'leads_to',  // one sentence — how this day sets up the next
  OBJECTIVE_IDS: 'objective_ids',  // kb_objectives category ids the day touches

  // Course Builder additions (Stage 2 day plan; set only on sections built by the Course Builder)
  DAY_SCHEDULE: 'day_schedule',  // ordered list of block ids: the teacher's exact order for the day
  SLOTS: 'slots',  // int — 15-minute blocks the day holds
  BLOCK_MINUTES: 'block_minutes',  // int — length of every block in the day (15)
  DAY_TOPICS: 'day_topics'  // list of {id, title, icon, priority} — the day's topics (= its subsections)
};

export const SubsectionFields = {
  SUBSECTION_ID: 'id',
  CORE_CONCEPT: 'core_concept',  // one sentence — the single idea this subsection teaches
  DEPTH_LEVEL: 'depth_level',  // 'Basics' | 'Intermediate' | 'Advanced', relative to its section
  PREREQUISITE_SUBSECTION_ID: 'prerequisite_subsection_id',  // nullable — subsection this one builds on
  CHAIN_ID: 'chain_id',  // groups subsections into an independent Basics->Intermediate->Advanced chain
  BLOCKS: 'blocks',  // ordered list of block-spec dicts (see BlockSpecFields)
  EXCLUDED_BLOCK_IDS: 'excluded_block_ids',  // block ids the teacher unchecked at selection time

  // Course Builder additions (a topic is a subsection)
  ICON: 'icon',  // one emoji picturing the topic
  PRIORITY: 'priority',  // 'essential' | 'supporting' | 'extension'
  TOPIC_ID: 'topic_id',  // same value as the subsection id
  SOURCE: 'source'  // 'course_builder' when built by the Course Builder
};

export const BlockSpecFields = {
  BLOCK_ID: 'id',
  TYPE: 'type',  // 'content' | 'worksheet' | 'activity'
  SUBTYPE: 'subtype',  // closed taxonomy value — see CONTENT_SUBTYPES / WORKSHEET_SUBTYPES / ACTIVITY_SUBTYPES in curriculumApi.js/backend block_prompts.py
  TITLE: 'title',
  DESCRIPTION: 'description',  // 1-2 sentence preview of what this block will contain, shown to the teacher before full content is generated
  SOURCE_BLOCK_IDS: 'source_block_ids',  // worksheet only — content block id(s) it draws its questions from

  // Course Builder additions (set on blocks built from a Stage 2 plan; all optional)
  FORMAT_ID: 'format_id',  // knowledge-base id: content type / worksheet format / activity format
  FORMAT_LABEL: 'format_label',  // display label of that format
  TOPIC_ID: 'topic_id',  // id of the topic (= subsection) the block belongs to
  ICON: 'icon',  // the topic's emoji, repeated on each of its blocks
  PART: 'part',  // int >= 1
  PART_COUNT: 'part_count',  // int >= 1; blocks with equal PART_GROUP_ID are parts of one item
  PART_GROUP_ID: 'part_group_id',
  GOES_WITH: 'goes_with',  // id of the block this worksheet/activity belongs with, else null
  OBJECTIVE_ID: 'objective_id',  // one kb_objectives category id
  GROUP_SIZE: 'group_size',  // activity only: individual | pairs | small_groups | whole_class
  RESOURCES: 'resources',  // worksheet/activity only: [{name, quantity}] for the whole class
  IS_REVISION: 'is_revision',  // bool
  DAY_POSITION: 'day_position',  // int, 0-based index in the teacher's order for the day
  GENERATION_FAILED: 'generation_failed',  // bool; empty stub when content generation failed for this block
  DURATION_MINUTES: 'duration_minutes',  // always 15 for Course Builder blocks
  NEEDS_REVIEW: 'needs_review',  // bool; Stage 2 block whose format/title the AI could not make consistent
  REVIEW_NOTE: 'review_note'  // short human-readable reason shown with the flag ('' when not flagged)
};

// Course Builder constants (mirror of backend/schemas/curriculum_schema.py)
export const COURSE_BUILDER_BLOCK_MINUTES = 15;
export const COURSE_BUILDER_BLOCK_TYPES = ['content', 'worksheet', 'activity'];
export const COURSE_BUILDER_PRIORITIES = ['essential', 'supporting', 'extension'];

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