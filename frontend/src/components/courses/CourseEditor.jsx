// src/components/courses/CourseEditor.jsx
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Edit2, Check, Trash2, Plus, Sparkles, PlayCircle, FileText, Zap } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import TopicDetailsModal from '../modals/TopicDetailsModal';

// Extracted outside CourseEditor so React keeps stable identity across renders
const EditableField = ({
  value,
  onChange,
  placeholder = 'Click to edit',
  style = {},
  inputStyle = {},
  accentColor = '#8B7355',
  maxLength = null
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [isWrapperHovered, setIsWrapperHovered] = useState(false);
  const inputRef = useRef(null);

  // Refs to track current values for unmount cleanup
  const localValueRef = useRef(localValue);
  const isEditingRef = useRef(isEditing);
  const onChangeRef = useRef(onChange);

  useEffect(() => { localValueRef.current = localValue; }, [localValue]);
  useEffect(() => { isEditingRef.current = isEditing; }, [isEditing]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // Save on unmount if still editing (prevents data loss from component re-renders)
  useEffect(() => {
    return () => {
      if (isEditingRef.current) {
        onChangeRef.current(localValueRef.current);
      }
    };
  }, []);

  // Sync from parent when not editing
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(value);
    }
  }, [value, isEditing]);

  // Auto-focus when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleEdit = () => {
    setLocalValue(value);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (isEditing) {
      onChange(localValue);
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setLocalValue(value);
      setIsEditing(false);
    }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    if (maxLength && val.length > maxLength) return;
    setLocalValue(val);
  };

  const displayValue = isEditing ? localValue : (value || '');
  const hasFlex = style.flex !== undefined;
  const charWidth = Math.max((displayValue || placeholder).length, 6) + 3;

  return (
    <div
      onMouseEnter={() => setIsWrapperHovered(true)}
      onMouseLeave={() => setIsWrapperHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        position: 'relative',
        ...style
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        disabled={!isEditing}
        placeholder={placeholder}
        style={{
          width: hasFlex ? undefined : `${charWidth}ch`,
          flex: hasFlex ? 1 : undefined,
          minWidth: '60px',
          maxWidth: '100%',
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
        onMouseDown={e => e.preventDefault()}
        onClick={isEditing ? handleSave : handleEdit}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px',
          display: 'flex',
          alignItems: 'center',
          color: isEditing ? accentColor : '#9ca3af',
          flexShrink: 0,
          opacity: isEditing ? 1 : isWrapperHovered ? 1 : 0,
          transition: 'opacity 0.15s',
          pointerEvents: isEditing ? 'auto' : isWrapperHovered ? 'auto' : 'none'
        }}
        title={isEditing ? 'Save' : 'Edit'}
      >
        {isEditing ? <Check size={14} /> : <Edit2 size={12} />}
      </button>
      {isEditing && maxLength && (
        <span style={{
          fontSize: '10px',
          color: localValue.length >= maxLength ? '#ef4444' : '#9ca3af',
          flexShrink: 0
        }}>
          {localValue.length}/{maxLength}
        </span>
      )}
    </div>
  );
};

// Attribution chain display for forked courses
const LineageAttribution = ({ lineage }) => {
  if (!lineage || lineage.length === 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
      {lineage.map((entry, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{
            fontSize: '11px',
            color: entry.action === 'created' ? '#8b7355' : '#6b7280',
            backgroundColor: entry.action === 'created' ? '#f5f0e8' : '#f3f4f6',
            padding: '2px 8px',
            borderRadius: '10px',
            fontWeight: entry.action === 'created' ? '600' : '400',
          }}>
            {entry.display_name}
          </span>
          {i < lineage.length - 1 && (
            <span style={{ fontSize: '10px', color: '#9ca3af' }}>→</span>
          )}
        </span>
      ))}
    </div>
  );
};

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
  saveStatus,
  onUndo,
  canUndo,
  onAddBreak,
  navigate,
  isPublic,
  onToggleVisibility,
  forkLineage
}) => {
  const [selectedTopicForDetail, setSelectedTopicForDetail] = useState(null);
  const [hoveredTopic, setHoveredTopic] = useState(null);
  const [activeBubble, setActiveBubble] = useState(null);
  const [aiPromptText, setAiPromptText] = useState('');
  const [activeTabByTopic, setActiveTabByTopic] = useState({});

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
    bg: '#F7F5F0',
    card: '#FFFFFF',
    sectionBorder: '#E7E5E4',
    sectionBg: '#FFFFFF',
    sectionStripe: '#52A67A',      // Green left stripe (medium)
    subsectionBg: '#FFFFFF',       // White (no fill — border only)
    subsectionBorder: '#E7E5E4',   // Neutral border
    subsectionStripe: '#5B8FBD',   // Blue left stripe (medium, same weight as green/pink)
    topicBg: '#FFFFFF',
    topicBorder: '#E7E5E4',
    topicStripe: '#C2547A',        // Pink left stripe (medium)
    accent: '#D4C4A8',
    accentLight: '#F5F3EE',
    textPrimary: '#1C1917',
    textSecondary: '#78716C',
    pillBg: '#F5F5F4',
    pillText: '#78716C',
    dangerBtn: '#E57373',
    aiBtn: '#7C3AED',
    pla: {
      'Personal Growth': '#FEF3C7',
      'Core Learning': '#E0F2FE',
      'Critical Thinking': '#FDF4FF',
      'Application & Impact': '#F0FDF4'
    },
    plaText: {
      'Personal Growth': '#92400E',
      'Core Learning': '#0369A1',
      'Critical Thinking': '#7E22CE',
      'Application & Impact': '#166534'
    }
  };

  // Hover tracking for sections/subsections (for reveal-on-hover buttons)
  const [hoveredSection, setHoveredSection] = useState(null);
  const [hoveredSubsection, setHoveredSubsection] = useState(null);

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
      } else if (sourceSection.id === destSection.id) {
        // Different subsections within the SAME section — handle both in one pass
        const updatedSections = sections.map(section => {
          if (section.id !== sourceSection.id) return section;
          return {
            ...section,
            subsections: section.subsections.map(sub => {
              if (sub.id === sourceSubId) {
                return {
                  ...sub,
                  topicBoxes: sub.topicBoxes.filter((_, idx) => idx !== source.index)
                };
              }
              if (sub.id === destSubId) {
                const newTopicBoxes = [...sub.topicBoxes];
                newTopicBoxes.splice(destination.index, 0, sourceTopicBox);
                return { ...sub, topicBoxes: newTopicBoxes };
              }
              return sub;
            })
          };
        });
        setSections(updatedSections);
      } else {
        // Different sections entirely
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

  // ── Topic Box Row (render function, NOT a component — avoids remount on parent re-render) ──
  const renderTopicBoxRow = (topicBox, sectionId, subsectionId, dragHandleProps) => {
    const videos = videosByTopic[topicBox.id] || [];
    const allResources = handsOnResources[topicBox.id] || [];
    const worksheets = allResources.filter(r => r.type === 'worksheet');
    const activities = allResources.filter(r => r.type === 'activity');

    const activeTab = activeTabByTopic[topicBox.id] || 'topic';
    const setActiveTab = (tab) => setActiveTabByTopic(prev => ({ ...prev, [topicBox.id]: tab }));

    const tabs = [
      { id: 'topic', label: 'Topic' },
      { id: 'videos', label: videos.length > 0 ? `Videos (${videos.length})` : 'Videos' },
      { id: 'activities', label: activities.length > 0 ? `Activities (${activities.length})` : 'Activities' },
      { id: 'worksheets', label: worksheets.length > 0 ? `Worksheets (${worksheets.length})` : 'Worksheets' },
    ];

    const getYouTubeThumbnail = (url) => {
      try {
        const urlObj = new URL(url);
        let videoId = null;
        if (urlObj.hostname.includes('youtube.com')) {
          videoId = urlObj.searchParams.get('v');
        } else if (urlObj.hostname.includes('youtu.be')) {
          videoId = urlObj.pathname.slice(1).split('?')[0];
        }
        if (videoId) return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
      } catch {}
      return null;
    };

    const renderResourceCards = (resources, type) => {
      if (resources.length === 0) {
        return (
          <div style={{ padding: '14px 16px', color: '#9ca3af', fontSize: '13px', fontStyle: 'italic' }}>
            No {type} added yet — click Edit to add some.
          </div>
        );
      }
      return (
        <div style={{
          display: 'flex',
          gap: '10px',
          overflowX: 'auto',
          padding: '12px 16px',
          scrollbarWidth: 'thin',
          scrollbarColor: '#E8E6E1 transparent'
        }}>
          {resources.map((resource, idx) => {
            const thumbnail = type === 'video' ? getYouTubeThumbnail(resource.url) : null;
            const placeholderIcon = type === 'video'
              ? <PlayCircle size={22} style={{ color: '#9ca3af' }} />
              : type === 'worksheet'
                ? <FileText size={22} style={{ color: '#9ca3af' }} />
                : <Zap size={22} style={{ color: '#9ca3af' }} />;
            const placeholderBg = type === 'video' ? '#E8E6E1' : type === 'worksheet' ? '#E4EEE4' : '#E8E4EE';

            return (
              <a
                key={idx}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                title={resource.title}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  width: '130px',
                  flexShrink: 0,
                  border: '1px solid #E8E6E1',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  textDecoration: 'none',
                  backgroundColor: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  transition: 'box-shadow 0.2s, transform 0.15s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.14)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt={resource.title}
                    style={{ width: '100%', height: '72px', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{
                    width: '100%',
                    height: '72px',
                    backgroundColor: placeholderBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {placeholderIcon}
                  </div>
                )}
                <div style={{ padding: '6px 8px' }}>
                  <p style={{
                    margin: 0,
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#2C2A26',
                    lineHeight: '1.4',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {resource.title}
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      );
    };

    return (
      <div
        style={{ marginBottom: '10px' }}
        onMouseEnter={() => setHoveredTopic(topicBox.id)}
        onMouseLeave={() => setHoveredTopic(null)}
      >
        <div style={{
          border: `1px solid ${colors.topicBorder}`,
          borderRadius: '10px',
          backgroundColor: colors.topicBg,
          boxShadow: hoveredTopic === topicBox.id ? '0 4px 12px rgba(0,0,0,0.10)' : '0 1px 3px rgba(0,0,0,0.05)',
          overflow: 'hidden',
          transition: 'box-shadow 0.2s',
          display: 'flex'
        }}>

          {/* Pink left stripe */}
          <div style={{ width: '4px', backgroundColor: colors.topicStripe, flexShrink: 0 }} />

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* ── Folder Tab Bar ── */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#FAFAF9',
              borderBottom: `1px solid ${colors.topicBorder}`,
              paddingLeft: '2px',
              paddingRight: '6px',
              gap: '0'
            }}>
              {/* Drag handle */}
              <div
                {...dragHandleProps}
                onClick={e => e.stopPropagation()}
                style={{
                  cursor: 'grab', display: 'flex', alignItems: 'center',
                  padding: '8px 6px 8px 4px', flexShrink: 0,
                  borderRight: `1px solid ${colors.topicBorder}`
                }}
              >
                <GripVertical size={13} style={{ color: '#D6D3D1' }} />
              </div>

              {/* Tabs */}
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={e => { e.stopPropagation(); setActiveTab(tab.id); }}
                  style={{
                    padding: '8px 11px',
                    border: 'none',
                    borderBottom: activeTab === tab.id ? `2px solid ${colors.topicStripe}` : '2px solid transparent',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    fontSize: '11.5px',
                    fontWeight: activeTab === tab.id ? '600' : '400',
                    color: activeTab === tab.id ? colors.topicStripe : colors.textSecondary,
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    fontFamily: "'DM Sans', sans-serif"
                  }}
                >
                  {tab.label}
                </button>
              ))}

              {/* Spacer */}
              <div style={{ flex: 1 }} />

              {/* Edit button */}
              <button
                onClick={e => { e.stopPropagation(); handleTopicBoxClick(topicBox, sectionId, subsectionId); }}
                style={{
                  padding: '4px 9px', backgroundColor: '#fff', color: colors.textSecondary,
                  border: `1px solid ${colors.topicBorder}`, borderRadius: '5px',
                  cursor: 'pointer', fontSize: '11px', fontWeight: '600',
                  display: 'flex', alignItems: 'center', gap: '4px', marginRight: '6px', flexShrink: 0,
                  fontFamily: "'DM Sans', sans-serif"
                }}
                title="Edit topic"
              >
                <Edit2 size={11} /> Edit
              </button>

              {/* Delete button */}
              <button
                onClick={e => { e.stopPropagation(); actions.confirmDeleteTopicBox(sectionId, subsectionId, topicBox.id); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                  display: 'flex', alignItems: 'center', color: colors.dangerBtn, flexShrink: 0
                }}
                title="Delete topic box"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* ── Tab Content ── */}
            {activeTab === 'topic' && (
              <div
                onClick={() => handleTopicBoxClick(topicBox, sectionId, subsectionId)}
                style={{ padding: '13px 16px', cursor: 'pointer' }}
              >
                <h4 style={{ margin: '0 0 7px', fontSize: '14px', fontWeight: '600', color: colors.textPrimary }}>
                  {topicBox.title}
                </h4>

                {(topicBox.learning_objectives || []).length > 0 && (
                  <ul style={{ margin: '0 0 10px', paddingLeft: '18px', fontSize: '12.5px', color: colors.textSecondary, lineHeight: '1.6' }}>
                    {topicBox.learning_objectives.slice(0, 3).map((obj, i) => (
                      <li key={i} style={{ marginBottom: '3px' }}>{obj}</li>
                    ))}
                    {topicBox.learning_objectives.length > 3 && (
                      <li style={{ color: '#9CA3AF', fontStyle: 'italic' }}>
                        +{topicBox.learning_objectives.length - 3} more…
                      </li>
                    )}
                  </ul>
                )}

                {/* Duration only — PLA pillars moved to subsection header */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '11.5px', padding: '3px 8px', borderRadius: '4px',
                    backgroundColor: '#F5F5F4', color: colors.textSecondary
                  }}>
                    🕐 {topicBox.duration_minutes || 0} min
                  </span>
                </div>
              </div>
            )}

            {activeTab === 'videos' && renderResourceCards(videos, 'video')}
            {activeTab === 'activities' && renderResourceCards(activities, 'activity')}
            {activeTab === 'worksheets' && renderResourceCards(worksheets, 'worksheet')}

            {/* ── Bottom Action Strip ── */}
            <div style={{
              display: 'flex',
              gap: '4px',
              padding: '5px 10px',
              borderTop: `1px solid ${colors.topicBorder}`,
              backgroundColor: '#FAFAF9',
              justifyContent: 'flex-end'
            }}>
            <button
              onClick={e => { e.stopPropagation(); actions.addTopicBox(sectionId, subsectionId); }}
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
                gap: '3px'
              }}
              title="Add new topic box"
            >
              <Plus size={10} /> Topic
            </button>

            <button
              onClick={e => {
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
                gap: '3px'
              }}
              title="AI generate topic"
            >
              <Sparkles size={10} /> AI
            </button>
          </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Section Block (render function, NOT a component — avoids remount on parent re-render) ──
  const renderSectionBlock = (section, index, dragHandleProps) => {
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
          marginBottom: '16px',
          backgroundColor: colors.card,
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
        }}
      >
        {/* Section header with attached description */}
        <div>
          {/* Header bar */}
          <div style={{
            backgroundColor: colors.sectionBg,
            display: 'flex',
            alignItems: 'center',
            gap: '0',
            borderBottom: isCollapsed ? 'none' : `1px solid ${colors.sectionBorder}`
          }}>
            {/* Green left stripe */}
            <div style={{
              width: '5px',
              alignSelf: 'stretch',
              backgroundColor: colors.sectionStripe,
              flexShrink: 0,
              borderRadius: '0'
            }} />

            <div style={{ flex: 1, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div {...dragHandleProps} style={{ cursor: 'grab', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <GripVertical size={16} style={{ color: '#D6D3D1' }} />
              </div>

              <button onClick={() => actions.toggleSection(section.id)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '11px', color: colors.sectionStripe, padding: 0, flexShrink: 0,
                transition: 'transform 0.2s', transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)'
              }}>
                ▶
              </button>

              <span style={{
                fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
                letterSpacing: '0.7px', color: colors.sectionStripe,
                background: '#DCFCE7', padding: '2px 7px', borderRadius: '4px', flexShrink: 0
              }}>
                Section {index + 1}
              </span>

              <EditableField
                value={section.title}
                onChange={val => actions.updateSectionTitle(section.id, val)}
                placeholder="Section title"
                accentColor={colors.sectionStripe}
                maxLength={80}
                style={{ flex: 1 }}
                inputStyle={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: '16px',
                  fontWeight: '500',
                  color: colors.textPrimary,
                  letterSpacing: '-0.2px'
                }}
              />

              {/* Action buttons — reveal on section hover */}
              <div style={{
                display: 'flex', gap: '4px', alignItems: 'center',
                opacity: hoveredSection === section.id ? 1 : 0,
                transition: 'opacity 0.15s',
                pointerEvents: hoveredSection === section.id ? 'auto' : 'none'
              }}>
                <button
                  onClick={(e) => { e.stopPropagation(); actions.addSection(); }}
                  style={{
                    padding: '3px 9px', backgroundColor: '#fff', color: colors.textSecondary,
                    border: `1px solid ${colors.sectionBorder}`, borderRadius: '4px',
                    cursor: 'pointer', fontSize: '10px', fontWeight: '600',
                    display: 'flex', alignItems: 'center', gap: '3px',
                    fontFamily: "'DM Sans', sans-serif"
                  }}
                  title="Add section"
                >
                  <Plus size={10} /> Sec
                </button>

                <button
                  onClick={(e) => {
                    openBubble(e, `section-${section.id}`, (guidance) => {
                      actions.handleGenerateSections({
                        level: 'sections',
                        context: { course: { title: courseName, description: formData?.objectives || '', grade: formData?.class || '' } },
                        userGuidance: guidance, count: 1
                      });
                    });
                  }}
                  style={{
                    padding: '3px 9px', backgroundColor: colors.aiBtn, color: '#fff',
                    border: 'none', borderRadius: '4px', cursor: 'pointer',
                    fontSize: '10px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px',
                    fontFamily: "'DM Sans', sans-serif"
                  }}
                  title="AI generate section"
                >
                  <Sparkles size={10} /> AI
                </button>

                <button
                  onClick={() => actions.confirmDeleteSection(section.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                    display: 'flex', alignItems: 'center', color: colors.dangerBtn, borderRadius: '4px'
                  }}
                  title="Delete section"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* Description */}
          {!isCollapsed && (
            <div style={{
              backgroundColor: '#FAFAF9',
              padding: '9px 16px 9px 21px',
              borderBottom: `1px solid ${colors.sectionBorder}`
            }}>
              <EditableField
                value={section.description}
                onChange={val => actions.updateSectionDescription(section.id, val)}
                placeholder="Add a description…"
                accentColor={colors.sectionStripe}
                maxLength={200}
                style={{ flex: 1 }}
                inputStyle={{
                  fontSize: '12.5px',
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

                    // Aggregate unique PLA pillars from this subsection's topic boxes
                    const subPillarSet = new Set();
                    (sub.topicBoxes || []).forEach(t => (t.pla_pillars || []).forEach(p => subPillarSet.add(p)));
                    const subPillars = Array.from(subPillarSet).slice(0, 2);

                    return (
                      <Draggable
                        key={sub.id}
                        draggableId={sub.id}
                        index={subIdx}
                      >
                        {(provided, snapshot) => (
                          <div
                            style={{ marginBottom: '10px' }}
                            onMouseEnter={() => setHoveredSubsection(sub.id)}
                            onMouseLeave={() => setHoveredSubsection(null)}
                          >
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              style={{
                                ...provided.draggableProps.style,
                                opacity: snapshot.isDragging ? 0.85 : 1,
                                border: `1px solid ${colors.subsectionBorder}`,
                                borderRadius: '10px',
                                backgroundColor: colors.subsectionBg,
                                overflow: 'hidden'
                              }}
                            >
                              {/* Subsection header */}
                              <div style={{ position: 'relative' }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0',
                                  borderBottom: isSubCollapsed ? 'none' : `1px solid ${colors.subsectionBorder}`
                                }}>
                                  {/* Blue left stripe */}
                                  <div style={{
                                    width: '4px', alignSelf: 'stretch',
                                    backgroundColor: colors.subsectionStripe, flexShrink: 0
                                  }} />

                                  <div style={{ flex: 1, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div {...provided.dragHandleProps} style={{ cursor: 'grab', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                      <GripVertical size={14} style={{ color: '#D6D3D1' }} />
                                    </div>

                                    <button onClick={() => actions.toggleSubsection(sub.id)} style={{
                                      background: 'none', border: 'none', cursor: 'pointer',
                                      fontSize: '10px', color: colors.subsectionStripe, padding: 0, flexShrink: 0,
                                      transition: 'transform 0.2s', transform: isSubCollapsed ? 'rotate(0deg)' : 'rotate(90deg)'
                                    }}>
                                      ▶
                                    </button>

                                    <span style={{
                                      fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
                                      letterSpacing: '0.6px', color: colors.subsectionStripe, flexShrink: 0
                                    }}>
                                      {index + 1}.{subIdx + 1}
                                    </span>

                                    <EditableField
                                      value={sub.title}
                                      onChange={val => actions.updateSubsectionTitle(section.id, sub.id, val)}
                                      placeholder="Subsection title"
                                      accentColor={colors.subsectionStripe}
                                      maxLength={80}
                                      style={{ flex: 1 }}
                                      inputStyle={{
                                        fontSize: '13.5px',
                                        fontWeight: '600',
                                        color: colors.textPrimary
                                      }}
                                    />

                                    {/* PLA Pillar tags */}
                                    {subPillars.map(pillar => (
                                      <span key={pillar} style={{
                                        fontSize: '10px', fontWeight: '500', flexShrink: 0,
                                        padding: '2px 7px', borderRadius: '4px',
                                        backgroundColor: colors.pla[pillar] || '#F5F5F4',
                                        color: colors.plaText[pillar] || colors.textSecondary
                                      }}>
                                        {pillar}
                                      </span>
                                    ))}

                                    {/* Action buttons — reveal on subsection hover */}
                                    <div style={{
                                      display: 'flex', gap: '4px', alignItems: 'center',
                                      opacity: hoveredSubsection === sub.id ? 1 : 0,
                                      transition: 'opacity 0.15s',
                                      pointerEvents: hoveredSubsection === sub.id ? 'auto' : 'none'
                                    }}>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); actions.addSubsection(section.id); }}
                                        style={{
                                          padding: '3px 8px', backgroundColor: '#fff', color: colors.textSecondary,
                                          border: `1px solid ${colors.subsectionBorder}`, borderRadius: '4px',
                                          cursor: 'pointer', fontSize: '10px', fontWeight: '600',
                                          display: 'flex', alignItems: 'center', gap: '3px',
                                          fontFamily: "'DM Sans', sans-serif"
                                        }}
                                        title="Add subsection"
                                      >
                                        <Plus size={10} /> Sub
                                      </button>

                                      <button
                                        onClick={(e) => {
                                          openBubble(e, `subsection-${section.id}-${sub.id}`, (guidance) => {
                                            actions.handleGenerateSubsections(section.id, {
                                              level: 'subsections',
                                              context: {
                                                course: { title: courseName, description: formData?.objectives || '', grade: formData?.class || '' },
                                                current_section: {
                                                  title: section?.title || 'Unknown',
                                                  description: section?.description || '',
                                                  existingSubsections: (section?.subsections || []).map(s => ({ title: s.title, description: s.description }))
                                                },
                                                all_section_names: sections.filter(s => s.type !== 'break').map(s => s.title),
                                                other_sections: sections.filter(s => s.type !== 'break' && s.id !== section.id).map(s => ({
                                                  title: s.title, description: s.description,
                                                  subsections: (s.subsections || []).map(ss => ss.title)
                                                }))
                                              },
                                              userGuidance: guidance, count: 1
                                            });
                                          });
                                        }}
                                        style={{
                                          padding: '3px 8px', backgroundColor: colors.aiBtn, color: '#fff',
                                          border: 'none', borderRadius: '4px', cursor: 'pointer',
                                          fontSize: '10px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px',
                                          fontFamily: "'DM Sans', sans-serif"
                                        }}
                                        title="AI generate subsection"
                                      >
                                        <Sparkles size={10} /> AI
                                      </button>

                                      <button
                                        onClick={() => actions.confirmDeleteSubsection(section.id, sub.id)}
                                        style={{
                                          background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                                          display: 'flex', alignItems: 'center', color: colors.dangerBtn, borderRadius: '4px'
                                        }}
                                        title="Delete subsection"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {/* Description */}
                                {!isSubCollapsed && (
                                  <div style={{
                                    backgroundColor: '#FAFAF9',
                                    padding: '7px 12px 10px 16px',
                                    borderBottom: `1px solid ${colors.subsectionBorder}`
                                  }}>
                                    <EditableField
                                      value={sub.description}
                                      onChange={val => actions.updateSubsectionDescription(section.id, sub.id, val)}
                                      placeholder="Add a description…"
                                      accentColor={colors.subsectionStripe}
                                      maxLength={200}
                                      style={{ flex: 1 }}
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
                                                  {renderTopicBoxRow(topic, section.id, sub.id, provided.dragHandleProps)}
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
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
      {/* Top Bar */}
      <div style={{
        padding: '0 28px', borderBottom: '1px solid #E7E5E4', height: '60px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', flexShrink: 0
      }}>
        {/* Left: course title + grade */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <EditableField
            value={courseName}
            onChange={val => setCourseName(val)}
            placeholder="Course name"
            accentColor={colors.sectionStripe}
            maxLength={60}
            style={{ display: 'flex', alignItems: 'center' }}
            inputStyle={{
              fontFamily: "'Fraunces', serif",
              fontSize: '19px',
              fontWeight: '500',
              color: colors.textPrimary,
              letterSpacing: '-0.3px'
            }}
          />
          <LineageAttribution lineage={forkLineage} />
          {formData?.class && (
            <span style={{
              fontSize: '11.5px',
              fontWeight: '600',
              color: colors.subsectionStripe,
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              padding: '3px 9px',
              borderRadius: '20px'
            }}>
              Grade {formData.class}
            </span>
          )}
        </div>

        {/* Right: controls */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Visibility toggle */}
          <div
            onClick={onToggleVisibility}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer',
              padding: '5px 12px', borderRadius: '20px',
              backgroundColor: isPublic ? '#F0FDF4' : '#F9FAFB',
              border: `1px solid ${isPublic ? '#BBF7D0' : '#E5E7EB'}`,
              transition: 'all 0.2s'
            }}
          >
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              backgroundColor: isPublic ? '#16A34A' : '#9CA3AF'
            }} />
            <span style={{ fontSize: '12.5px', color: isPublic ? '#16A34A' : '#6B7280', fontWeight: '500' }}>
              {isPublic ? 'Public' : 'Private'}
            </span>
          </div>

          <button onClick={onUndo} disabled={!canUndo} style={{
            padding: '6px 13px',
            backgroundColor: 'transparent',
            color: !canUndo ? '#D1D5DB' : '#6B7280',
            border: `1px solid ${!canUndo ? '#E5E7EB' : '#D1D5DB'}`,
            borderRadius: '6px', cursor: !canUndo ? 'not-allowed' : 'pointer', fontSize: '13px',
            fontFamily: "'DM Sans', sans-serif"
          }}>↶ Undo</button>

          {/* Autosave status */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 14px', backgroundColor: 'white',
            border: '1px solid #E7E5E4', borderRadius: '20px', fontSize: '12px',
            ...(saveStatus === 'saving' ? { color: '#6B7280', borderColor: '#D1D5DB' } :
               saveStatus === 'saved'  ? { color: '#16A34A', borderColor: '#BBF7D0' } :
               saveStatus === 'error'  ? { color: '#DC2626', borderColor: '#FECACA' } :
               { color: '#9CA3AF' })
          }}>
            {saveStatus === 'saving' && (
              <>
                <span style={{
                  width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#9CA3AF',
                  display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0
                }} />
                Saving to cloud…
              </>
            )}
            {saveStatus === 'saved' && (<>&#10003; Saved</>)}
            {saveStatus === 'error' && (<>&#10005; Error saving</>)}
            {saveStatus === 'idle'  && (<>&#10003; Saved</>)}
          </div>

          <button onClick={() => navigate('/my-courses')} style={{
            padding: '7px 14px', backgroundColor: '#1C1917', color: 'white',
            border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
            fontFamily: "'DM Sans', sans-serif"
          }}>← My Courses</button>
        </div>
      </div>

      {/* Action bar */}
      <div style={{
        padding: '8px 28px', backgroundColor: 'white',
        borderBottom: '1px solid #F3F4F6',
        display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={actions.addSection} style={{
            padding: '5px 12px', backgroundColor: 'transparent',
            color: colors.textSecondary, border: '1.5px dashed #D6D3D1',
            borderRadius: '6px', cursor: 'pointer', fontSize: '12.5px', fontWeight: '500',
            display: 'flex', alignItems: 'center', gap: '4px',
            fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s'
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = colors.sectionStripe; e.currentTarget.style.color = colors.sectionStripe; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#D6D3D1'; e.currentTarget.style.color = colors.textSecondary; }}
          >
            <Plus size={13} /> Section
          </button>

          <button onClick={onAddBreak} style={{
            padding: '5px 12px', backgroundColor: 'transparent',
            color: colors.textSecondary, border: '1.5px dashed #D6D3D1',
            borderRadius: '6px', cursor: 'pointer', fontSize: '12.5px', fontWeight: '500',
            fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s'
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#D97706'; e.currentTarget.style.color = '#D97706'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#D6D3D1'; e.currentTarget.style.color = colors.textSecondary; }}
          >⏸ Break</button>
        </div>

        <span style={{ fontSize: '12px', color: '#A8A29E' }}>
          {sections.filter(s => s.type !== 'break').length} section{sections.filter(s => s.type !== 'break').length !== 1 ? 's' : ''} ·{' '}
          {sections.reduce((acc, s) => acc + (s.subsections?.length || 0), 0)} subsections ·{' '}
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
                          {renderSectionBlock(section, idx, provided.dragHandleProps)}
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