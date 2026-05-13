// frontend/src/components/modals/EditProfileModal.jsx

import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { updateOwnProfile } from '../../utils/teacherService';
import { uploadProfilePicture } from '../../firebase/storageService';
import ChangePasswordModal from './ChangePasswordModal';
import MultiSelectDropdown from './MultiSelectDropdown';
import './EditProfileModal.css';

const EditProfileModal = ({ isOpen, onClose, currentProfile, onProfileUpdated }) => {
  const { currentUser } = useAuth();
  
  const [formData, setFormData] = useState({
    display_name: currentProfile?.display_name || '',
    email: currentProfile?.email || currentUser?.email || '',
    subjects_taught: currentProfile?.subjects_taught || [],
    grades_taught: currentProfile?.grades_taught || [],
    bio: currentProfile?.bio || '',
    profile_picture_url: currentProfile?.profile_picture_url || ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [pictureError, setPictureError] = useState('');

  // Predefined options
  const subjectOptions = [
    'Mathematics',
    'Science',
    'English',
    'Social Studies',
    'Hindi',
    'Art',
    'Music',
    'Physical Education',
    'Computer Science',
    'Sanskrit'
  ];

  const gradeOptions = [
    'Kindergarten',
    '1st Grade',
    '2nd Grade',
    '3rd Grade',
    '4th Grade',
    '5th Grade',
    '6th Grade',
    '7th Grade',
    '8th Grade'
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // NEW: Handlers for multi-select dropdowns
  const handleSubjectsChange = (selectedSubjects) => {
    setFormData(prev => ({
      ...prev,
      subjects_taught: selectedSubjects
    }));
  };

  const handleGradesChange = (selectedGrades) => {
    setFormData(prev => ({
      ...prev,
      grades_taught: selectedGrades
    }));
  };

  const handleProfilePictureChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPictureError('');
    setUploadingPicture(true);
    try {
      const url = await uploadProfilePicture(file, currentUser.uid);
      setFormData(prev => ({ ...prev, profile_picture_url: url }));
    } catch (err) {
      setPictureError(err.message || 'Upload failed. Try a smaller image.');
    } finally {
      setUploadingPicture(false);
      e.target.value = '';
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const updatePayload = {};
      
      if (formData.display_name !== currentProfile?.display_name) {
        updatePayload.display_name = formData.display_name;
      }
      if (JSON.stringify(formData.subjects_taught) !== JSON.stringify(currentProfile?.subjects_taught)) {
        updatePayload.subjects_taught = formData.subjects_taught;
      }
      if (JSON.stringify(formData.grades_taught) !== JSON.stringify(currentProfile?.grades_taught)) {
        updatePayload.grades_taught = formData.grades_taught;
      }
      if (formData.bio !== currentProfile?.bio) {
        updatePayload.bio = formData.bio;
      }
      if (formData.profile_picture_url !== currentProfile?.profile_picture_url) {
        updatePayload.profile_picture_url = formData.profile_picture_url;
      }

      const updatedProfile = await updateOwnProfile(currentUser, updatePayload);
      onProfileUpdated(updatedProfile);
      onClose();
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Edit Profile</h2>
            <button className="modal-close-btn" onClick={onClose}>×</button>
          </div>

          <form onSubmit={handleSave} className="edit-profile-form">
            {/* Display Name */}
            <div className="form-group">
              <label htmlFor="display_name">Full Name *</label>
              <input
                type="text"
                id="display_name"
                name="display_name"
                value={formData.display_name}
                onChange={handleChange}
                required
                maxLength={100}
                placeholder="Enter your full name"
              />
            </div>

            {/* Email (Read-only) */}
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                disabled
                className="readonly-field"
              />
              <small className="field-hint">Email cannot be changed</small>
            </div>

            {/* Change Password Button */}
            <div className="form-group">
              <button
                type="button"
                className="change-password-btn"
                onClick={() => setIsPasswordModalOpen(true)}
              >
                🔒 Change Password
              </button>
              <small className="field-hint password-hint">
                Click to open password change form
              </small>
            </div>

            {/* Profile Picture Upload */}
            <div className="form-group">
              <label>Profile Picture</label>
              {formData.profile_picture_url && (
                <img
                  src={formData.profile_picture_url}
                  alt="Profile preview"
                  style={{ display: 'block', width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', marginBottom: 10 }}
                />
              )}
              <input
                type="file"
                id="profile_picture_file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: 'none' }}
                onChange={handleProfilePictureChange}
                disabled={uploadingPicture}
              />
              <label htmlFor="profile_picture_file" className="btn-upload-picture">
                {uploadingPicture ? 'Uploading…' : formData.profile_picture_url ? 'Change photo' : 'Choose photo'}
              </label>
              {pictureError && <small style={{ display: 'block', color: '#d32f2f', marginTop: 6 }}>{pictureError}</small>}
              <small className="field-hint">JPG, PNG, WebP or GIF · max 5 MB</small>
            </div>

            {/* Subjects Taught - NEW COMPONENT */}
            <div className="form-group">
              <MultiSelectDropdown
                label="Subjects Taught"
                options={subjectOptions}
                selectedValues={formData.subjects_taught}
                onChange={handleSubjectsChange}
                placeholder="Select subjects..."
              />
            </div>

            {/* Grades Taught - NEW COMPONENT */}
            <div className="form-group">
              <MultiSelectDropdown
                label="Grades/Classes Taught"
                options={gradeOptions}
                selectedValues={formData.grades_taught}
                onChange={handleGradesChange}
                placeholder="Select grades..."
              />
            </div>

            {/* Bio */}
            <div className="form-group">
              <label htmlFor="bio">Bio / Introduction</label>
              <textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                maxLength={1000}
                rows={5}
                placeholder="Tell us about yourself, your teaching philosophy, interests..."
              />
              <small className="field-hint">
                {formData.bio.length}/1000 characters
              </small>
            </div>

            {/* Error Message */}
            {error && (
              <div className="error-message">
                ⚠️ {error}
              </div>
            )}

            {/* Save Button */}
            <div className="modal-footer">
              <button
                type="button"
                onClick={onClose}
                className="btn-cancel"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-save"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ChangePasswordModal 
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </>
  );
};

export default EditProfileModal;