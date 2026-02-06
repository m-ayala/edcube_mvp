// frontend/src/utils/curriculumApi.js

const API_BASE_URL = 'http://localhost:8000/api';

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