// frontend/src/utils/curriculumApi.js

const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/api`;

/**
 * Chat with Edo AI curriculum assistant
 * @param {Object} params
 * @param {string} params.message - User message
 * @param {Object} params.context - Course + selected item context
 * @param {Array} params.conversationHistory - Prior messages [{role, content}]
 * @param {string} params.teacherUid - Teacher's user ID
 */
export const chatWithEdo = async ({
  message,
  context = null,
  conversationHistory = [],
  teacherUid = null
}) => {
  try {
    const response = await fetch(`${API_BASE_URL}/curriculum/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        context,
        conversation_history: conversationHistory,
        teacher_uid: teacherUid
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Chat failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Edo chat error:', error);
    throw error;
  }
};

/**
 * Generate context-specific quick-chips for Edo block generation
 */
export const generateEdoChips = async ({
  blockType,
  courseTitle,
  topicTitle,
  topicDescription = null,
  subsectionTitle = null,
  ageRange = null,
  taxonomyHints = [],
}) => {
  try {
    const response = await fetch(`${API_BASE_URL}/curriculum/chips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        block_type: blockType,
        course_title: courseTitle,
        topic_title: topicTitle,
        topic_description: topicDescription,
        subsection_title: subsectionTitle,
        age_range: ageRange,
        taxonomy_hints: taxonomyHints,
      }),
    });
    if (!response.ok) throw new Error('Chip generation failed');
    return await response.json();
  } catch (error) {
    console.error('Edo chips error:', error);
    throw error;
  }
};

/**
 * Generate curriculum content at any level
 * @param {Object} params - Generation parameters
 * @param {string} params.level - "sections" | "subsections" | "topics"
 * @param {Object} params.context - Context for generation
 * @param {string} params.userGuidance - Optional user guidance
 * @param {number} params.count - Number of items to generate
 * @param {string} params.teacherUid - Teacher's user ID
 */
export const generateCurriculumContent = async ({
  level,
  context,
  userGuidance = null,
  count = 3,
  teacherUid
}) => {
  try {
    const response = await fetch(`${API_BASE_URL}/curriculum/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        level,
        context,
        user_guidance: userGuidance,
        count,
        teacher_uid: teacherUid
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Generation failed');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

/**
 * Generate relevant links for a block using the backend video/worksheet/activity generators.
 * - content blocks → YouTube video links via video generator
 * - worksheet blocks → worksheet source URLs via worksheet generator
 * - activity blocks → YouTube demo/tutorial video links via video generator
 */
export const generateBlockLinks = async ({
  blockType,
  blockTitle,
  blockContent = '',
  topicTitle = '',
  topicDescription = '',
  gradeLevel = '',
  teacherUid = null,
}) => {
  const response = await fetch(`${API_BASE_URL}/curriculum/generate-block-links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      blockType,
      blockTitle,
      blockContent,
      topicTitle,
      topicDescription,
      gradeLevel,
      teacherUid,
    }),
  });
  if (!response.ok) throw new Error('Link generation failed');
  return await response.json(); // { links: [{ url, label, type }] }
};

/**
 * Generate a one-paragraph course description from course info.
 * @param {Object} params
 * @param {string} params.courseName
 * @param {string} params.ageRangeStart
 * @param {string} params.ageRangeEnd
 * @param {string} params.numStudents
 * @param {string} params.timeDuration
 * @param {string} params.timeUnit
 * @param {string} params.objectives
 * @param {string} params.teacherUid
 */
export const generateCourseDescription = async ({
  courseName,
  ageRangeStart = '',
  ageRangeEnd = '',
  numStudents = '',
  timeDuration = '',
  timeUnit = '',
  objectives = '',
  teacherUid = null,
}) => {
  const response = await fetch(`${API_BASE_URL}/curriculum/generate-description`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courseName, ageRangeStart, ageRangeEnd, numStudents, timeDuration, timeUnit, objectives, teacherUid }),
  });
  if (!response.ok) throw new Error('Description generation failed');
  return await response.json(); // { success: true, description: string }
};

// ── Course Info / Attachment APIs ────────────────────────────────────────────

/**
 * Upload a new attachment to an existing course.
 */
export const uploadCourseAttachment = async (curriculumId, file, description, teacherUid) => {
  const form = new FormData();
  form.append('file', file);
  form.append('description', description || '');
  form.append('teacherUid', teacherUid);

  const response = await fetch(`${API_BASE_URL}/curricula/${curriculumId}/attachments`, {
    method: 'POST',
    body: form,
  });
  if (!response.ok) throw new Error('Attachment upload failed');
  return await response.json(); // { success, attachment }
};

/**
 * Update an attachment's description or isActive toggle.
 */
export const updateCourseAttachment = async (curriculumId, attachmentId, { description, isActive }, teacherUid) => {
  const response = await fetch(
    `${API_BASE_URL}/curricula/${curriculumId}/attachments/${attachmentId}?teacherUid=${encodeURIComponent(teacherUid)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, isActive }),
    }
  );
  if (!response.ok) throw new Error('Attachment update failed');
  return await response.json();
};

/**
 * Delete an attachment from a course.
 */
export const deleteCourseAttachment = async (curriculumId, attachmentId, teacherUid) => {
  const response = await fetch(
    `${API_BASE_URL}/curricula/${curriculumId}/attachments/${attachmentId}?teacherUid=${encodeURIComponent(teacherUid)}`,
    { method: 'DELETE' }
  );
  if (!response.ok) throw new Error('Attachment delete failed');
  return await response.json();
};

/**
 * Update the teacher's free-text course info notes.
 */
export const updateCourseInfoNotes = async (curriculumId, notes, teacherUid) => {
  const response = await fetch(`${API_BASE_URL}/curricula/${curriculumId}/course-info-notes`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes, teacherUid }),
  });
  if (!response.ok) throw new Error('Course info notes update failed');
  return await response.json();
};

/**
 * Generate a parent-facing narrative synopsis of a completed course.
 * @param {Object} params
 * @param {string} params.courseName
 * @param {string} params.classLevel
 * @param {string} params.teacherUid
 * @param {Array}  params.selectedBlocks - [{ sectionTitle, subsectionTitle, blockType, blockTitle, blockContent }]
 */
export const generateSynopsis = async ({
  courseName,
  classLevel = '',
  teacherUid = null,
  selectedBlocks = [],
}) => {
  const response = await fetch(`${API_BASE_URL}/curriculum/generate-synopsis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courseName, classLevel, teacherUid, selectedBlocks }),
  });
  if (!response.ok) throw new Error('Synopsis generation failed');
  return await response.json(); // { success: true, synopsis: string }
};