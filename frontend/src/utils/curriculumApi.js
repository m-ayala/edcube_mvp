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