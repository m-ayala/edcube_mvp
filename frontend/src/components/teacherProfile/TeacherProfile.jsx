// frontend/src/components/teacherProfile/TeacherProfile.jsx

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getOwnProfile, getTeacherProfile, getTeacherCourses, getSharedCourses } from '../../utils/teacherService';
import ProfileHeader from './ProfileHeader';
import ProfileCourseGrid from './ProfileCourseGrid';
import ResourceLibrary from './ResourceLibrary';
import EditProfileModal from '../modals/EditProfileModal';
import NotificationBell from '../notifications/NotificationBell';
import { navSectionsFromDoc, builderBlocksMissing, outlineExtrasOf } from '../../utils/builderCourse';
import { fetchCourseDocument } from '../../services/courseBuilderApi';
import './TeacherProfile.css';

const TeacherProfile = () => {
  const { teacherUid } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [courses, setCourses] = useState([]);
  const [sharedCourses, setSharedCourses] = useState([]);
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

      // Fetch courses shared with me (own profile only)
      if (isOwnProfile) {
        try {
          const result = await getSharedCourses(currentUser);
          setSharedCourses(result.courses || []);
        } catch (err) {
          console.error('Error loading shared courses:', err);
          setSharedCourses([]);
        }
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  // The old fixed-key mapping, used for every course that is not a Course Builder course.
  const legacySections = (course) => (course.outline?.sections || course.sections || []).map(section => ({
    id: section.id,
    title: section.title,
    description: section.description || '',
    type: section.type,
    duration: section.duration,
    subsections: (section.subsections || []).map(sub => ({
      id: sub.id,
      title: sub.title,
      description: sub.description || '',
      learning_objectives: sub.learning_objectives || [],
      duration_minutes: sub.duration_minutes ?? 20,
      content_blocks: sub.content_blocks || [],
      worksheets: sub.worksheets || [],
      activities: sub.activities || [],
      video_resources: sub.video_resources || [],
    }))
  }));

  // Sections (and extras for the navigation state) for a course from either profile list. A Course
  // Builder course keeps every field it was saved with. The profile lists do not carry
  // handsOnResources / numDays / hoursPerDay, so the full document is fetched (best effort): if
  // that is refused (e.g. a private course shared with you) and some topic's blocks are not in the
  // list payload, the course opens with `blocksIncomplete`, which stops the workspace from saving.
  const loadCourseForNav = async (course) => {
    if (!navSectionsFromDoc(course)) return { sections: legacySections(course), extraFormData: {}, extraState: {} };
    let doc = course;
    let incomplete = false;
    try {
      const full = await fetchCourseDocument(course.courseId || course.id, currentUser.uid);
      doc = { ...course, ...full };
    } catch (err) {
      console.error('Could not load the full course document:', err);
      incomplete = builderBlocksMissing(course);
    }
    return {
      sections: navSectionsFromDoc(doc),
      extraFormData: { numDays: doc.numDays, hoursPerDay: doc.hoursPerDay },
      extraState: { ...(incomplete ? { blocksIncomplete: true } : {}), ...(doc.outline ? { outlineExtras: outlineExtrasOf(doc) } : {}) },
    };
  };

  // Opening a built course waits on a network fetch: show it on the clicked card and ignore
  // further clicks until it finishes (the ref blocks a second click in the same tick).
  const [openingId, setOpeningId] = useState(null);
  const openingRef = useRef(false);
  const withOpening = (course, fn) => async () => {
    if (openingRef.current) return;
    openingRef.current = true;
    setOpeningId(course.id || course.courseId);
    try { await fn(); } finally { openingRef.current = false; setOpeningId(null); }
  };

  const handleCourseClick = (course) => withOpening(course, () => openCourse(course))();

  const openCourse = async (course) => {
    const { sections, extraFormData, extraState } = await loadCourseForNav(course);

    navigate('/course-view', {
      state: {
        formData: {
          courseName: course.courseName,
          subject: course.subject || '',
          topic: course.topic || '',
          class: course.class,
          timeDuration: course.timeDuration,
          objectives: course.objectives || '',
          ...extraFormData
        },
        sections,
        curriculumId: course.courseId || course.id,
        isPublic: course.isPublic || true,
        isOwner: isOwnProfile,
        ownerName: profile?.display_name || '',
        ...extraState
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
          <ProfileCourseGrid courses={courses} onCourseClick={handleCourseClick} loadingId={openingId} />
        )}
      </div>

      {/* Shared With Me — only visible to the owner */}
      {isOwnProfile && (
        <div className="profile-courses-section">
          <h2 className="profile-courses-header">
            Shared With Me {sharedCourses.length > 0 && `(${sharedCourses.length})`}
          </h2>
          {sharedCourses.length === 0 ? (
            <div className="profile-courses-empty">
              No courses have been shared with you yet.
            </div>
          ) : (
            <ProfileCourseGrid
              courses={sharedCourses}
              loadingId={openingId}
              onCourseClick={(course) => withOpening(course, async () => {
                const accessType = course.accessType || 'view';
                const { sections, extraFormData, extraState } = await loadCourseForNav(course);
                navigate('/course-view', {
                  state: {
                    formData: {
                      courseName: course.courseName,
                      subject: course.subject || '',
                      topic: course.topic || '',
                      class: course.class,
                      ...extraFormData,
                    },
                    sections,
                    curriculumId: course.courseId || course.id,
                    isPublic: course.isPublic || false,
                    isOwner: false,
                    ownerName: '',
                    isCollaborator: accessType === 'collaborate',
                    ...extraState,
                  }
                });
              })()}
            />
          )}
        </div>
      )}

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