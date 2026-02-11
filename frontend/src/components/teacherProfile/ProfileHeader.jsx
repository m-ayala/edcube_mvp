// frontend/src/components/teacherProfile/ProfileHeader.jsx

import { useState } from 'react';
import './TeacherProfile.css';

const ProfileHeader = ({ 
  profile, 
  isOwnProfile, 
  onEditClick 
}) => {
  const [imageError, setImageError] = useState(false);

  // Default profile picture if none provided or error loading
  const defaultProfilePic = 'https://via.placeholder.com/120/f5f5dc/8b7355?text=Teacher';
  const profilePicUrl = (!profile.profile_picture_url || imageError) 
    ? defaultProfilePic 
    : profile.profile_picture_url;

  return (
    <div className="profile-header">
      <div className="profile-header-content">
        {/* Left: Profile Picture */}
        <div className="profile-picture-section">
          <img 
            src={profilePicUrl}
            alt={`${profile.display_name}'s profile`}
            className="profile-picture"
            onError={() => setImageError(true)}
          />
        </div>

        {/* Right: Profile Info */}
        <div className="profile-info-section">
          {/* Name and Edit Button Row */}
          <div className="profile-header-row">
            <h1 className="profile-name">{profile.display_name}</h1>
            {isOwnProfile && (
              <button 
                className="edit-profile-btn"
                onClick={onEditClick}
              >
                ✏️ Edit Profile
              </button>
            )}
          </div>

          {/* Subjects and Grades */}
          <div className="profile-meta">
            {profile.subjects_taught && profile.subjects_taught.length > 0 && (
              <div className="profile-meta-item">
                <span className="meta-label">Subjects:</span>
                <span className="meta-value">
                  {profile.subjects_taught.join(', ')}
                </span>
              </div>
            )}

            {profile.grades_taught && profile.grades_taught.length > 0 && (
              <div className="profile-meta-item">
                <span className="meta-label">Grades:</span>
                <span className="meta-value">
                  {profile.grades_taught.join(', ')}
                </span>
              </div>
            )}

            {/* Public Course Count */}
            {profile.public_course_count !== undefined && (
              <div className="profile-meta-item">
                <span className="meta-label">Public Courses:</span>
                <span className="meta-value">
                  {profile.public_course_count}
                </span>
              </div>
            )}
          </div>

          {/* Bio */}
          {profile.bio && profile.bio.trim() !== '' && (
            <div className="profile-bio">
              <p>{profile.bio}</p>
            </div>
          )}

          {/* Empty State Messages */}
          {isOwnProfile && (
            <>
              {(!profile.subjects_taught || profile.subjects_taught.length === 0) && 
               (!profile.grades_taught || profile.grades_taught.length === 0) && (
                <p className="profile-empty-state">
                  Click "Edit Profile" to add your subjects and grades
                </p>
              )}
              {(!profile.bio || profile.bio.trim() === '') && (
                <p className="profile-empty-state">
                  Click "Edit Profile" to add a bio
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;