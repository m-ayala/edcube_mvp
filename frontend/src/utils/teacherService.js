// frontend/src/utils/teacherService.js

const API_BASE_URL = 'http://localhost:8000/api/teachers';

/**
 * Get authorization header with Firebase ID token
 */
const getAuthHeader = async (currentUser) => {
  if (!currentUser) {
    throw new Error('User not authenticated');
  }
  
  const idToken = await currentUser.getIdToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`
  };
};

/**
 * Get the authenticated teacher's own profile
 * Creates default profile if doesn't exist
 */
export const getOwnProfile = async (currentUser) => {
  try {
    const headers = await getAuthHeader(currentUser);
    
    const response = await fetch(`${API_BASE_URL}/profile`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch profile');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching own profile:', error);
    throw error;
  }
};

/**
 * Update the authenticated teacher's profile
 * @param {Object} profileData - Fields to update (all optional)
 * @param {string} profileData.display_name
 * @param {string[]} profileData.subjects_taught
 * @param {string[]} profileData.grades_taught
 * @param {string} profileData.bio
 * @param {string} profileData.profile_picture_url
 */
export const updateOwnProfile = async (currentUser, profileData) => {
  try {
    const headers = await getAuthHeader(currentUser);
    
    const response = await fetch(`${API_BASE_URL}/profile`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(profileData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to update profile');
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
};

/**
 * Get any teacher's public profile by UID
 */
export const getTeacherProfile = async (currentUser, teacherUid) => {
  try {
    const headers = await getAuthHeader(currentUser);
    
    const response = await fetch(`${API_BASE_URL}/${teacherUid}`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch teacher profile');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching teacher profile:', error);
    throw error;
  }
};

/**
 * Get all teachers in the organization (for discovery page)
 */
export const getAllTeachers = async (currentUser) => {
  try {
    const headers = await getAuthHeader(currentUser);
    
    const response = await fetch(`${API_BASE_URL}/`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch teachers');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching teachers:', error);
    throw error;
  }
};

/**
 * Get a teacher's public courses (we'll build this backend endpoint later)
 */
export const getTeacherCourses = async (currentUser, teacherUid) => {
  try {
    const headers = await getAuthHeader(currentUser);
    
    // This endpoint doesn't exist yet - we'll create it in Step 6
    const response = await fetch(`${API_BASE_URL}/${teacherUid}/courses`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch courses');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching teacher courses:', error);
    throw error;
  }
};