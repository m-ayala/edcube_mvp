const CourseDetailsModal = ({ curriculum, onClose, onEdit }) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '30px',
          maxWidth: '600px',
          maxHeight: '80vh',
          overflow: 'auto',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#666'
          }}
        >
          ×
        </button>

        {/* Course Details */}
        <h2 style={{ marginTop: 0 }}>{curriculum.courseName}</h2>

        <div style={{ marginBottom: '15px' }}>
          <strong>Subject:</strong> {curriculum.subject}
        </div>

        <div style={{ marginBottom: '15px' }}>
          <strong>Class:</strong> {curriculum.class}
        </div>

        <div style={{ marginBottom: '15px' }}>
          <strong>Duration:</strong> {curriculum.timeDuration}
        </div>

        <div style={{ marginBottom: '15px' }}>
          <strong>Topic:</strong> {curriculum.topic}
        </div>

        {curriculum.objectives && (
          <div style={{ marginBottom: '15px' }}>
            <strong>Objectives:</strong>
            <p style={{ marginTop: '5px', color: '#666' }}>{curriculum.objectives}</p>
          </div>
        )}

        {/* Sections Preview */}
        {curriculum.sections && curriculum.sections.length > 0 && (
          <div style={{ marginBottom: '15px' }}>
            <strong>Sections:</strong>
            <ul style={{ marginTop: '5px' }}>
              {curriculum.sections.map((section, index) => (
                <li key={index} style={{ marginBottom: '10px' }}>
                  <strong>{section.sectionName}</strong>
                  {section.selectedWorksheets && (
                    <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                      Worksheets: {section.selectedWorksheets.length}
                    </div>
                  )}
                  {section.selectedActivities && (
                    <div style={{ fontSize: '14px', color: '#666' }}>
                      Activities: {section.selectedActivities.length}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
          <button
            onClick={onEdit}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Edit Course
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CourseDetailsModal;