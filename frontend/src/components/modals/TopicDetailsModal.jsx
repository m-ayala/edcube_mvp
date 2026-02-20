// src/components/modals/TopicDetailsModal.jsx
import { useState } from 'react';
import { X, Edit2, Check, Trash2, Plus, Sparkles, ExternalLink } from 'lucide-react';
import AddResourceModal from './AddResourceModal';

const TopicDetailsModal = ({
  topic,
  sectionId,
  subsectionId,
  onClose,
  onSave,
  actions,
  videosByTopic,
  handsOnResources,
  readOnly
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTopic, setEditedTopic] = useState({
    title: topic.title,
    description: topic.description || '',
    duration_minutes: topic.duration_minutes || 20,
    learning_objectives: [...(topic.learning_objectives || [])],
    content_keywords: [...(topic.content_keywords || [])],
    pla_pillars: [...(topic.pla_pillars || [])]
  });
  
  const [showAddResourceModal, setShowAddResourceModal] = useState(null);
  const [newObjective, setNewObjective] = useState('');

  const videos = videosByTopic?.[topic.id] || [];
  const allResources = handsOnResources?.[topic.id] || [];
  const worksheets = allResources.filter(r => r.type === 'worksheet');
  const activities = allResources.filter(r => r.type === 'activity');

  const colors = {
    bg: '#FAF9F6',
    card: '#FFFFFF',
    accent: '#D4C4A8',
    accentLight: '#F5F3EE',
    textPrimary: '#2C2A26',
    textSecondary: '#6B6760',
    border: '#E8E6E1',
    dangerBtn: '#E57373',
    pla: {
      'Personal Growth': '#E8A5A5',
      'Core Learning': '#A5C9E8',
      'Critical Thinking': '#B8E8A5',
      'Application & Impact': '#E8D5A5'
    }
  };

  const handleSave = () => {
    onSave({
      sectionId,
      subsectionId,
      topicId: topic.id,
      updatedData: editedTopic
    });
    setIsEditing(false);
  };

  const handleAddObjective = () => {
    if (newObjective.trim()) {
      setEditedTopic({
        ...editedTopic,
        learning_objectives: [...editedTopic.learning_objectives, newObjective.trim()]
      });
      setNewObjective('');
    }
  };

  const handleRemoveObjective = (index) => {
    setEditedTopic({
      ...editedTopic,
      learning_objectives: editedTopic.learning_objectives.filter((_, i) => i !== index)
    });
  };

  const handleUpdateObjective = (index, value) => {
    const updated = [...editedTopic.learning_objectives];
    updated[index] = value;
    setEditedTopic({
      ...editedTopic,
      learning_objectives: updated
    });
  };

  const handleAddResource = (resourceData) => {
    if (actions?.addManualResource) {
      actions.addManualResource(topic.id, resourceData.type, resourceData);
    }
    setShowAddResourceModal(null);
  };

  const handleGenerateVideos = () => {
    if (actions?.generateVideosFromBackend) {
      actions.generateVideosFromBackend(topic);
    }
  };

  const handleGenerateResource = (type) => {
    if (actions?.generateResource) {
      actions.generateResource(topic.id, type);
    }
  };

  const Pill = ({ label, color }) => (
    <span style={{
      display: 'inline-block',
      padding: '5px 12px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '500',
      backgroundColor: color?.bg || colors.accentLight,
      color: color?.text || colors.textSecondary
    }}>
      {label}
    </span>
  );

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}
        onClick={onClose}
      >
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '900px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '700', letterSpacing: '0.5px' }}>
                  TOPIC TITLE
                </label>
                {!readOnly && (
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      color: colors.accent
                    }}
                    title={isEditing ? 'Done editing' : 'Edit topic'}
                  >
                    {isEditing ? <Check size={16} /> : <Edit2 size={16} />}
                  </button>
                )}
              </div>
              
              {isEditing ? (
                <input
                  type="text"
                  value={editedTopic.title}
                  onChange={(e) => setEditedTopic({ ...editedTopic, title: e.target.value })}
                  style={{
                    fontSize: '26px',
                    fontWeight: '700',
                    color: colors.textPrimary,
                    border: '2px solid #000',
                    background: '#fff',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    width: '100%',
                    outline: 'none'
                  }}
                />
              ) : (
                <h2 style={{ margin: 0, fontSize: '26px', fontWeight: '700', color: colors.textPrimary }}>
                  {editedTopic.title}
                </h2>
              )}
            </div>
            
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                marginLeft: '16px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={28} style={{ color: colors.textSecondary }} />
            </button>
          </div>

          {/* Description */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: colors.textSecondary, marginBottom: '8px', fontWeight: '700', letterSpacing: '0.5px' }}>
              DESCRIPTION
            </label>
            {isEditing ? (
              <textarea
                value={editedTopic.description}
                onChange={(e) => setEditedTopic({ ...editedTopic, description: e.target.value })}
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '12px 16px',
                  border: '2px solid #000',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: colors.textPrimary,
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'inherit',
                  lineHeight: '1.6'
                }}
                placeholder="Add a description..."
              />
            ) : (
              <p style={{ 
                margin: 0, 
                fontSize: '14px', 
                color: colors.textSecondary, 
                lineHeight: '1.6',
                fontStyle: editedTopic.description ? 'normal' : 'italic'
              }}>
                {editedTopic.description || 'No description yet'}
              </p>
            )}
          </div>

          {/* Meta Info Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '20px', marginBottom: '28px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: colors.textSecondary, marginBottom: '8px', fontWeight: '700', letterSpacing: '0.5px' }}>
                DURATION
              </label>
              {isEditing ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    value={editedTopic.duration_minutes}
                    onChange={(e) => setEditedTopic({ ...editedTopic, duration_minutes: parseInt(e.target.value) || 0 })}
                    min="0"
                    style={{
                      width: '70px',
                      padding: '8px 12px',
                      border: '2px solid #000',
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                  <span style={{ fontSize: '14px', color: colors.textSecondary }}>min</span>
                </div>
              ) : (
                <Pill label={`${editedTopic.duration_minutes} min`} />
              )}
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: colors.textSecondary, marginBottom: '8px', fontWeight: '700', letterSpacing: '0.5px' }}>
                PLA PILLARS
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {editedTopic.pla_pillars.length > 0 ? (
                  editedTopic.pla_pillars.map((pillar, idx) => (
                    <Pill 
                      key={idx}
                      label={pillar} 
                      color={{ 
                        bg: colors.pla[pillar] || colors.accentLight, 
                        text: colors.textPrimary 
                      }} 
                    />
                  ))
                ) : (
                  <span style={{ fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>No pillars assigned</span>
                )}
              </div>
            </div>
          </div>

          {/* Learning Objectives */}
          <div style={{ marginBottom: '28px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: colors.textSecondary, marginBottom: '12px', fontWeight: '700', letterSpacing: '0.5px' }}>
              LEARNING OBJECTIVES
            </label>
            
            {editedTopic.learning_objectives.length > 0 ? (
              <ul style={{ margin: '0 0 12px', paddingLeft: '24px', listStyle: 'disc' }}>
                {editedTopic.learning_objectives.map((obj, idx) => (
                  <li key={idx} style={{ marginBottom: '10px', color: colors.textPrimary, fontSize: '14px', lineHeight: '1.5' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={obj}
                          onChange={(e) => handleUpdateObjective(idx, e.target.value)}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            border: '1px solid #E8E6E1',
                            borderRadius: '6px',
                            fontSize: '13px',
                            outline: 'none'
                          }}
                        />
                        <button
                          onClick={() => handleRemoveObjective(idx)}
                          style={{
                            padding: '6px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: colors.dangerBtn,
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : obj}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>
                No learning objectives yet
              </p>
            )}
            
            {isEditing && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={newObjective}
                  onChange={(e) => setNewObjective(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddObjective()}
                  placeholder="Add a new learning objective..."
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: '1px solid #E8E6E1',
                    borderRadius: '6px',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
                <button
                  onClick={handleAddObjective}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: colors.accentLight,
                    color: colors.textSecondary,
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: '1px', backgroundColor: colors.border, marginBottom: '28px' }}></div>

          {/* Video Resources */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '700', letterSpacing: '0.5px' }}>
                VIDEO RESOURCES
              </label>
              {!readOnly && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setShowAddResourceModal({ type: 'video' })}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: 'transparent',
                      color: colors.accent,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Plus size={14} /> Add
                  </button>
                  <button
                    onClick={handleGenerateVideos}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: colors.accent,
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Sparkles size={14} /> AI
                  </button>
                </div>
              )}
            </div>
            
            {videos.length === 0 ? (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                backgroundColor: colors.accentLight,
                borderRadius: '8px',
                border: `1px dashed ${colors.border}`
              }}>
                <p style={{ margin: 0, fontSize: '13px', color: colors.textSecondary, fontStyle: 'italic' }}>
                  No videos yet. Add a link or generate with AI.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {videos.map((video, idx) => (
                  <a
                    key={idx}
                    href={video.url || `https://www.youtube.com/watch?v=${video.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      gap: '14px',
                      padding: '12px',
                      backgroundColor: '#fafafa',
                      border: '1px solid #e5e7eb',
                      borderRadius: '10px',
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                      e.currentTarget.style.borderColor = colors.accent;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#fafafa';
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }}
                  >
                    {video.thumbnailUrl && (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        style={{ 
                          width: '120px', 
                          height: '90px', 
                          objectFit: 'cover', 
                          borderRadius: '6px', 
                          flexShrink: 0 
                        }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ 
                        margin: '0 0 6px', 
                        fontSize: '14px', 
                        fontWeight: '600', 
                        color: colors.textPrimary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {video.title}
                      </p>
                      {video.channelName && (
                        <p style={{ margin: '0 0 4px', fontSize: '12px', color: colors.textSecondary }}>
                          {video.channelName} {video.duration && `• ${video.duration}`}
                        </p>
                      )}
                    </div>
                    <ExternalLink size={18} style={{ color: colors.accent, flexShrink: 0, marginTop: '4px' }} />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Worksheets */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '700', letterSpacing: '0.5px' }}>
                WORKSHEETS
              </label>
              {!readOnly && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setShowAddResourceModal({ type: 'worksheet' })}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: 'transparent',
                      color: colors.accent,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Plus size={14} /> Add
                  </button>
                  <button
                    onClick={() => handleGenerateResource('worksheet')}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: colors.accent,
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Sparkles size={14} /> AI
                  </button>
                </div>
              )}
            </div>
            
            {worksheets.length === 0 ? (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                backgroundColor: colors.accentLight,
                borderRadius: '8px',
                border: `1px dashed ${colors.border}`
              }}>
                <p style={{ margin: 0, fontSize: '13px', color: colors.textSecondary, fontStyle: 'italic' }}>
                  No worksheets yet. Add a link or generate with AI.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {worksheets.map((ws, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '14px 16px',
                      backgroundColor: colors.accentLight,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '10px'
                    }}
                  >
                    <p style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: '600', color: colors.textPrimary }}>
                      {ws.title}
                    </p>
                    {ws.description && (
                      <p style={{ margin: '0 0 8px', fontSize: '13px', color: colors.textSecondary }}>
                        {ws.description}
                      </p>
                    )}
                    {(ws.url || ws.sourceUrl) && (
                      <a
                        href={ws.url || ws.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '13px',
                          color: colors.accent,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: '600'
                        }}
                      >
                        View Resource <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activities */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '700', letterSpacing: '0.5px' }}>
                ACTIVITIES
              </label>
              {!readOnly && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setShowAddResourceModal({ type: 'activity' })}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: 'transparent',
                      color: colors.accent,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Plus size={14} /> Add
                  </button>
                  <button
                    onClick={() => handleGenerateResource('activity')}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: colors.accent,
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Sparkles size={14} /> AI
                  </button>
                </div>
              )}
            </div>
            
            {activities.length === 0 ? (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                backgroundColor: colors.accentLight,
                borderRadius: '8px',
                border: `1px dashed ${colors.border}`
              }}>
                <p style={{ margin: 0, fontSize: '13px', color: colors.textSecondary, fontStyle: 'italic' }}>
                  No activities yet. Add a link or generate with AI.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {activities.map((act, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '14px 16px',
                      backgroundColor: colors.accentLight,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '10px'
                    }}
                  >
                    <p style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: '600', color: colors.textPrimary }}>
                      {act.title}
                    </p>
                    {act.description && (
                      <p style={{ margin: '0 0 8px', fontSize: '13px', color: colors.textSecondary, lineHeight: '1.5' }}>
                        {act.description}
                      </p>
                    )}
                    {(act.url || act.sourceUrl) && (
                      <a
                        href={act.url || act.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '13px',
                          color: colors.accent,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: '600'
                        }}
                      >
                        View Resource <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            justifyContent: 'flex-end', 
            paddingTop: '20px', 
            borderTop: `1px solid ${colors.border}` 
          }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 24px',
                backgroundColor: '#f3f4f6',
                color: colors.textPrimary,
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#e5e7eb'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#f3f4f6'}
            >
              Close
            </button>
            {isEditing && (
              <button
                onClick={handleSave}
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#16a34a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#15803d'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#16a34a'}
              >
                <Check size={16} /> Save Changes
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Add Resource Modal */}
      <AddResourceModal
        isOpen={showAddResourceModal !== null}
        onClose={() => setShowAddResourceModal(null)}
        onAdd={handleAddResource}
        resourceType={showAddResourceModal?.type || 'video'}
      />
    </>
  );
};

export default TopicDetailsModal;