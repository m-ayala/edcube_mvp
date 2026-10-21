// frontend/src/utils/teacherService.js

const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/api/teachers`;

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

    const data = await response.json();
    // Org callers get a bare list; public callers get { teachers, next_cursor }.
    return Array.isArray(data) ? data : (Array.isArray(data?.teachers) ? data.teachers : []);
  } catch (error) {
    console.error('Error fetching teachers:', error);
    throw error;
  }
};

/**
 * Server-side teacher search for public-space users: name prefix `q`, one page
 * of up to `limit` teachers, and an opaque `cursor` for the next page.
 * Always resolves to { teachers: [], next_cursor: string|null }.
 */
export const searchTeachers = async (currentUser, { q = '', limit = 20, cursor = null } = {}) => {
  const headers = await getAuthHeader(currentUser);
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  params.set('limit', String(limit));
  if (cursor) params.set('cursor', cursor);

  const response = await fetch(`${API_BASE_URL}/?${params.toString()}`, { method: 'GET', headers });
  if (!response.ok) {
    let detail = null;
    try { detail = (await response.json()).detail; } catch { /* non-JSON body */ }
    throw new Error(typeof detail === 'string' && detail ? detail : 'Failed to fetch teachers');
  }
  const data = await response.json();
  if (Array.isArray(data)) return { teachers: data, next_cursor: null };
  return {
    teachers: Array.isArray(data?.teachers) ? data.teachers : [],
    next_cursor: data?.next_cursor ?? null,
  };
};

/**
 * Get all courses shared with the current user.
 */
export const getSharedCourses = async (currentUser) => {
  try {
    const headers = await getAuthHeader(currentUser);
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/curricula/shared-with-me`, {
      method: 'GET',
      headers
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch shared courses');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching shared courses:', error);
    throw error;
  }
};

/**
 * Get a teacher's public courses
 */
export const getTeacherCourses = async (currentUser, teacherUid) => {
  try {
    const headers = await getAuthHeader(currentUser);

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