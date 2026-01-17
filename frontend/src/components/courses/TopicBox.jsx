// src/components/courses/TopicBox.jsx
const TopicBox = ({ topic, onClick, onDragStart }) => {
  const getPlaColor = (plaType) => {
    const colors = {
      'Knowledge': '#ff6b6b',
      'Self-Knowledge': '#4ecdc4',
      'Wisdom': '#45b7d1',
      'Application': '#f9ca24'
    };
    return colors[plaType] || '#95a5a6';
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, topic)}
      onClick={onClick}
      style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '15px',
        marginBottom: '12px',
        cursor: 'grab',
        backgroundColor: 'white',
        transition: 'all 0.2s',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <h4 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>
        {topic.title}
      </h4>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
        <span style={{ 
          padding: '4px 8px', 
          backgroundColor: getPlaColor(topic.plaType),
          color: 'white',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: '500'
        }}>
          {topic.plaType}
        </span>
        
        <span style={{ color: '#666' }}>
          ⏱️ {topic.duration}
        </span>
      </div>

      {topic.subtopics && topic.subtopics.length > 0 && (
        <div style={{ marginTop: '10px', fontSize: '12px', color: '#888' }}>
          • {topic.subtopics[0]}
          {topic.subtopics.length > 1 && ` +${topic.subtopics.length - 1} more`}
        </div>
      )}
    </div>
  );
};

export default TopicBox;