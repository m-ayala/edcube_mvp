import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getTeacherCurricula } from '../../firebase/dbService';
import { logoutTeacher } from '../../firebase/authService';
import CourseCard from './CourseCard';
import CourseDetailsModal from '../modals/CourseDetailsModal';
import DeleteConfirmModal from '../modals/DeleteConfirmModal';

const MyCourses = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [curricula, setCurricula] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCurriculum, setSelectedCurriculum] = useState(null);
  const [deleteModalData, setDeleteModalData] = useState(null);
  const [visibilityModalData, setVisibilityModalData] = useState(null);

  useEffect(() => {
    loadCurricula();
  }, [currentUser]);

  const loadCurricula = async () => {
    try {
      setLoading(true);
      const result = await getTeacherCurricula(currentUser.uid);
      setCurricula(result.curricula);
    } catch (error) {
      console.error('Error loading curricula:', error);
      alert('Error loading your courses. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (curriculum) => {
    setSelectedCurriculum(curriculum);
  };

  const handleDeleteClick = (curriculumId, courseName) => {
    setDeleteModalData({ id: curriculumId, name: courseName });
  };

  const handleToggleVisibility = (curriculum) => {
    setVisibilityModalData(curriculum);
  };

  const confirmToggleVisibility = async () => {
    const curriculum = visibilityModalData;
    if (!curriculum) return;

    const courseId = curriculum.courseId || curriculum.id;
    const newIsPublic = !curriculum.isPublic;

    try {
      const response = await fetch(
        `http://localhost:8000/api/curricula/${courseId}/visibility?teacherUid=${currentUser.uid}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPublic: newIsPublic })
        }
      );
      const result = await response.json();
      if (result.success) {
        setCurricula(prev =>
          prev.map(c =>
            (c.courseId || c.id) === courseId ? { ...c, isPublic: newIsPublic } : c
          )
        );
      } else {
        alert('Failed to update visibility');
      }
    } catch (error) {
      console.error('Error toggling visibility:', error);
      alert('Failed to update visibility');
    } finally {
      setVisibilityModalData(null);
    }
  };

  const handleEditCourse = (curriculum) => {
    console.log('🔧 Editing course:', curriculum);

    // New shape: sections come directly from outline, each has subsections
    const sections = (curriculum.outline?.sections || curriculum.sections || []).map(section => ({
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

    console.log('🔧 Sections for workspace:', sections);

    navigate('/course-workspace', {
      state: {
        formData: {
          courseName: curriculum.courseName,
          class: curriculum.class,
          subject: curriculum.subject,
          topic: curriculum.topic,
          timeDuration: curriculum.timeDuration,
          objectives: curriculum.objectives || ''
        },
        sections,
        isEditing: true,
        curriculumId: curriculum.courseId || curriculum.id,
        isPublic: curriculum.isPublic || false
      }
    });
  };

  const handleLogout = async () => {
    try {
      await logoutTeacher();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1>My Courses</h1>
          <p style={{ color: '#666' }}>Welcome, {currentUser?.displayName || 'Teacher'}!</p>
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: '10px 20px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Sign Out
        </button>
      </div>

      {/* Create New Course Button */}
      <button
        onClick={() => navigate('/course-designer')}
        style={{
          padding: '15px 30px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '16px',
          marginBottom: '30px'
        }}
      >
        + Create New Course
      </button>

      {/* Loading State */}
      {loading && <p>Loading your courses...</p>}

      {/* Empty State */}
      {!loading && curricula.length === 0 && (
        <div style={{ textAlign: 'center', padding: '50px', color: '#666' }}>
          <h2>No courses yet</h2>
          <p>Click "Create New Course" to get started!</p>
        </div>
      )}

      {/* Course Cards */}
      {!loading && curricula.length > 0 && (
        <div>
          {curricula.map((curriculum) => (
            <CourseCard
              key={curriculum.id}
              curriculum={curriculum}
              onCardClick={handleCardClick}
              onDelete={handleDeleteClick}
              onToggleVisibility={handleToggleVisibility}
            />
          ))}
        </div>
      )}

      {/* Course Details Modal */}
      {selectedCurriculum && (
        <CourseDetailsModal
          curriculum={selectedCurriculum}
          onClose={() => setSelectedCurriculum(null)}
          onEdit={() => {
            handleEditCourse(selectedCurriculum);
            setSelectedCurriculum(null);
          }}
        />
      )}

      {/* Visibility Confirmation Modal */}
      {visibilityModalData && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '12px', padding: '28px',
            maxWidth: '420px', width: '90%', textAlign: 'center',
            boxShadow: '0 8px 30px rgba(0,0,0,0.15)'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>
              {visibilityModalData.isPublic ? 'Make Course Private?' : 'Make Course Public?'}
            </h3>
            <p style={{ color: '#666', marginBottom: '24px', fontSize: '14px', lineHeight: '1.5' }}>
              {visibilityModalData.isPublic
                ? `"${visibilityModalData.courseName}" will no longer be visible to other teachers in your organization.`
                : `"${visibilityModalData.courseName}" will be visible to all teachers in your organization.`
              }
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setVisibilityModalData(null)}
                style={{
                  padding: '8px 20px', backgroundColor: '#f3f4f6', color: '#374151',
                  border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer',
                  fontSize: '14px', fontWeight: '500'
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmToggleVisibility}
                style={{
                  padding: '8px 20px',
                  backgroundColor: visibilityModalData.isPublic ? '#6b7280' : '#10B981',
                  color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer',
                  fontSize: '14px', fontWeight: '600'
                }}
              >
                {visibilityModalData.isPublic ? 'Make Private' : 'Make Public'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalData && (
        <DeleteConfirmModal
          courseName={deleteModalData.name}
          onConfirm={async () => {
            try {
              const { deleteCurriculum } = await import('../../firebase/dbService');
              await deleteCurriculum(deleteModalData.id);
              setDeleteModalData(null);
              loadCurricula();
            } catch (error) {
              console.error('Delete error:', error);
              alert('Error deleting course. Please try again.');
            }
          }}
          onCancel={() => setDeleteModalData(null)}
        />
      )}
    </div>
  );
};

export default MyCourses;