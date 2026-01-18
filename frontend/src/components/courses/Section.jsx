// src/components/courses/Section.jsx
import { useState } from 'react';

const Section = ({ section, onDrop, onDragOver, onUpdateName, onRemove, onRemoveTopic }) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(section.name);

  if (section.type === 'break') {
    return (
      <div style={{
        padding: '15px',
        marginBottom: '15px',
        backgroundColor: '#fff3cd',
        border: '1px dashed #ffc107',
        borderRadius: '8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontWeight: '500' }}>
          ⏸️ Break - {section.duration}
        </span>
        <button
          onClick={() => onRemove(section.id)}
          style={{
            background: 'none',
            border: 'none',
            color: '#dc3545',
            cursor: 'pointer',
            fontSize: '18px'
          }}
        >
          🗑️
        </button>
      </div>
    );
  }

  const handleNameBlur = () => {
    if (tempName.trim()) {
      onUpdateName(section.id, tempName);
    } else {
      setTempName(section.name);
    }
    setIsEditingName(false);
  };

  // Safely get topics array
  const topics = Array.isArray(section.topics) ? section.topics : [];

  return (
    <div style={{
      border: '2px solid #007bff',
      borderRadius: '8px',
      padding: '15px',
      marginBottom: '15px',
      backgroundColor: 'white'
    }}>
      {/* Section Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '10px'
      }}>
        {isEditingName ? (
          <input
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyPress={(e) => e.key === 'Enter' && handleNameBlur()}
            autoFocus
            style={{
              fontSize: '16px',
              fontWeight: '600',
              border: '1px solid #007bff',
              borderRadius: '4px',
              padding: '4px 8px',
              flex: 1
            }}
          />
        ) : (
          <h4 
            style={{ margin: 0, cursor: 'pointer', flex: 1 }}
            onClick={() => setIsEditingName(true)}
          >
            {section.name || 'Unnamed Section'}
          </h4>
        )}
        
        <button
          onClick={() => onRemove(section.id)}
          style={{
            background: 'none',
            border: 'none',
            color: '#dc3545',
            cursor: 'pointer',
            fontSize: '18px'
          }}
        >
          🗑️
        </button>
      </div>

      {/* Drop Zone */}
      <div
        onDrop={(e) => onDrop(e, section.id)}
        onDragOver={onDragOver}
        style={{
          minHeight: '100px',
          border: '2px dashed #ccc',
          borderRadius: '6px',
          padding: '10px',
          backgroundColor: '#f9f9f9'
        }}
      >
        {topics.length > 0 ? (
          topics.map((topic, index) => {
            // Make sure we have a valid topic object
            if (!topic || typeof topic !== 'object') {
              console.warn('Invalid topic:', topic);
              return null;
            }

            // Get topic properties safely
            const topicId = topic.id || `topic-${index}`;
            const topicTitle = topic.title || 'Unnamed Topic';
            const topicDuration = topic.duration || 'Unknown duration';
            const topicPlaType = topic.plaType || topic.pla_pillars?.[0] || 'Knowledge';

            return (
              <div
                key={topicId}
                style={{
                  padding: '10px',
                  marginBottom: '8px',
                  backgroundColor: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: '500', fontSize: '14px' }}>
                    {topicTitle}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {topicDuration} • {topicPlaType}
                  </div>
                </div>
                <button
                  onClick={() => onRemoveTopic(section.id, topicId)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#dc3545',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  ×
                </button>
              </div>
            );
          })
        ) : (
          <div style={{ 
            textAlign: 'center', 
            padding: '30px 10px', 
            color: '#999',
            fontSize: '14px'
          }}>
            Drag topics here to build your course outline
          </div>
        )}
      </div>
    </div>
  );
};

export default Section;