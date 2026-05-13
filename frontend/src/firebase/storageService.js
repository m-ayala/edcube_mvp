// frontend/src/firebase/storageService.js
// Uploads go through the FastAPI backend to avoid Firebase Storage CORS issues.

import { auth } from './config';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

const VALID_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Upload profile picture via backend → Firebase Storage.
 * @param {File} file
 * @param {string} _userId - unused (auth token identifies the user server-side)
 * @returns {Promise<string>} permanent download URL
 */
export const uploadProfilePicture = async (file, _userId) => {
  if (!VALID_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Please upload a valid image file (JPG, PNG, GIF, or WebP)');
  }
  if (file.size > MAX_SIZE) {
    throw new Error('Image size must be less than 5 MB');
  }

  const token = await auth.currentUser.getIdToken();

  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/api/upload/profile-picture`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Upload failed. Please try again.');
  }

  const { url } = await res.json();
  return url;
};
