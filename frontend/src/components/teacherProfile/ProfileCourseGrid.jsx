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
            backgroundColor: '#ffffff',
            border: '1px solid rgba(0,0,0,0.09)',
            borderRadius: '12px',
            padding: '20px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.10)';
            e.currentTarget.style.borderColor = 'rgba(0,0,0,0.18)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
            e.currentTarget.style.borderColor = 'rgba(0,0,0,0.09)';
          }}
        >
          <h3 style={{
            margin: '0 0 10px 0',
            fontSize: '18px',
            fontWeight: '600',
            color: '#111',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: "'DM Serif Display', serif"
          }}>
            {course.courseName || 'Untitled Course'}
          </h3>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
            {course.subject && (
              <span style={{
                backgroundColor: 'rgba(0,0,0,0.05)',
                color: '#222',
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: '500'
              }}>
                {course.subject}
              </span>
            )}
            {course.class && (
              <span style={{
                backgroundColor: 'rgba(0,0,0,0.05)',
                color: '#222',
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: '500'
              }}>
                Grade {course.class}
              </span>
            )}
          </div>

          {course.topic && (
            <p style={{
              margin: '0',
              fontSize: '14px',
              color: '#444',
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
