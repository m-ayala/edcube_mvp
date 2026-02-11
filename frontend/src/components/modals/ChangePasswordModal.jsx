// frontend/src/components/modals/ChangePasswordModal.jsx

import { useState } from 'react';
import { changePassword } from '../../firebase/authService';
import './ChangePasswordModal.css';

const ChangePasswordModal = ({ isOpen, onClose }) => {
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!passwordData.currentPassword) {
      setError('Please enter your current password');
      return;
    }

    if (!passwordData.newPassword) {
      setError('Please enter a new password');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmNewPassword) {
      setError('New passwords do not match. Please re-enter them.');
      return;
    }

    // Check if new password is same as old password
    if (passwordData.currentPassword === passwordData.newPassword) {
      setError('New password must be different from your current password');
      return;
    }

    try {
      setLoading(true);
      await changePassword(passwordData.currentPassword, passwordData.newPassword);
      
      setSuccess('Password changed successfully!');
      
      // Reset form
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: ''
      });

      // Close modal after 1.5 seconds
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err) {
      console.error('Error changing password:', err);
      
      // User-friendly error messages
      if (err.message.includes('Current password is incorrect')) {
        setError('Current password is incorrect. Please try again.');
      } else if (err.message.includes('weak-password')) {
        setError('New password is too weak. Must be at least 6 characters.');
      } else if (err.message.includes('invalid-credential') || err.message.includes('wrong-password')) {
        setError('Current password is incorrect. Please try again.');
      } else {
        setError(err.message || 'Failed to change password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="password-modal-overlay" onClick={onClose}>
      <div className="password-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="password-modal-header">
          <h2>Change Password</h2>
          <button className="password-modal-close-btn" onClick={onClose}>×</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="password-change-form">
          {/* Current Password */}
          <div className="password-form-group">
            <label htmlFor="currentPassword">Current Password *</label>
            <input
              type="password"
              id="currentPassword"
              name="currentPassword"
              value={passwordData.currentPassword}
              onChange={handleChange}
              placeholder="Enter your current password"
              disabled={loading}
              required
            />
          </div>

          {/* New Password */}
          <div className="password-form-group">
            <label htmlFor="newPassword">New Password *</label>
            <input
              type="password"
              id="newPassword"
              name="newPassword"
              value={passwordData.newPassword}
              onChange={handleChange}
              placeholder="Enter new password (min 6 characters)"
              disabled={loading}
              required
            />
          </div>

          {/* Confirm New Password */}
          <div className="password-form-group">
            <label htmlFor="confirmNewPassword">Confirm New Password *</label>
            <input
              type="password"
              id="confirmNewPassword"
              name="confirmNewPassword"
              value={passwordData.confirmNewPassword}
              onChange={handleChange}
              placeholder="Re-enter new password"
              disabled={loading}
              required
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="password-error-message">
              ⚠️ {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="password-success-message">
              ✅ {success}
            </div>
          )}

          {/* Buttons */}
          <div className="password-modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="password-btn-cancel"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="password-btn-save"
              disabled={loading}
            >
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;