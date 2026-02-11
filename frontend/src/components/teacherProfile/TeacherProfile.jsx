// frontend/src/components/teacherProfile/TeacherProfile.jsx

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getOwnProfile, getTeacherProfile } from '../../utils/teacherService';
import ProfileHeader from './ProfileHeader';
import EditProfileModal from '../modals/EditProfileModal';
import './TeacherProfile.css';

const TeacherProfile = () => {
  const { teacherUid } = useParams();
  const { currentUser } = useAuth();
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Determine if viewing own profile
  const isOwnProfile = !teacherUid || teacherUid === currentUser?.uid;

  useEffect(() => {
    loadProfile();
  }, [teacherUid, currentUser]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      let profileData;
      
      if (isOwnProfile) {
        // Fetch own profile (auto-creates if doesn't exist)
        profileData = await getOwnProfile(currentUser);
      } else {
        // Fetch another teacher's public profile
        profileData = await getTeacherProfile(currentUser, teacherUid);
      }

      setProfile(profileData);
    } catch (err) {
      console.error('Error loading profile:', err);
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = () => {
    setIsEditModalOpen(true);
  };

  const handleProfileUpdated = (updatedProfile) => {
    setProfile(updatedProfile);
  };

  // Loading State
  if (loading) {
    return (
      <div className="teacher-profile-container">
        <div className="profile-loading">
          <div className="loading-spinner"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="teacher-profile-container">
        <div className="profile-error">
          <h2>⚠️ Error Loading Profile</h2>
          <p>{error}</p>
          <button onClick={loadProfile} className="retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Success State
  return (
    <div className="teacher-profile-container">
      <ProfileHeader 
        profile={profile}
        isOwnProfile={isOwnProfile}
        onEditClick={handleEditClick}
      />

      {/* Public Courses Section - Coming in Step 6 */}
      <div className="profile-courses-section">
        <h2 className="profile-courses-header">
          Public Courses {profile.public_course_count > 0 && `(${profile.public_course_count})`}
        </h2>
        
        {profile.public_course_count === 0 ? (
          <div className="profile-courses-empty">
            {isOwnProfile 
              ? "You haven't published any courses yet. Mark courses as public in 'My Courses' to share them here."
              : `${profile.display_name} hasn't published any courses yet.`
            }
          </div>
        ) : (
          <div className="profile-courses-grid">
            {/* Course cards will go here in Step 6 */}
            <p style={{ color: '#8b7355', fontStyle: 'italic' }}>
              Course grid coming soon...
            </p>
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        currentProfile={profile}
        onProfileUpdated={handleProfileUpdated}
      />
    </div>
  );
};

export default TeacherProfile;