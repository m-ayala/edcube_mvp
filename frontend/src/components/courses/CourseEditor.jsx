// src/components/courses/CourseEditor.jsx
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Edit2, Check, Trash2 } from 'lucide-react';
import AIGenerateButton from '../AIGenerateButton';

const CourseEditor = ({
  courseName,
  setCourseName,
  sections,
  setSections,
  videosByTopic,
  handsOnResources,
  formData,
  currentUser,
  actions,
  onSave,
  onUndo,
  canUndo,
  onAddBreak,
  onTopicClick,
  navigate
}) => {
  // ── Colors ────────────────────────────────────────────────────────────
  const colors = {
    bg: '#FAF9F6',
    card: '#FFFFFF',
    sectionBorder: '#E8E6E1',
    sectionBg: '#F5F3EE',
    subBorder: '#D4D0C8',
    accent: '#D4C4A8',
    accentLight: '#F5F3EE',
    textPrimary: '#2C2A26',
    textSecondary: '#6B6760',
    pillBg: '#F5F3EE',
    pillText: '#6B6760',
    videoBtn: '#D4C4A8',
    worksheetBtn: '#D4C4A8',
    activityBtn: '#D4C4A8',
    dangerBtn: '#E57373',
    pla: {
      'Personal Growth': '#E8A5A5',
      'Core Learning': '#A5C9E8',
      'Critical Thinking': '#B8E8A5',
      'Application & Impact': '#E8D5A5'
    }
  };

  // ── Drag and Drop Handler ─────────────────────────────────────────────
  const handleDragEnd = (result) => {
    const { source, destination, type } = result;

    if (!destination) return;

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    // Handle SECTION reordering
    if (type === 'SECTION') {
      const reorderedSections = Array.from(sections);
      const [movedSection] = reorderedSections.splice(source.index, 1);
      reorderedSections.splice(destination.index, 0, movedSection);
      setSections(reorderedSections);
      return;
    }

    // Handle SUBSECTION reordering within a section
    if (type === 'SUBSECTION') {
      const sectionId = source.droppableId.replace('subsections-', '');
      const section = sections.find(s => s.id === sectionId);
      
      if (section && section.subsections) {
        const reorderedSubsections = Array.from(section.subsections);
        const [movedSubsection] = reorderedSubsections.splice(source.index, 1);
        reorderedSubsections.splice(destination.index, 0, movedSubsection);
        
        const updatedSections = sections.map(s =>
          s.id === sectionId
            ? { ...s, subsections: reorderedSubsections }
            : s
        );
        setSections(updatedSections);
      }
      return;
    }

    // Handle TOPICBOX reordering within a subsection
    if (type === 'TOPICBOX') {
      const sourceSubId = source.droppableId.replace('topicboxes-', '');
      const destSubId = destination.droppableId.replace('topicboxes-', '');

      // Find source subsection and topic box
      let sourceSection = null;
      let sourceSub = null;
      let sourceTopicBox = null;
      
      for (const section of sections) {
        const sub = (section.subsections || []).find(s => s.id === sourceSubId);
        if (sub) {
          sourceSection = section;
          sourceSub = sub;
          sourceTopicBox = sub.topicBoxes[source.index];
          break;
        }
      }

      // Find destination subsection
      let destSection = null;
      let destSub = null;
      
      for (const section of sections) {
        const sub = (section.subsections || []).find(s => s.id === destSubId);
        if (sub) {
          destSection = section;
          destSub = sub;
          break;
        }
      }

      if (!sourceSection || !sourceSub || !sourceTopicBox || !destSection || !destSub) return;

      // Same subsection - just reorder
      if (sourceSubId === destSubId) {
        const updatedSections = sections.map(section => {
          if (section.id !== sourceSection.id) return section;
          
          return {
            ...section,
            subsections: section.subsections.map(sub => {
              if (sub.id !== sourceSubId) return sub;
              
              const reorderedTopicBoxes = Array.from(sub.topicBoxes);
              const [moved] = reorderedTopicBoxes.splice(source.index, 1);
              reorderedTopicBoxes.splice(destination.index, 0, moved);
              
              return { ...sub, topicBoxes: reorderedTopicBoxes };
            })
          };
        });
        setSections(updatedSections);
      } else {
        // Different subsections - move topic box
        const updatedSections = sections.map(section => {
          // Remove from source
          if (section.id === sourceSection.id) {
            return {
              ...section,
              subsections: section.subsections.map(sub => {
                if (sub.id === sourceSubId) {
                  return {
                    ...sub,
                    topicBoxes: sub.topicBoxes.filter((_, idx) => idx !== source.index)
                  };
                }
                return sub;
              })
            };
          }
          // Add to destination
          if (section.id === destSection.id) {
            return {
              ...section,
              subsections: section.subsections.map(sub => {
                if (sub.id === destSubId) {
                  const newTopicBoxes = [...sub.topicBoxes];
                  newTopicBoxes.splice(destination.index, 0, sourceTopicBox);
                  return { ...sub, topicBoxes: newTopicBoxes };
                }
                return sub;
              })
            };
          }
          return section;
        });
        setSections(updatedSections);
      }
      return;
    }
  };

  // ── Inline Components ─────────────────────────────────────────────────
  
  const Pill = ({ label, color }) => (
    <span style={{
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: '500',
      backgroundColor: color?.bg || colors.pillBg,
      color: color?.text || colors.pillText
    }}>
      {label}
    </span>
  );

  const EditableField = ({ 
    value, 
    onChange, 
    fieldKey, 
    placeholder = 'Click to edit',
    style = {},
    inputStyle = {}
  }) => {
    const isEditing = actions.editingField?.key === fieldKey;
    
    const handleEdit = () => {
      actions.setEditingField({ key: fieldKey, value });
    };
    
    const handleSave = () => {
      if (actions.editingField?.value !== undefined) {
        onChange(actions.editingField.value);
      }
      actions.setEditingField(null);
    };
    
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        handleSave();
      } else if (e.key === 'Escape') {
        actions.setEditingField(null);
      }
    };
    
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '6px', 
        position: 'relative',
        flex: 1,
        ...style 
      }}>
        <input
          type="text"
          value={isEditing ? (actions.editingField.value || '') : value}
          onChange={e => isEditing && actions.setEditingField({ ...actions.editingField, value: e.target.value })}
          onKeyDown={handleKeyDown}
          disabled={!isEditing}
          placeholder={placeholder}
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            outline: 'none',
            cursor: isEditing ? 'text' : 'default',
            paddingRight: '28px',
            ...inputStyle
          }}
        />
        <button
          onClick={isEditing ? handleSave : handleEdit}
          style={{
            position: 'absolute',
            right: '4px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            color: isEditing ? colors.accent : '#9ca3af'
          }}
          title={isEditing ? 'Save' : 'Edit'}
        >
          {isEditing ? <Check size={14} /> : <Edit2 size={14} />}
        </button>
      </div>
    );
  };

  const DescriptorBox = ({ value, onChange, placeholder, fieldKey }) => (
    <div style={{
      border: '1px solid #E8E6E1',
      borderRadius: '8px',
      padding: '10px 14px',
      marginBottom: '12px',
      backgroundColor: '#F5F3EE',
      position: 'relative'
    }}>
      <EditableField
        value={value}
        onChange={onChange}
        fieldKey={fieldKey}
        placeholder={placeholder || 'Add a description…'}
        inputStyle={{
          fontSize: '13px',
          color: colors.textSecondary,
          fontStyle: value ? 'normal' : 'italic'
        }}
      />
    </div>
  );

  const ConfirmDialog = ({ isOpen, onConfirm, onCancel, title, message }) => {
    if (!isOpen) return null;
    
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '400px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '18px', color: colors.textPrimary }}>
            {title}
          </h3>
          <p style={{ margin: '0 0 20px', fontSize: '14px', color: colors.textSecondary }}>
            {message}
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              onClick={onCancel}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f3f4f6',
                color: colors.textPrimary,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              style={{
                padding: '8px 16px',
                backgroundColor: colors.dangerBtn,
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Topic Box Row Component ───────────────────────────────────────────
  const TopicBoxRow = ({ topicBox, sectionId, subsectionId, dragHandleProps }) => {
    const videos = videosByTopic[topicBox.id] || [];
    const worksheets = (handsOnResources[topicBox.id] || []).filter(r => r.type === 'worksheet');
    const activities = (handsOnResources[topicBox.id] || []).filter(r => r.type === 'activity');

    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '12px',
        border: '1px solid #e5e7eb',
        borderRadius: '10px',
        overflow: 'hidden',
        backgroundColor: colors.card,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        position: 'relative',
        marginBottom: '12px'
      }}>
        {/* Drag handle */}
        <div
          {...dragHandleProps}
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            cursor: 'grab',
            zIndex: 10,
            padding: '4px',
            background: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <GripVertical size={16} style={{ color: '#9ca3af' }} />
        </div>

        {/* Col 1: Topic Info */}
        <div style={{ padding: '14px', borderRight: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
            <EditableField
              value={topicBox.title}
              onChange={val => actions.updateTopicBoxTitle(sectionId, subsectionId, topicBox.id, val)}
              fieldKey={`topic-title-${topicBox.id}`}
              placeholder="Topic title"
              style={{ flex: 1, paddingLeft: '24px' }}
              inputStyle={{
                fontSize: '14px',
                fontWeight: '600',
                color: colors.textPrimary
              }}
            />
            <button
              onClick={() => actions.confirmDeleteTopicBox(sectionId, subsectionId, topicBox.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                color: colors.dangerBtn
              }}
              title="Delete topic box"
            >
              <Trash2 size={14} />
            </button>
          </div>

          {(topicBox.learning_objectives || []).length > 0 && (
            <ul style={{ margin: '8px 0 8px 24px', paddingLeft: '16px', fontSize: '12px', color: colors.textSecondary }}>
              {topicBox.learning_objectives.map((obj, i) => (
                <li key={i} style={{ marginBottom: '2px' }}>{obj}</li>
              ))}
            </ul>
          )}

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px', paddingLeft: '24px' }}>
            <Pill label={`${topicBox.duration_minutes || 0} min`} color={{ bg: '#F5F3EE', text: colors.textSecondary }} />
            {(topicBox.pla_pillars || []).map((pillar, idx) => (
              <Pill 
                key={idx}
                label={pillar} 
                color={{ 
                  bg: colors.pla[pillar] || colors.pillBg, 
                  text: colors.textPrimary 
                }} 
              />
            ))}
          </div>
        </div>

        {/* Col 2: Videos */}
        <div style={{ padding: '14px', borderRight: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Videos</p>
            {videos.length > 0 && (
              <button onClick={() => actions.generateVideosFromBackend(topicBox)} style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'transparent',
                color: colors.videoBtn,
                border: `1px solid ${colors.videoBtn}`,
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0
              }}>↻</button>
            )}
          </div>

          {videos.length === 0 ? (
            <button onClick={() => actions.generateVideosFromBackend(topicBox)} style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: colors.videoBtn,
              color: '#2C2A26',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s',
              padding: 0
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#B8A888'}
            onMouseLeave={(e) => e.target.style.backgroundColor = colors.videoBtn}
            >
              ✨
            </button>
          ) : (
            <div>
              {videos.map((video, idx) => (
                <a key={idx}
                  href={`https://www.youtube.com/watch?v=${video.videoId}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'flex', gap: '8px', padding: '6px',
                    marginBottom: '6px', backgroundColor: '#fafafa',
                    border: '1px solid #eee', borderRadius: '6px',
                    textDecoration: 'none', color: 'inherit', cursor: 'pointer'
                  }}
                >
                  <img src={video.thumbnailUrl} alt={video.title}
                    style={{ width: '56px', height: '42px', objectFit: 'cover', borderRadius: '3px', flexShrink: 0 }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '12px', fontWeight: '500', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: colors.textPrimary }}>
                      {video.title}
                    </p>
                    <p style={{ fontSize: '10px', color: colors.textSecondary, margin: 0 }}>
                      {video.channelName} • {video.duration}
                    </p>
                  </div>
                </a>
              ))}
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <Pill label={`${videos.length} video${videos.length > 1 ? 's' : ''}`} color={{ bg: '#F5F3EE', text: colors.textSecondary }} />
              </div>
            </div>
          )}
        </div>

        {/* Col 3: Hands-On */}
        <div style={{ padding: '14px' }}>
          <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Hands-On</p>

          <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <p style={{ margin: 0, fontSize: '11px', color: colors.textSecondary }}>Worksheets</p>
              <button onClick={() => actions.generateResource(topicBox.id, 'worksheet')} style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: colors.worksheetBtn,
                color: '#2C2A26',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0
              }}>✨</button>
            </div>
            {worksheets.length === 0 ? (
              <p style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', margin: '4px 0' }}>None yet</p>
            ) : worksheets.map((ws, i) => (
              <div key={i} style={{ padding: '5px 8px', marginBottom: '4px', backgroundColor: '#F5F3EE', border: '1px solid #E8E6E1', borderRadius: '4px' }}>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: '500', color: colors.textPrimary }}>{ws.title}</p>
                {ws.sourceUrl && <a href={ws.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: colors.accent }}>View Source</a>}
              </div>
            ))}
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <p style={{ margin: 0, fontSize: '11px', color: colors.textSecondary }}>Activities</p>
              <button onClick={() => actions.generateResource(topicBox.id, 'activity')} style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: colors.activityBtn,
                color: '#2C2A26',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0
              }}>✨</button>
            </div>
            {activities.length === 0 ? (
              <p style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', margin: '4px 0' }}>None yet</p>
            ) : activities.map((act, i) => (
              <div key={i} style={{ padding: '5px 8px', marginBottom: '4px', backgroundColor: '#F5F3EE', border: '1px solid #E8E6E1', borderRadius: '4px' }}>
                <p style={{ margin: '0 0 2px', fontSize: '12px', fontWeight: '500', color: colors.textPrimary }}>{act.title}</p>
                <p style={{ margin: 0, fontSize: '11px', color: colors.textSecondary }}>{act.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ── Section Block Component ───────────────────────────────────────────
  const SectionBlock = ({ section, index, dragHandleProps }) => {
    if (section.type === 'break') {
      return (
        <div style={{
          padding: '12px 16px', marginBottom: '16px',
          backgroundColor: '#FFF9E6', border: '1px solid #E8E6E1',
          borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div {...dragHandleProps} style={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}>
              <GripVertical size={18} style={{ color: '#9ca3af' }} />
            </div>
            <span style={{ fontWeight: '500', fontSize: '14px' }}>⏸️ Break — {section.duration}</span>
          </div>
          <button
            onClick={() => actions.confirmDeleteSection(section.id)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              color: colors.dangerBtn
            }}
            title="Delete break"
          >
            <Trash2 size={16} />
          </button>
        </div>
      );
    }

    const isCollapsed = actions.collapsedSections[section.id];

    return (
      <div style={{
        border: `1px solid ${colors.sectionBorder}`,
        borderRadius: '12px',
        marginBottom: '20px',
        backgroundColor: colors.card,
        overflow: 'hidden'
      }}>
        {/* Section header */}
        <div style={{
          backgroundColor: colors.sectionBg,
          padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <div {...dragHandleProps} style={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}>
            <GripVertical size={18} style={{ color: colors.accent }} />
          </div>

          <button onClick={() => actions.toggleSection(section.id)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '14px', color: colors.accent, padding: 0
          }}>
            {isCollapsed ? '▶' : '▼'}
          </button>

          <span style={{ fontSize: '12px', fontWeight: '700', color: colors.accent }}>
            Section {index + 1}
          </span>

          <EditableField
            value={section.title}
            onChange={val => actions.updateSectionTitle(section.id, val)}
            fieldKey={`section-title-${section.id}`}
            placeholder="Section title"
            inputStyle={{
              fontSize: '15px',
              fontWeight: '600',
              color: colors.textPrimary
            }}
          />

          <button
            onClick={() => actions.confirmDeleteSection(section.id)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: colors.dangerBtn,
              fontSize: '13px',
              fontWeight: '600'
            }}
            title="Delete section"
          >
            <Trash2 size={16} />
          </button>
        </div>

        {!isCollapsed && (
          <div style={{ padding: '14px 16px' }}>
            <DescriptorBox
              value={section.description}
              onChange={val => actions.updateSectionDescription(section.id, val)}
              placeholder="Section description…"
              fieldKey={`section-desc-${section.id}`}
            />

            {/* Subsections */}
            <Droppable droppableId={`subsections-${section.id}`} type="SUBSECTION">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  {(section.subsections || []).map((sub, subIdx) => (
                    <Draggable
                      key={sub.id}
                      draggableId={sub.id}
                      index={subIdx}
                    >
                      {(provided, snapshot) => {
                        const isSubCollapsed = actions.collapsedSubsections[sub.id];
    
                        return (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            style={{
                              ...provided.draggableProps.style,
                              marginBottom: '16px',
                              opacity: snapshot.isDragging ? 0.8 : 1,
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              backgroundColor: '#fafafa',
                              overflow: 'hidden'
                            }}
                          >
                            {/* Subsection header */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 12px',
                              backgroundColor: '#f9fafb',
                              borderBottom: isSubCollapsed ? 'none' : '1px solid #e5e7eb'
                            }}>
                              <div {...provided.dragHandleProps} style={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}>
                                <GripVertical size={16} style={{ color: '#9ca3af' }} />
                              </div>

                              <button onClick={() => actions.toggleSubsection(sub.id)} style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                fontSize: '12px', color: colors.accent, padding: 0
                              }}>
                                {isSubCollapsed ? '▶' : '▼'}
                              </button>

                              <span style={{ fontSize: '11px', fontWeight: '700', color: colors.accent }}>
                                Subsection {index + 1}.{subIdx + 1}
                              </span>

                              <EditableField
                                value={sub.title}
                                onChange={val => actions.updateSubsectionTitle(section.id, sub.id, val)}
                                fieldKey={`subsection-title-${sub.id}`}
                                placeholder="Subsection title"
                                inputStyle={{
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  color: colors.textPrimary
                                }}
                              />

                              <button
                                onClick={() => actions.confirmDeleteSubsection(section.id, sub.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  color: colors.dangerBtn,
                                  marginLeft: 'auto'
                                }}
                                title="Delete subsection"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>

                            {/* Subsection content */}
                            {!isSubCollapsed && (
                              <div style={{ padding: '12px' }}>
                                <DescriptorBox
                                  value={sub.description}
                                  onChange={val => actions.updateSubsectionDescription(section.id, sub.id, val)}
                                  placeholder="Subsection description…"
                                  fieldKey={`subsection-desc-${sub.id}`}
                                />

                                {/* Topic Boxes Droppable */}
                                <Droppable droppableId={`topicboxes-${sub.id}`} type="TOPICBOX">
                                  {(provided) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.droppableProps}
                                      style={{ minHeight: '20px' }}
                                    >
                                      {(sub.topicBoxes || []).length === 0 ? (
                                        <div style={{
                                          textAlign: 'center',
                                          padding: '20px',
                                          border: '1px solid #e5e7eb',
                                          borderRadius: '8px',
                                          backgroundColor: '#fafafa',
                                          color: colors.textSecondary,
                                          fontSize: '13px',
                                          marginBottom: '12px'
                                        }}>
                                          No topic boxes yet. Click "+ Add Topic Box" or use AI to generate.
                                        </div>
                                      ) : (
                                        (sub.topicBoxes || []).map((topic, topicIdx) => (
                                          <Draggable
                                            key={topic.id}
                                            draggableId={topic.id}
                                            index={topicIdx}
                                          >
                                            {(provided, snapshot) => (
                                              <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                style={{
                                                  ...provided.draggableProps.style,
                                                  opacity: snapshot.isDragging ? 0.9 : 1
                                                }}
                                              >
                                                <TopicBoxRow
                                                  topicBox={topic}
                                                  sectionId={section.id}
                                                  subsectionId={sub.id}
                                                  dragHandleProps={provided.dragHandleProps}
                                                />
                                              </div>
                                            )}
                                          </Draggable>
                                        ))
                                      )}
                                      {provided.placeholder}
                                    </div>
                                  )}
                                </Droppable>

                                {/* Add Topic Box Buttons */}
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button onClick={() => actions.addTopicBox(section.id, sub.id)} style={{
                                    flex: 1, padding: '8px',
                                    backgroundColor: 'transparent', color: colors.accent,
                                    border: `1px solid ${colors.sectionBorder}`, borderRadius: '6px',
                                    cursor: 'pointer', fontSize: '13px', fontWeight: '600'
                                  }}>
                                    ⊕ Add Topic Box
                                  </button>
                                  
                                  <div style={{ flex: 1 }}>
                                    <AIGenerateButton
                                      level="topics"
                                      context={{
                                        course: {
                                          title: courseName,
                                          grade: formData?.class || ''
                                        },
                                        current_section: {
                                          title: section.title,
                                          description: section.description
                                        },
                                        subsection: {
                                          title: sub.title,
                                          description: sub.description,
                                          existingTopics: (sub.topicBoxes || []).map(t => ({
                                            title: t.title,
                                            description: t.description
                                          }))
                                        }
                                      }}
                                      onGenerate={(params) => actions.handleGenerateTopicBoxes(section.id, sub.id, params)}
                                      count={1}
                                      buttonText="✨ Generate Topic Box"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>

            {/* Add Subsection Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button onClick={() => actions.addSubsection(section.id)} style={{
                flex: 1, padding: '8px',
                backgroundColor: 'transparent', color: colors.accent,
                border: `1px solid ${colors.sectionBorder}`, borderRadius: '6px',
                cursor: 'pointer', fontSize: '13px', fontWeight: '600'
              }}>
                ⊕ Add Subsection
              </button>
              
              <div style={{ flex: 1 }}>
                <AIGenerateButton
                  level="subsections"
                  context={{
                    course: {
                      title: courseName,
                      description: formData?.objectives || '',
                      grade: formData?.class || ''
                    },
                    all_section_names: sections
                      .filter(s => s.type !== 'break')
                      .map(s => s.title),
                    current_section: {
                      title: section.title,
                      description: section.description,
                      existingSubsections: (section.subsections || []).map(sub => ({
                        title: sub.title,
                        description: sub.description
                      }))
                    }
                  }}
                  onGenerate={(params) => actions.handleGenerateSubsections(section.id, params)}
                  count={1}
                  buttonText="✨ Generate Subsection"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── RENDER ────────────────────────────────────────────────────────────
  return (
    <>
      {/* Top Bar */}
      <div style={{
        padding: '12px 28px', borderBottom: '1px solid #e5e7eb',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: colors.textPrimary }}>🎓 EdCube</h2>
          <input
            type="text" value={courseName}
            onChange={e => setCourseName(e.target.value)}
            style={{
              fontSize: '17px', padding: '6px 12px',
              border: '1px solid #ddd', borderRadius: '6px', minWidth: '280px',
              outline: 'none'
            }}
            onFocus={e => e.target.style.borderColor = colors.accent}
            onBlur={e => e.target.style.borderColor = '#ddd'}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button onClick={onUndo} disabled={!canUndo} style={{
            padding: '7px 14px', backgroundColor: !canUndo ? '#e5e7eb' : '#6b7280',
            color: !canUndo ? '#9ca3af' : 'white', border: 'none',
            borderRadius: '6px', cursor: !canUndo ? 'not-allowed' : 'pointer', fontSize: '13px'
          }}>↶ Undo</button>

          <button onClick={onSave} style={{
            padding: '8px 18px', backgroundColor: '#16a34a', color: 'white',
            border: 'none', borderRadius: '6px', cursor: 'pointer',
            fontWeight: '600', fontSize: '14px'
          }}>💾 Save Course</button>

          <span style={{ color: '#6b7280', fontSize: '13px' }}>{currentUser?.displayName}</span>

          <button onClick={() => navigate('/my-courses')} style={{
            padding: '7px 14px', backgroundColor: '#6b7280', color: 'white',
            border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px'
          }}>← My Courses</button>
        </div>
      </div>

      {/* Action bar */}
      <div style={{
        padding: '10px 28px', backgroundColor: 'white',
        borderBottom: '1px solid #f3f4f6',
        display: 'flex', gap: '10px', alignItems: 'center'
      }}>
        <button onClick={actions.addSection} style={{
          padding: '7px 16px', backgroundColor: colors.accent, color: 'white',
          border: 'none', borderRadius: '6px', cursor: 'pointer',
          fontWeight: '600', fontSize: '13px'
        }}>➕ Section</button>

        <button onClick={onAddBreak} style={{
          padding: '7px 16px', backgroundColor: 'white', color: colors.accent,
          border: `1px solid ${colors.sectionBorder}`, borderRadius: '6px',
          cursor: 'pointer', fontWeight: '600', fontSize: '13px'
        }}>⏸️ Break</button>

        <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '12px' }}>
          {sections.filter(s => s.type !== 'break').length} section{sections.filter(s => s.type !== 'break').length !== 1 ? 's' : ''} •{' '}
          {sections.reduce((acc, s) => acc + (s.subsections?.length || 0), 0)} subsections •{' '}
          {sections.reduce((acc, s) => acc + (s.subsections?.reduce((total, sub) => total + (sub.topicBoxes?.length || 0), 0) || 0), 0)} topic boxes
        </span>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {sections.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '80px 20px',
            border: `1px solid ${colors.sectionBorder}`, borderRadius: '16px',
            backgroundColor: 'white'
          }}>
            <p style={{ fontSize: '24px', marginBottom: '8px' }}>📚</p>
            <p style={{ fontSize: '16px', color: colors.textPrimary, fontWeight: '600', margin: '0 0 4px' }}>No sections yet</p>
            <p style={{ fontSize: '14px', color: colors.textSecondary, margin: 0 }}>Click "+ Section" above to start building your course</p>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="all-sections" type="SECTION">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  {sections.map((section, idx) => (
                    <Draggable
                      key={section.id}
                      draggableId={section.id}
                      index={idx}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          style={{
                            ...provided.draggableProps.style,
                            opacity: snapshot.isDragging ? 0.8 : 1
                          }}
                        >
                          <SectionBlock 
                            section={section} 
                            index={idx}
                            dragHandleProps={provided.dragHandleProps}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}

        {/* Generate More Sections */}
        {sections.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <AIGenerateButton
              level="sections"
              context={{
                course: {
                  title: courseName,
                  description: formData?.objectives || '',
                  grade: formData?.class || '',
                  subject: formData?.subject || '',
                  duration: formData?.timeDuration ? `${formData.timeDuration} ${formData.timeUnit}` : ''
                },
                existing_sections: sections.filter(s => s.type !== 'break').map(s => ({
                  title: s.title,
                  description: s.description
                }))
              }}
              onGenerate={actions.handleGenerateSections}
              count={1}
              buttonText="✨ Generate More Sections with AI"
            />
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={actions.deleteConfirm !== null}
        onConfirm={actions.handleConfirmDelete}
        onCancel={() => actions.setDeleteConfirm(null)}
        title={actions.deleteConfirm?.title || ''}
        message={actions.deleteConfirm?.message || ''}
      />
    </>
  );
};

export default CourseEditor;