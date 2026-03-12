// frontend/src/services/notificationService.js
const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/notifications`;
const CURRICULUM_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/curricula`;

const authHeader = async (currentUser) => {
  const token = await currentUser.getIdToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
};

export const getNotifications = async (currentUser) => {
  const headers = await authHeader(currentUser);
  const res = await fetch(`${API_BASE}/`, { headers });
  if (!res.ok) throw new Error('Failed to fetch notifications');
  const data = await res.json();
  return data.notifications || [];
};

export const markAsRead = async (currentUser, notifId) => {
  const headers = await authHeader(currentUser);
  await fetch(`${API_BASE}/${notifId}/read`, { method: 'PATCH', headers });
};

export const deleteNotification = async (currentUser, notifId) => {
  const headers = await authHeader(currentUser);
  await fetch(`${API_BASE}/${notifId}`, { method: 'DELETE', headers });
};

export const getCollaborators = async (currentUser, courseId) => {
  const headers = await authHeader(currentUser);
  const res = await fetch(`${CURRICULUM_BASE}/${courseId}/shared-with`, { headers });
  if (!res.ok) throw new Error('Failed to fetch collaborators');
  const data = await res.json();
  return data.collaborators || [];
};

export const updateCollaboratorAccess = async (currentUser, courseId, uid, accessType) => {
  const headers = await authHeader(currentUser);
  const res = await fetch(`${CURRICULUM_BASE}/${courseId}/shared-with/${uid}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ access_type: accessType }),
  });
  if (!res.ok) throw new Error('Failed to update collaborator access');
  return res.json();
};

export const removeCollaborator = async (currentUser, courseId, uid) => {
  const headers = await authHeader(currentUser);
  const res = await fetch(`${CURRICULUM_BASE}/${courseId}/shared-with/${uid}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new Error('Failed to remove collaborator');
  return res.json();
};

export const sendShareInvite = async (currentUser, { courseId, courseName, recipients }) => {
  const headers = await authHeader(currentUser);
  const res = await fetch(`${API_BASE}/share`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ course_id: courseId, course_name: courseName, recipients }),
  });
  if (!res.ok) throw new Error('Failed to send share invitations');
  return res.json();
};
