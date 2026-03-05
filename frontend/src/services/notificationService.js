// frontend/src/services/notificationService.js
// Local dev: backend runs on http://localhost:8080
// For production, set VITE_API_URL env variable.

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080') + '/api/notifications';

const authHeader = async (currentUser) => {
  const token = await currentUser.getIdToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
};

export const getNotifications = async (currentUser) => {
  const headers = await authHeader(currentUser);
  const res = await fetch(API_BASE, { headers });
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
