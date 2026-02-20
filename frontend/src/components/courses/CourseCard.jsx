import { Eye, EyeOff } from 'lucide-react';

const CourseCard = ({ curriculum, onCardClick, onDelete, onToggleVisibility }) => {
  const handleDelete = (e) => {
    e.stopPropagation(); // Prevent card click when deleting
    onDelete(curriculum.id, curriculum.courseName);
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    onToggleVisibility(curriculum);
  };

  const isPublic = curriculum.isPublic || false;

  return (
    <div
      onClick={() => onCardClick(curriculum)}
      style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '15px',
        cursor: 'pointer',
        transition: 'box-shadow 0.3s',
        position: 'relative'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: '10px' }}>
        {curriculum.courseName}
      </h3>

      <p style={{ margin: '5px 0', color: '#666' }}>
        <strong>Subject:</strong> {curriculum.subject}
      </p>

      <p style={{ margin: '5px 0', color: '#666' }}>
        <strong>Class:</strong> {curriculum.class}
      </p>

      <p style={{ margin: '5px 0', color: '#666' }}>
        <strong>Duration:</strong> {curriculum.timeDuration}
      </p>

      {/* Top-right buttons */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        display: 'flex',
        gap: '8px',
        alignItems: 'center'
      }}>
        {/* Visibility toggle */}
        <button
          onClick={handleToggle}
          title={isPublic ? 'Course is Public — click to make Private' : 'Course is Private — click to make Public'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '5px 10px',
            backgroundColor: isPublic ? '#ECFDF5' : '#F9FAFB',
            color: isPublic ? '#065F46' : '#6B7280',
            border: `1px solid ${isPublic ? '#A7F3D0' : '#D1D5DB'}`,
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
        >
          {isPublic ? <Eye size={14} /> : <EyeOff size={14} />}
          {isPublic ? 'Public' : 'Private'}
        </button>

        {/* Delete button */}
        <button
          onClick={handleDelete}
          style={{
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '5px 10px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default CourseCard;
