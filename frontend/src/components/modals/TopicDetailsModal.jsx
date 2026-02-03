// src/components/modals/TopicDetailsModal.jsx
const TopicDetailsModal = ({ topic, onClose }) => {
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
          maxWidth: '700px',
          maxHeight: '80vh',
          overflow: 'auto',
          position: 'relative',
          width: '90%'
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

        {/* Loading State */}
        {topic.loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #007bff',
              borderRadius: '50%',
              width: '50px',
              height: '50px',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }} />
            <p style={{ color: '#666' }}>Loading topic details...</p>
          </div>
        ) : (
          <>
            {/* Topic Header */}
            <h2 style={{ marginTop: 0, marginBottom: '10px' }}>
              {topic.title}
            </h2>
            
            <div style={{ 
              display: 'flex', 
              gap: '10px', 
              marginBottom: '20px',
              flexWrap: 'wrap'
            }}>
              <span style={{ 
                padding: '6px 12px', 
                backgroundColor: '#007bff',
                color: 'white',
                borderRadius: '4px',
                fontSize: '14px'
              }}>
                {(topic.pla_pillars || [])[0] || 'Knowledge'}
              </span>
              
              <span style={{ 
                padding: '6px 12px', 
                backgroundColor: '#6c757d',
                color: 'white',
                borderRadius: '4px',
                fontSize: '14px'
              }}>
                ⏱️ {topic.duration_minutes ? `${topic.duration_minutes} min` : '—'}
              </span>
            </div>

            {/* Description */}
            {topic.description && (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Description</h3>
                <p style={{ color: '#666', lineHeight: '1.6' }}>{topic.description}</p>
              </div>
            )}

            {/* Subtopics */}
            {topic.content_keywords && topic.content_keywords.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Keywords</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {topic.content_keywords.map((keyword, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: '4px 10px',
                        backgroundColor: '#e9ecef',
                        borderRadius: '12px',
                        fontSize: '13px',
                        color: '#495057'
                      }}
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Learning Objectives */}
            {topic.learning_objectives && topic.learning_objectives.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Learning Objectives</h3>
                <ul style={{ paddingLeft: '20px', color: '#666' }}>
                  {topic.learning_objectives.map((objective, idx) => (
                    <li key={idx} style={{ marginBottom: '5px' }}>
                      {objective}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* What Must Be Covered */}
            {topic.what_must_be_covered && (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>What Must Be Covered</h3>
                <p style={{ color: '#666', lineHeight: '1.6', margin: 0 }}>{topic.what_must_be_covered}</p>
              </div>
            )}

            {/* Resources */}
            {topic.resources && topic.resources.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>
                  📹 Video Resources
                </h3>
                {topic.resources.map((resource, idx) => (
                  <div 
                    key={idx}
                    style={{
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      padding: '12px',
                      marginBottom: '10px',
                      backgroundColor: '#f9f9f9'
                    }}
                  >
                    <a 
                      href={resource.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ 
                        fontWeight: '500',
                        color: '#007bff',
                        textDecoration: 'none',
                        fontSize: '14px'
                      }}
                    >
                      {resource.title || 'Video Resource'}
                    </a>
                    {resource.duration && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        Duration: {resource.duration}
                      </div>
                    )}
                    {resource.channel && (
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        Channel: {resource.channel}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px',
                marginTop: '20px'
              }}
            >
              Close
            </button>
          </>
        )}
      </div>

      {/* CSS Animation for loading spinner */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default TopicDetailsModal;