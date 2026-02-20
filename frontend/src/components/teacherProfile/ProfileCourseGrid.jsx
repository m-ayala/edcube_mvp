// frontend/src/components/teacherProfile/ProfileCourseGrid.jsx

const ProfileCourseGrid = ({ courses, onCourseClick }) => {
  if (!courses || courses.length === 0) return null;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: '20px',
      padding: '4px'
    }}>
      {courses.map((course) => (
        <div
          key={course.id || course.courseId}
          onClick={() => onCourseClick(course)}
          style={{
            backgroundColor: '#fffdf7',
            border: '1px solid #e8dcc8',
            borderRadius: '12px',
            padding: '20px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
            e.currentTarget.style.borderColor = '#c4a97d';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
            e.currentTarget.style.borderColor = '#e8dcc8';
          }}
        >
          <h3 style={{
            margin: '0 0 10px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: '#3d2e1f',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {course.courseName || 'Untitled Course'}
          </h3>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
            {course.subject && (
              <span style={{
                backgroundColor: '#f0e6d3',
                color: '#6b5438',
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '500'
              }}>
                {course.subject}
              </span>
            )}
            {course.class && (
              <span style={{
                backgroundColor: '#e8f4e8',
                color: '#3d6b3d',
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '500'
              }}>
                {course.class}
              </span>
            )}
          </div>

          {course.topic && (
            <p style={{
              margin: '0',
              fontSize: '13px',
              color: '#8b7355',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {course.topic}
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

export default ProfileCourseGrid;
