// frontend/src/components/modals/EditProfileModal.jsx

import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { updateOwnProfile } from '../../utils/teacherService';
import { changePassword } from '../../firebase/authService';
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
  const [showPasswordChange, setShowPasswordChange] = useState(false);

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

  const handleMultiSelectChange = (e, fieldName) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
    setFormData(prev => ({
      ...prev,
      [fieldName]: selectedOptions
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Prepare update payload (only send fields that changed)
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

      // Call API to update profile
      const updatedProfile = await updateOwnProfile(currentUser, updatePayload);

      // Notify parent component
      onProfileUpdated(updatedProfile);
      
      // Close modal
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2>Edit Profile</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        {/* Form */}
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
              onClick={() => setShowPasswordChange(!showPasswordChange)}
            >
              🔒 Change Password
            </button>
            {showPasswordChange && (
              <small className="field-hint password-hint">
                To change your password, please use the "Forgot Password" option on the login page.
              </small>
            )}
          </div>

          {/* Profile Picture URL */}
          <div className="form-group">
            <label htmlFor="profile_picture_url">Profile Picture URL</label>
            <input
              type="url"
              id="profile_picture_url"
              name="profile_picture_url"
              value={formData.profile_picture_url}
              onChange={handleChange}
              placeholder="https://example.com/your-photo.jpg"
            />
            <small className="field-hint">Paste a link to your profile picture</small>
          </div>

          {/* Subjects Taught (Multi-select dropdown) */}
          <div className="form-group">
            <label htmlFor="subjects_taught">Subjects Taught</label>
            <select
              id="subjects_taught"
              name="subjects_taught"
              multiple
              value={formData.subjects_taught}
              onChange={(e) => handleMultiSelectChange(e, 'subjects_taught')}
              className="multi-select"
              size={5}
            >
              {subjectOptions.map(subject => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
            <small className="field-hint">Hold Ctrl/Cmd to select multiple subjects</small>
          </div>

          {/* Grades Taught (Multi-select dropdown) */}
          <div className="form-group">
            <label htmlFor="grades_taught">Grades/Classes Taught</label>
            <select
              id="grades_taught"
              name="grades_taught"
              multiple
              value={formData.grades_taught}
              onChange={(e) => handleMultiSelectChange(e, 'grades_taught')}
              className="multi-select"
              size={5}
            >
              {gradeOptions.map(grade => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
            <small className="field-hint">Hold Ctrl/Cmd to select multiple grades</small>
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
  );
};

export default EditProfileModal;