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

  const handleEditCourse = (curriculum) => {
    console.log('🔧 Editing course:', curriculum);
    
    // Transform sections to match CourseWorkspace format
    const transformedSections = (curriculum.sections || []).map(section => {
      return {
        id: section.id || `section-${Date.now()}-${Math.random()}`,
        name: section.name || section.title || 'Unnamed Section',
        type: section.type || 'section',
        topics: Array.isArray(section.topics) ? section.topics : []
      };
    });

    // Transform generatedTopics to match TopicBox format
    const transformedTopics = (curriculum.generatedTopics || []).map((topic, index) => {
      return {
        id: topic.id || topic.box_id || `topic-${index}`,
        title: topic.title,
        duration: topic.duration || `${topic.duration_minutes || 0} min`,
        plaType: topic.pla_pillars?.[0] || topic.plaType || 'Knowledge',
        subtopics: topic.subtopics || [],
        description: topic.description || '',
        learningObjectives: topic.learning_objectives || topic.learningObjectives || []
      };
    });

    console.log('🔧 Transformed data:', {
      sections: transformedSections,
      topics: transformedTopics
    });

    // Navigate to CourseWorkspace with transformed data
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
        generatedTopics: transformedTopics,
        existingSections: transformedSections,
        existingHandsOnResources: curriculum.handsOnResources || {},
        isEditing: true,
        curriculumId: curriculum.courseId || curriculum.id
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