const CourseCard = ({ curriculum, onCardClick, onDelete }) => {
  const handleDelete = (e) => {
    e.stopPropagation(); // Prevent card click when deleting
    onDelete(curriculum.id, curriculum.courseName);
  };

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

      <button
        onClick={handleDelete}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
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
  );
};

export default CourseCard;