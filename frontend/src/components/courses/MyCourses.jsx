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
            navigate('/course-designer', { state: { curriculum: selectedCurriculum } });
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
              loadCurricula(); // Reload the list
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