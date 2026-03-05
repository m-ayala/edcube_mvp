// frontend/src/components/teacherProfile/TeacherProfile.jsx

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getOwnProfile, getTeacherProfile, getTeacherCourses } from '../../utils/teacherService';
import ProfileHeader from './ProfileHeader';
import ProfileCourseGrid from './ProfileCourseGrid';
import ResourceLibrary from './ResourceLibrary';
import EditProfileModal from '../modals/EditProfileModal';
import NotificationBell from '../notifications/NotificationBell';
import './TeacherProfile.css';

const TeacherProfile = () => {
  const { teacherUid } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Determine if viewing own profile
  const isOwnProfile = !teacherUid || teacherUid === currentUser?.uid;
  const targetUid = teacherUid || currentUser?.uid;

  useEffect(() => {
    loadProfile();
  }, [teacherUid, currentUser]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      let profileData;

      if (isOwnProfile) {
        profileData = await getOwnProfile(currentUser);
      } else {
        profileData = await getTeacherProfile(currentUser, teacherUid);
      }

      setProfile(profileData);

      // Fetch public courses for this teacher
      if (targetUid) {
        try {
          const result = await getTeacherCourses(currentUser, targetUid);
          setCourses(result.courses || []);
        } catch (err) {
          console.error('Error loading courses:', err);
          setCourses([]);
        }
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCourseClick = (course) => {
    const sections = (course.outline?.sections || course.sections || []).map(section => ({
      id: section.id,
      title: section.title,
      description: section.description || '',
      type: section.type,
      duration: section.duration,
      subsections: (section.subsections || []).map(sub => ({
        id: sub.id,
        title: sub.title,
        description: sub.description || '',
        topicBoxes: (sub.topicBoxes || []).map(topic => ({
          id: topic.id,
          title: topic.title,
          description: topic.description || '',
          duration_minutes: topic.duration_minutes || 20,
          pla_pillars: topic.pla_pillars || [],
          learning_objectives: topic.learning_objectives || [],
          content_keywords: topic.content_keywords || [],
          video_resources: topic.video_resources || [],
          worksheets: topic.worksheets || [],
          activities: topic.activities || []
        }))
      }))
    }));

    navigate('/course-view', {
      state: {
        formData: {
          courseName: course.courseName,
          class: course.class,
          subject: course.subject,
          topic: course.topic,
          timeDuration: course.timeDuration,
          objectives: course.objectives || ''
        },
        sections,
        curriculumId: course.courseId || course.id,
        isPublic: course.isPublic || true,
        isOwner: isOwnProfile,
        ownerName: profile?.display_name || ''
      }
    });
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
      {isOwnProfile && (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          width: '100%',
          paddingBottom: '12px',
        }}>
          <NotificationBell />
        </div>
      )}
      <ProfileHeader
        profile={profile}
        isOwnProfile={isOwnProfile}
        onEditClick={handleEditClick}
      />

      {/* Public Courses Section */}
      <div className="profile-courses-section">
        <h2 className="profile-courses-header">
          Public Courses {courses.length > 0 && `(${courses.length})`}
        </h2>

        {courses.length === 0 ? (
          <div className="profile-courses-empty">
            {isOwnProfile
              ? "You haven't published any courses yet. Toggle a course to 'Public' in the workspace to share it here."
              : `${profile.display_name} hasn't published any courses yet.`
            }
          </div>
        ) : (
          <ProfileCourseGrid courses={courses} onCourseClick={handleCourseClick} />
        )}
      </div>

      {/* Resource Library — private, only visible to the owner */}
      {isOwnProfile && (
        <div className="profile-courses-section">
          <ResourceLibrary currentUser={currentUser} />
        </div>
      )}

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