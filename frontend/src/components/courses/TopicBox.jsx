// src/components/courses/TopicBox.jsx
const TopicBox = ({ topic, onClick, onDragStart }) => {
  const handleClick = (e) => {
    // Only trigger onClick if not dragging
    if (onClick) {
      onClick(topic);
    }
  };

  const handleDragStart = (e) => {
    if (onDragStart) {
      onDragStart(e, topic);
    }
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={handleClick}
      style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '15px',
        marginBottom: '15px',
        backgroundColor: 'white',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <h4 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>
        {topic.title}
      </h4>
      
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        marginBottom: '10px',
        flexWrap: 'wrap'
      }}>
        <span style={{ 
          padding: '4px 10px', 
          backgroundColor: '#007bff',
          color: 'white',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: '500'
        }}>
          {topic.plaType}
        </span>
        
        <span style={{ 
          padding: '4px 10px', 
          backgroundColor: '#6c757d',
          color: 'white',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          ⏱️ {topic.duration}
        </span>
      </div>

      {topic.subtopics && topic.subtopics.length > 0 && (
        <div style={{ fontSize: '13px', color: '#666' }}>
          • {topic.subtopics[0]}
          {topic.subtopics.length > 1 && (
            <span style={{ color: '#999' }}> +{topic.subtopics.length - 1} more</span>
          )}
        </div>
      )}
    </div>
  );
};

export default TopicBox;