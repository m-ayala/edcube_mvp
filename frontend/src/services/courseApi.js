// frontend/src/services/courseApi.js
// Loads a saved course document (GET /api/curricula/{id}).

import { authFetch, legacyErrorFromResponse } from './authFetch';

const API = () => `${import.meta.env.VITE_API_BASE_URL}`;

// Rejects with an Error on a non-2xx answer.
export const fetchCourseDocument = async (curriculumId, teacherUid) => {
  const res = await authFetch(`${API()}/api/curricula/${encodeURIComponent(curriculumId)}?teacherUid=${encodeURIComponent(teacherUid)}`);
  if (!res.ok) throw await legacyErrorFromResponse(res, `The saved course could not be loaded (${res.status}).`);
  return res.json();
};
