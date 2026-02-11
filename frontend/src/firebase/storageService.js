// frontend/src/firebase/storageService.js

import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import app from './config';

const storage = getStorage(app);

/**
 * Upload profile picture to Firebase Storage
 * @param {File} file - Image file from input
 * @param {string} userId - User's UID
 * @returns {Promise<string>} - Download URL of uploaded image
 */
export const uploadProfilePicture = async (file, userId) => {
  try {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      throw new Error('Please upload a valid image file (JPG, PNG, GIF, or WebP)');
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      throw new Error('Image size must be less than 5MB');
    }

    // Create a unique filename
    const timestamp = Date.now();
    const filename = `profile_pictures/${userId}/${timestamp}_${file.name}`;

    // Create storage reference
    const storageRef = ref(storage, filename);

    // Upload file
    console.log('Uploading profile picture...');
    const snapshot = await uploadBytes(storageRef, file);

    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('✅ Profile picture uploaded successfully:', downloadURL);

    return downloadURL;
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    throw error;
  }
};

/**
 * Delete old profile picture (optional - for cleanup)
 * @param {string} imageUrl - URL of image to delete
 */
export const deleteProfilePicture = async (imageUrl) => {
  try {
    // Extract path from URL and delete
    // This is optional - you can implement if needed
    console.log('Delete function not implemented yet');
  } catch (error) {
    console.error('Error deleting profile picture:', error);
  }
};