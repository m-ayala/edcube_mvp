// src/components/courses/CourseEditor.jsx
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Edit2, Check, Trash2, Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import TopicDetailsModal from '../modals/TopicDetailsModal';

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
  navigate
}) => {
  const [selectedTopicForDetail, setSelectedTopicForDetail] = useState(null);
  const [hoveredTopic, setHoveredTopic] = useState(null);
  const [hoveredSubsection, setHoveredSubsection] = useState(null);
  const [hoveredSection, setHoveredSection] = useState(null);
  const [activeBubble, setActiveBubble] = useState(null);
  const [aiPromptText, setAiPromptText] = useState('');

  const openBubble = (e, id, onGenerate) => {
    e.stopPropagation();
    if (activeBubble?.id === id) {
      onGenerate(null);
      setActiveBubble(null);
      setAiPromptText('');
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setActiveBubble({ id, rect, onGenerate });
      setAiPromptText('');
    }
  };

  const closeBubble = () => {
    setActiveBubble(null);
    setAiPromptText('');
  };

  // ── Colors ────────────────────────────────────────────────────────────
  const colors = {
    bg: '#FAF9F6',
    card: '#FFFFFF',
    sectionBorder: '#E8E6E1',
    sectionBg: '#E8E0D5',
    subsectionBg: '#F0EBE3',
    topicBg: '#F7F9FC',  // Light blue-gray for topic boxes
    accent: '#D4C4A8',
    accentLight: '#F5F3EE',
    textPrimary: '#2C2A26',
    textSecondary: '#6B6760',
    pillBg: '#F5F3EE',
    pillText: '#6B6760',
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

    if (type === 'SECTION') {
      const reorderedSections = Array.from(sections);
      const [movedSection] = reorderedSections.splice(source.index, 1);
      reorderedSections.splice(destination.index, 0, movedSection);
      setSections(reorderedSections);
      return;
    }

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

    if (type === 'TOPICBOX') {
      const sourceSubId = source.droppableId.replace('topicboxes-', '');
      const destSubId = destination.droppableId.replace('topicboxes-', '');

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
        const updatedSections = sections.map(section => {
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

  // ── Topic Detail Modal Handler ────────────────────────────────────────
  const handleTopicBoxClick = (topicBox, sectionId, subsectionId) => {
    setSelectedTopicForDetail({ topicBox, sectionId, subsectionId });
  };

  const handleSaveTopicDetail = (updateData) => {
    actions.updateTopicBoxFull(updateData);
    setSelectedTopicForDetail(null);
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
          onBlur={handleSave}
          disabled={!isEditing}
          placeholder={placeholder}
          style={{
            flex: 1,
            border: isEditing ? '2px solid #000' : 'none',
            background: isEditing ? '#fff' : 'transparent',
            outline: 'none',
            cursor: isEditing ? 'text' : 'pointer',
            padding: isEditing ? '6px 10px' : '0',
            borderRadius: isEditing ? '4px' : '0',
            transition: 'all 0.15s ease',
            ...inputStyle
          }}
          onClick={!isEditing ? handleEdit : undefined}
        />
        <button
          onClick={isEditing ? handleSave : handleEdit}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            color: isEditing ? colors.accent : '#9ca3af',
            flexShrink: 0
          }}
          title={isEditing ? 'Save' : 'Edit'}
        >
          {isEditing ? <Check size={14} /> : <Edit2 size={12} />}
        </button>
      </div>
    );
  };

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

  // ── Topic Box Row Component (OPTION A - Single Summary) ──────────────
  const TopicBoxRow = ({ topicBox, sectionId, subsectionId, dragHandleProps }) => {
    const videos = videosByTopic[topicBox.id] || [];
    const allResources = handsOnResources[topicBox.id] || [];
    const worksheets = allResources.filter(r => r.type === 'worksheet');
    const activities = allResources.filter(r => r.type === 'activity');

    const totalResources = videos.length + worksheets.length + activities.length;

    const resourceSummary = [
      videos.length > 0 && `${videos.length} video${videos.length > 1 ? 's' : ''}`,
      worksheets.length > 0 && `${worksheets.length} worksheet${worksheets.length > 1 ? 's' : ''}`,
      activities.length > 0 && `${activities.length} activit${activities.length > 1 ? 'ies' : 'y'}`
    ].filter(Boolean).join(' • ');

    return (
      <div style={{ marginBottom: '12px' }}>
        <div
          onMouseEnter={() => setHoveredTopic(topicBox.id)}
          onMouseLeave={() => setHoveredTopic(null)}
          onClick={() => handleTopicBoxClick(topicBox, sectionId, subsectionId)}
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: '10px',
            backgroundColor: colors.topicBg,
            boxShadow: hoveredTopic === topicBox.id ? '0 4px 12px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.06)',
            position: 'relative',
            padding: '16px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          {/* Drag handle */}
          <div
            {...dragHandleProps}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
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

          {/* Delete button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              actions.confirmDeleteTopicBox(sectionId, subsectionId, topicBox.id);
            }}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              color: colors.dangerBtn,
              zIndex: 10
            }}
            title="Delete topic box"
          >
            <Trash2 size={16} />
          </button>

          {/* Action buttons - permanent in bottom-right corner */}
          <div style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            display: 'flex',
            gap: '4px',
            zIndex: 10
          }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                actions.addTopicBox(sectionId, subsectionId);
              }}
              style={{
                padding: '3px 8px',
                backgroundColor: '#fff',
                color: '#6B6760',
                border: `1px solid ${colors.sectionBorder}`,
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '10px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
              title="Add new topic"
            >
              <Plus size={10} /> Topic
            </button>

            <button
              onClick={(e) => {
                const section = sections.find(s => s.id === sectionId);
                const subsection = section?.subsections?.find(sub => sub.id === subsectionId);
                openBubble(e, `topic-${topicBox.id}`, (guidance) => {
                  actions.handleGenerateTopicBoxes(sectionId, subsectionId, {
                    level: 'topics',
                    context: {
                      course: {
                        title: courseName,
                        grade: formData?.class || '',
                        description: formData?.objectives || ''
                      },
                      current_section: {
                        title: section?.title || 'Unknown',
                        description: section?.description || ''
                      },
                      subsection: {
                        title: subsection?.title || 'Unknown',
                        description: subsection?.description || '',
                        existingTopics: (subsection?.topicBoxes || []).map(t => ({
                          title: t.title,
                          description: t.description
                        }))
                      },
                      other_sections: sections.filter(s => s.type !== 'break' && s.id !== sectionId).map(s => ({
                        title: s.title,
                        description: s.description,
                        subsections: (s.subsections || []).map(sub => sub.title)
                      })),
                      sibling_subsections: (section?.subsections || []).filter(sub => sub.id !== subsectionId).map(sub => ({
                        title: sub.title,
                        description: sub.description
                      }))
                    },
                    userGuidance: guidance,
                    count: 1
                  });
                });
              }}
              style={{
                padding: '3px 8px',
                backgroundColor: colors.accent,
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '10px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}
              title="AI generate topic"
            >
              <Sparkles size={10} /> AI
            </button>
          </div>

          {/* Content */}
          <div style={{ paddingLeft: '28px', paddingRight: '28px' }}>
            {/* Title */}
            <h4 style={{ 
              margin: '0 0 10px', 
              fontSize: '15px', 
              fontWeight: '600', 
              color: colors.textPrimary 
            }}>
              {topicBox.title}
            </h4>

            {/* Learning Objectives */}
            {(topicBox.learning_objectives || []).length > 0 && (
              <ul style={{ 
                margin: '0 0 12px', 
                paddingLeft: '20px', 
                fontSize: '13px', 
                color: colors.textSecondary,
                lineHeight: '1.6'
              }}>
                {topicBox.learning_objectives.slice(0, 3).map((obj, i) => (
                  <li key={i} style={{ marginBottom: '4px' }}>{obj}</li>
                ))}
                {topicBox.learning_objectives.length > 3 && (
                  <li style={{ color: '#9ca3af', fontStyle: 'italic' }}>
                    +{topicBox.learning_objectives.length - 3} more...
                  </li>
                )}
              </ul>
            )}

            {/* Pills Row */}
            <div style={{ 
              display: 'flex', 
              gap: '6px', 
              flexWrap: 'wrap', 
              marginBottom: totalResources > 0 ? '12px' : '0'
            }}>
              <Pill 
                label={`${topicBox.duration_minutes || 0} min`} 
                color={{ bg: '#F5F3EE', text: colors.textSecondary }} 
              />
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

            {/* Resource Summary */}
            {totalResources > 0 && (
              <div style={{
                padding: '10px 14px',
                backgroundColor: '#F9FAFB',
                borderRadius: '6px',
                border: '1px solid #E5E7EB',
                fontSize: '12px',
                color: colors.textSecondary
              }}>
                <span style={{ fontWeight: '600', color: colors.textPrimary }}>📦 Resources:</span>{' '}
                {resourceSummary}
                <span style={{ 
                  marginLeft: '8px', 
                  fontStyle: 'italic', 
                  color: '#9ca3af',
                  fontSize: '11px'
                }}>
                  (click to view/edit)
                </span>
              </div>
            )}

            {totalResources === 0 && (
              <div style={{
                padding: '10px 14px',
                backgroundColor: '#FFFBEB',
                borderRadius: '6px',
                border: '1px dashed #FCD34D',
                fontSize: '12px',
                color: '#92400E',
                fontStyle: 'italic'
              }}>
                No resources yet — click to add videos, worksheets, or activities
              </div>
            )}
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
      <div 
        onMouseEnter={() => setHoveredSection(section.id)}
        onMouseLeave={() => setHoveredSection(null)}
        style={{
          border: `1px solid ${colors.sectionBorder}`,
          borderRadius: '12px',
          marginBottom: '20px',
          backgroundColor: colors.card,
          overflow: 'hidden'
        }}
      >
        {/* Section header with attached description */}
        <div>
          {/* Header bar */}
          <div style={{
            backgroundColor: colors.sectionBg,
            padding: '10px 16px',
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px'
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

            {/* Action buttons - permanent in header */}
            <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  actions.addSection();
                }}
                style={{
                  padding: '3px 8px',
                  backgroundColor: '#fff',
                  color: '#6B6760',
                  border: `1px solid ${colors.sectionBorder}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '10px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
                title="Add new section"
              >
                <Plus size={10} /> Sec
              </button>

              <button
                onClick={(e) => {
                  openBubble(e, `section-${section.id}`, (guidance) => {
                    actions.handleGenerateSections({
                      level: 'sections',
                      context: {
                        course: {
                          title: courseName,
                          description: formData?.objectives || '',
                          grade: formData?.class || ''
                        }
                      },
                      userGuidance: guidance,
                      count: 1
                    });
                  });
                }}
                style={{
                  padding: '3px 8px',
                  backgroundColor: colors.accent,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '10px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}
                title="AI generate section"
              >
                <Sparkles size={10} /> AI
              </button>
            </div>

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

          {/* Description attached directly below */}
          {!isCollapsed && (
            <div style={{
              backgroundColor: '#FAFAFA',
              padding: '10px 16px',
              borderBottom: '1px solid #E8E6E1'
            }}>
              <EditableField
                value={section.description}
                onChange={val => actions.updateSectionDescription(section.id, val)}
                fieldKey={`section-desc-${section.id}`}
                placeholder="Add a description…"
                inputStyle={{
                  fontSize: '12px',
                  color: colors.textSecondary,
                  fontStyle: section.description ? 'normal' : 'italic'
                }}
              />
            </div>
          )}
        </div>

        {!isCollapsed && (
          <div style={{ padding: '14px 16px' }}>
            {/* Subsections */}
            <Droppable droppableId={`subsections-${section.id}`} type="SUBSECTION">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  {(section.subsections || []).length === 0 && (
                    <div style={{
                      textAlign: 'center',
                      padding: '24px 20px',
                      border: '1px dashed #e5e7eb',
                      borderRadius: '8px',
                      backgroundColor: '#fafafa',
                      color: colors.textSecondary,
                      fontSize: '13px',
                      marginBottom: '12px'
                    }}>
                      <p style={{ margin: '0 0 12px' }}>No subsections yet</p>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => actions.addSubsection(section.id)}
                          style={{
                            padding: '6px 14px',
                            backgroundColor: '#fff',
                            color: '#6B6760',
                            border: `1px solid ${colors.sectionBorder}`,
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                          }}
                        >
                          <Plus size={14} /> Add Subsection
                        </button>
                        <button
                          onClick={(e) => {
                            openBubble(e, `subsection-empty-${section.id}`, (guidance) => {
                              actions.handleGenerateSubsections(section.id, {
                                level: 'subsections',
                                context: {
                                  course: {
                                    title: courseName,
                                    description: formData?.objectives || '',
                                    grade: formData?.class || ''
                                  },
                                  current_section: {
                                    title: section?.title || 'Unknown',
                                    description: section?.description || '',
                                    existingSubsections: []
                                  },
                                  all_section_names: sections.filter(s => s.type !== 'break').map(s => s.title),
                                  other_sections: sections.filter(s => s.type !== 'break' && s.id !== section.id).map(s => ({
                                    title: s.title,
                                    description: s.description,
                                    subsections: (s.subsections || []).map(sub => sub.title)
                                  }))
                                },
                                userGuidance: guidance,
                                count: 1
                              });
                            });
                          }}
                          style={{
                            padding: '6px 14px',
                            backgroundColor: colors.accent,
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                          }}
                        >
                          <Sparkles size={14} /> AI Generate
                        </button>
                      </div>
                    </div>
                  )}
                  {(section.subsections || []).map((sub, subIdx) => {
                    const isSubCollapsed = actions.collapsedSubsections[sub.id];

                    return (
                      <Draggable
                        key={sub.id}
                        draggableId={sub.id}
                        index={subIdx}
                      >
                        {(provided, snapshot) => (
                          <div style={{ marginBottom: '16px' }}>
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              onMouseEnter={() => setHoveredSubsection(sub.id)}
                              onMouseLeave={() => setHoveredSubsection(null)}
                              style={{
                                ...provided.draggableProps.style,
                                opacity: snapshot.isDragging ? 0.8 : 1,
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                backgroundColor: '#fafafa',
                                overflow: 'hidden'
                              }}
                            >
                              {/* Subsection header */}
                              <div style={{ position: 'relative' }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px 12px',
                                  backgroundColor: colors.subsectionBg
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

                                  {/* Action buttons - permanent in header */}
                                  <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        actions.addSubsection(section.id);
                                      }}
                                      style={{
                                        padding: '3px 8px',
                                        backgroundColor: '#fff',
                                        color: '#6B6760',
                                        border: `1px solid ${colors.sectionBorder}`,
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '10px',
                                        fontWeight: '600',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                      }}
                                      title="Add new subsection"
                                    >
                                      <Plus size={10} /> Sub
                                    </button>

                                    <button
                                      onClick={(e) => {
                                        openBubble(e, `subsection-${section.id}-${sub.id}`, (guidance) => {
                                          actions.handleGenerateSubsections(section.id, {
                                            level: 'subsections',
                                            context: {
                                              course: {
                                                title: courseName,
                                                description: formData?.objectives || '',
                                                grade: formData?.class || ''
                                              },
                                              current_section: {
                                                title: section?.title || 'Unknown',
                                                description: section?.description || '',
                                                existingSubsections: (section?.subsections || []).map(sub => ({
                                                  title: sub.title,
                                                  description: sub.description
                                                }))
                                              },
                                              all_section_names: sections.filter(s => s.type !== 'break').map(s => s.title),
                                              other_sections: sections.filter(s => s.type !== 'break' && s.id !== section.id).map(s => ({
                                                title: s.title,
                                                description: s.description,
                                                subsections: (s.subsections || []).map(sub => sub.title)
                                              }))
                                            },
                                            userGuidance: guidance,
                                            count: 1
                                          });
                                        });
                                      }}
                                      style={{
                                        padding: '3px 8px',
                                        backgroundColor: colors.accent,
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '10px',
                                        fontWeight: '600',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                      }}
                                      title="AI generate subsection"
                                    >
                                      <Sparkles size={10} /> AI
                                    </button>
                                  </div>

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

                                {/* Description attached */}
                                {!isSubCollapsed && (
                                  <div style={{
                                    backgroundColor: '#FAFAFA',
                                    padding: '8px 12px',
                                    borderBottom: '1px solid #e5e7eb'
                                  }}>
                                    <EditableField
                                      value={sub.description}
                                      onChange={val => actions.updateSubsectionDescription(section.id, sub.id, val)}
                                      fieldKey={`subsection-desc-${sub.id}`}
                                      placeholder="Add a description…"
                                      inputStyle={{
                                        fontSize: '12px',
                                        color: colors.textSecondary,
                                        fontStyle: sub.description ? 'normal' : 'italic'
                                      }}
                                    />
                                  </div>
                                )}
                              </div>

                              {/* Subsection content */}
                              {!isSubCollapsed && (
                                <div style={{ padding: '12px' }}>
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
                                            padding: '24px 20px',
                                            border: '1px dashed #e5e7eb',
                                            borderRadius: '8px',
                                            backgroundColor: '#fafafa',
                                            color: colors.textSecondary,
                                            fontSize: '13px',
                                            marginBottom: '12px'
                                          }}>
                                            <p style={{ margin: '0 0 12px' }}>No topic boxes yet</p>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                              <button
                                                onClick={() => actions.addTopicBox(section.id, sub.id)}
                                                style={{
                                                  padding: '6px 14px',
                                                  backgroundColor: '#fff',
                                                  color: '#6B6760',
                                                  border: `1px solid ${colors.sectionBorder}`,
                                                  borderRadius: '6px',
                                                  cursor: 'pointer',
                                                  fontSize: '12px',
                                                  fontWeight: '600',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: '5px',
                                                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                                }}
                                              >
                                                <Plus size={14} /> Add Topic
                                              </button>
                                              <button
                                                onClick={(e) => {
                                                  const currentSection = sections.find(s => s.id === section.id);
                                                  const currentSub = currentSection?.subsections?.find(s => s.id === sub.id);
                                                  openBubble(e, `topic-empty-${section.id}-${sub.id}`, (guidance) => {
                                                    actions.handleGenerateTopicBoxes(section.id, sub.id, {
                                                      level: 'topics',
                                                      context: {
                                                        course: {
                                                          title: courseName,
                                                          grade: formData?.class || '',
                                                          description: formData?.objectives || ''
                                                        },
                                                        current_section: {
                                                          title: currentSection?.title || 'Unknown',
                                                          description: currentSection?.description || ''
                                                        },
                                                        subsection: {
                                                          title: currentSub?.title || 'Unknown',
                                                          description: currentSub?.description || '',
                                                          existingTopics: []
                                                        },
                                                        other_sections: sections.filter(s => s.type !== 'break' && s.id !== section.id).map(s => ({
                                                          title: s.title,
                                                          description: s.description,
                                                          subsections: (s.subsections || []).map(sub => sub.title)
                                                        })),
                                                        sibling_subsections: (currentSection?.subsections || []).filter(s => s.id !== sub.id).map(s => ({
                                                          title: s.title,
                                                          description: s.description
                                                        }))
                                                      },
                                                      userGuidance: guidance,
                                                      count: 1
                                                    });
                                                  });
                                                }}
                                                style={{
                                                  padding: '6px 14px',
                                                  backgroundColor: colors.accent,
                                                  color: '#fff',
                                                  border: 'none',
                                                  borderRadius: '6px',
                                                  cursor: 'pointer',
                                                  fontSize: '12px',
                                                  fontWeight: '600',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: '5px',
                                                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                                }}
                                              >
                                                <Sparkles size={14} /> AI Generate
                                              </button>
                                            </div>
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
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
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
        display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center'
      }}>
        <button onClick={actions.addSection} style={{
          padding: '6px 14px',
          backgroundColor: 'transparent',
          color: colors.accent,
          border: `1px solid ${colors.sectionBorder}`,
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '5px'
        }}>
          <Plus size={14} /> Section
        </button>

        <button onClick={onAddBreak} style={{
          padding: '6px 14px',
          backgroundColor: 'transparent',
          color: colors.accent,
          border: `1px solid ${colors.sectionBorder}`,
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: '600'
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
      </div>

      {/* Modals */}
      <ConfirmDialog
        isOpen={actions.deleteConfirm !== null}
        onConfirm={actions.handleConfirmDelete}
        onCancel={() => actions.setDeleteConfirm(null)}
        title={actions.deleteConfirm?.title || ''}
        message={actions.deleteConfirm?.message || ''}
      />

      {/* AI Prompt Bubble */}
      {activeBubble && (
        <>
          <div
            onClick={(e) => { e.stopPropagation(); closeBubble(); }}
            style={{ position: 'fixed', inset: 0, zIndex: 999 }}
          />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: Math.max(10, activeBubble.rect.right - 220),
              top: activeBubble.rect.top - 8,
              transform: 'translateY(-100%)',
              backgroundColor: 'white',
              borderRadius: '10px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              border: '1px solid #e5e7eb',
              padding: '12px',
              width: '220px',
              zIndex: 1000,
            }}
          >
            <div style={{
              position: 'absolute',
              bottom: '-6px',
              right: '14px',
              width: '12px',
              height: '12px',
              backgroundColor: 'white',
              transform: 'rotate(45deg)',
              borderRight: '1px solid #e5e7eb',
              borderBottom: '1px solid #e5e7eb',
            }} />
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#6B6760', marginBottom: '6px' }}>
              Prompt (optional):
            </div>
            <input
              type="text"
              value={aiPromptText}
              onChange={(e) => setAiPromptText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  activeBubble.onGenerate(aiPromptText.trim() || null);
                  closeBubble();
                }
                if (e.key === 'Escape') closeBubble();
              }}
              onClick={(e) => e.stopPropagation()}
              placeholder="e.g., Focus on hands-on..."
              autoFocus
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '11px',
                outline: 'none',
                marginBottom: '8px',
                boxSizing: 'border-box',
              }}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                activeBubble.onGenerate(aiPromptText.trim() || null);
                closeBubble();
              }}
              style={{
                width: '100%',
                padding: '5px 10px',
                backgroundColor: colors.accent,
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <Sparkles size={12} /> Generate
            </button>
          </div>
        </>
      )}

      {selectedTopicForDetail && (
        <TopicDetailsModal
          topic={selectedTopicForDetail.topicBox}
          sectionId={selectedTopicForDetail.sectionId}
          subsectionId={selectedTopicForDetail.subsectionId}
          onClose={() => setSelectedTopicForDetail(null)}
          onSave={handleSaveTopicDetail}
          actions={actions}
          videosByTopic={videosByTopic}
          handsOnResources={handsOnResources}
        />
      )}
    </>
  );
};

export default CourseEditor;