// src/components/courses/CourseEditor.jsx
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Edit2, Check, Trash2, Plus, PlayCircle, FileText, Zap, Sparkles } from 'lucide-react';
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
  maxLength = null,
  multiline = false
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
    if (e.key === 'Enter' && !multiline) {
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
      {multiline && isEditing ? (
        <textarea
          ref={inputRef}
          value={localValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          placeholder={placeholder}
          rows={4}
          style={{
            width: '100%',
            flex: hasFlex ? 1 : undefined,
            minWidth: '60px',
            border: '2px solid #000',
            background: '#fff',
            outline: 'none',
            cursor: 'text',
            padding: '6px 10px',
            borderRadius: '4px',
            resize: 'vertical',
            fontFamily: 'inherit',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            ...inputStyle
          }}
        />
      ) : multiline && !isEditing ? (
        <div
          onClick={handleEdit}
          style={{
            width: hasFlex ? undefined : `${charWidth}ch`,
            flex: hasFlex ? 1 : undefined,
            minWidth: '60px',
            maxWidth: '100%',
            cursor: 'pointer',
            padding: '0',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            color: value ? undefined : '#9ca3af',
            fontStyle: value ? 'normal' : 'italic',
            ...inputStyle
          }}
        >
          {value || placeholder}
        </div>
      ) : (
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
      )}
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
          fontSize: '11px',
          color: localValue.length >= maxLength ? '#ef4444' : '#9ca3af',
          flexShrink: 0
        }}>
          {localValue.length}/{maxLength}
        </span>
      )}
    </div>
  );
};

const CourseEditor = ({
  courseName,
  setCourseName,
  courseClass,
  setCourseClass,
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
  onBack,
  isPublic,
  onToggleVisibility,
  onShare,
  isEdoOpen,
  onToggleEdo,
  onTopicDetailOpen,
}) => {
  const [selectedTopicForDetail, setSelectedTopicForDetail] = useState(null);
  const [hoveredTopic, setHoveredTopic] = useState(null);
  const [activeTabByTopic, setActiveTabByTopic] = useState({});

  // ── Colors ────────────────────────────────────────────────────────────
  const colors = {
    bg: '#FAFAF9',
    card: 'rgba(255,255,255,0.70)',
    sectionBorder: 'rgba(255,255,255,0.88)',
    sectionBg: 'rgba(255,255,255,0.70)',
    sectionBodyBg: 'rgba(255,255,255,0.30)',
    subsectionBg: 'rgba(255,255,255,0.78)',
    subsectionBorder: 'rgba(255,255,255,0.92)',
    topicBg: '#FFFFFF',
    topicBorder: 'rgba(200,200,200,0.4)',
    textPrimary: '#111',
    textSecondary: '#111',
    pillBg: '#F5F5F4',
    pillText: '#333',
    dangerBtn: '#F87171',
    aiBtn: '#7C3AED',
    sectionGradients: [
      'linear-gradient(180deg,#B2E8C8,#ACD8F0)',
      'linear-gradient(180deg,#F2C0D4,#F7E4A0)',
      'linear-gradient(180deg,#ACD8F0,#B2E8C8)',
      'linear-gradient(180deg,#F7E4A0,#F2C0D4)',
    ],
    topicBorderColors: ['#ACD8F0', '#F2C0D4', '#B2E8C8', '#F7E4A0'],
    topicTints: [
      'rgba(172,216,240,0.14)',
      'rgba(242,192,212,0.14)',
      'rgba(178,232,200,0.14)',
      'rgba(247,228,160,0.14)',
    ],
    topicDeepColors: ['#2A6A8A', '#7A2A4A', '#1C5C35', '#5C3A08'],
    pla: {
      'Personal Growth': '#F2C0D4',
      'Core Learning': '#ACD8F0',
      'Critical Thinking': '#F7E4A0',
      'Application & Impact': '#B2E8C8'
    },
    plaText: {
      'Personal Growth': '#7A1A3A',
      'Core Learning': '#0C3A5A',
      'Critical Thinking': '#5C3A08',
      'Application & Impact': '#1C5C35'
    }
  };

  // Hover tracking for sections/subsections (for reveal-on-hover buttons)
  const [hoveredSection, setHoveredSection] = useState(null);
  const [hoveredSubsection, setHoveredSubsection] = useState(null);

  // ── Topic Detail Modal Handler ────────────────────────────────────────
  const handleTopicBoxClick = (topicBox, sectionId, subsectionId, topicIdx = 0) => {
    setSelectedTopicForDetail({ topicBox, sectionId, subsectionId, topicIdx });
    onTopicDetailOpen?.({ type: 'topic', id: topicBox.id, title: topicBox.title, sectionId, subsectionId });
  };

  const handleSaveTopicDetail = (updateData) => {
    actions.updateTopicBoxFull(updateData);
    setSelectedTopicForDetail(null);
    onTopicDetailOpen?.(null);
  };

  // ── Inline Components ─────────────────────────────────────────────────
  
  const Pill = ({ label, color }) => (
    <span style={{
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: '12px',
      fontSize: '12.1px',
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
          <h3 style={{ margin: '0 0 12px', fontSize: '19.8px', color: colors.textPrimary }}>
            {title}
          </h3>
          <p style={{ margin: '0 0 20px', fontSize: '15.4px', color: colors.textSecondary }}>
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
                fontSize: '15.4px',
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
                fontSize: '15.4px',
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
  const renderTopicBoxRow = (topicBox, sectionId, subsectionId, dragHandleProps, topicIdx = 0) => {
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
          <div style={{ padding: '14px 16px', color: '#444', fontSize: '15px', fontStyle: 'italic' }}>
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
              ? <PlayCircle size={22} style={{ color: '#666' }} />
              : type === 'worksheet'
                ? <FileText size={22} style={{ color: '#666' }} />
                : <Zap size={22} style={{ color: '#666' }} />;
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
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#111',
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

    const topicAccentColor = colors.topicBorderColors[topicIdx % 4];
    const topicTint = colors.topicTints[topicIdx % 4];

    return (
      <div
        onMouseEnter={() => setHoveredTopic(topicBox.id)}
        onMouseLeave={() => setHoveredTopic(null)}
      >
        <div style={{
          border: '1px solid rgba(0,0,0,0.09)',
          borderLeft: `3px solid ${topicAccentColor}`,
          borderRadius: '0 8px 8px 0',
          background: '#FFFFFF',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* ── Folder Tab Bar ── */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: topicTint,
              borderBottom: '1px solid rgba(0,0,0,0.07)',
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
                  color: '#999', fontSize: '13.2px'
                }}
              >
                <GripVertical size={13} style={{ color: '#999' }} />
              </div>

              {/* Tabs */}
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={e => { e.stopPropagation(); setActiveTab(tab.id); }}
                  style={{
                    padding: '8px 10px',
                    border: 'none',
                    borderBottom: activeTab === tab.id ? `2px solid ${topicAccentColor}` : '2px solid transparent',
                    marginBottom: '-1px',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    fontSize: '13.2px',
                    fontWeight: activeTab === tab.id ? '600' : '400',
                    color: activeTab === tab.id ? '#111' : '#555',
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
                onClick={e => { e.stopPropagation(); handleTopicBoxClick(topicBox, sectionId, subsectionId, topicIdx); }}
                style={{
                  padding: '3px 9px', background: '#FFFFFF', color: '#333',
                  border: '1px solid rgba(0,0,0,0.1)', borderRadius: '5px',
                  cursor: 'pointer', fontSize: '12.1px', fontWeight: '500',
                  display: 'flex', alignItems: 'center', gap: '4px', marginRight: '6px', flexShrink: 0,
                  fontFamily: "'DM Sans', sans-serif"
                }}
                title="Edit topic"
              >
                <Edit2 size={11} /> Edit
              </button>

              {/* Delete button — hover-only */}
              <button
                onClick={e => { e.stopPropagation(); actions.confirmDeleteTopicBox(sectionId, subsectionId, topicBox.id); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                  display: 'flex', alignItems: 'center', color: '#F87171', flexShrink: 0,
                  opacity: hoveredTopic === topicBox.id ? 1 : 0,
                  pointerEvents: hoveredTopic === topicBox.id ? 'auto' : 'none',
                  transition: 'opacity 0.15s'
                }}
                title="Delete topic box"
              >
                <Trash2 size={13} />
              </button>
            </div>

            {/* ── Tab Content ── */}
            {activeTab === 'topic' && (
              <div
                onClick={() => handleTopicBoxClick(topicBox, sectionId, subsectionId, topicIdx)}
                style={{ padding: '13px 16px', cursor: 'pointer' }}
              >
                <h4 style={{ margin: '0 0 7px', fontSize: '15px', fontWeight: '600', color: '#111', fontFamily: "'DM Sans', sans-serif" }}>
                  {topicBox.title}
                </h4>

                {(topicBox.learning_objectives || []).length > 0 && (
                  <ul style={{ margin: '0 0 10px', padding: 0, listStyle: 'none', fontSize: '14px', color: '#111', lineHeight: '1.5' }}>
                    {topicBox.learning_objectives.slice(0, 3).map((obj, i) => (
                      <li key={i} style={{ marginBottom: '2.5px', paddingLeft: '13px', position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 0, top: '9px', width: '4px', height: '4px', borderRadius: '50%', background: '#D1D5DB', display: 'inline-block' }} />
                        {obj}
                      </li>
                    ))}
                    {topicBox.learning_objectives.length > 3 && (
                      <li style={{ color: '#555', fontStyle: 'italic', paddingLeft: '13px' }}>
                        +{topicBox.learning_objectives.length - 3} more…
                      </li>
                    )}
                  </ul>
                )}

                {/* Duration */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#444' }}>
                  ⏱ {topicBox.duration_minutes || 0} min
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
              borderTop: '1px solid rgba(0,0,0,0.05)',
              background: topicTint,
              justifyContent: 'flex-end'
            }}>
            <button
              onClick={e => { e.stopPropagation(); actions.addTopicBox(sectionId, subsectionId); }}
              style={{
                padding: '3px 8px',
                background: '#FFFFFF',
                color: '#333',
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '3px'
              }}
              title="Add new topic box"
            >
              <Plus size={10} /> Topic
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
          padding: '12px 16px', marginBottom: '18px',
          background: '#FFFDF0', border: '1px solid rgba(0,0,0,0.09)',
          borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div {...dragHandleProps} style={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}>
              <GripVertical size={18} style={{ color: '#666' }} />
            </div>
            <span style={{ fontWeight: '500', fontSize: '15.4px', color: '#111' }}>⏸ Break — {section.duration}</span>
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
        style={{ marginBottom: '18px' }}
      >
        {/* SEC-HEAD: rounded top 12 12 0 0 */}
        <div
          onClick={() => actions.toggleSection(section.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 16px',
            background: '#FFFFFF',
            border: '1px solid rgba(0,0,0,0.09)',
            borderBottom: isCollapsed ? '1px solid rgba(0,0,0,0.09)' : '1px solid rgba(0,0,0,0.07)',
            borderRadius: isCollapsed ? '12px' : '12px 12px 0 0',
            cursor: 'pointer', transition: 'background 0.15s'
          }}
        >
          {/* Gradient accent pill — 4px × 36px */}
          <div style={{
            width: '4px', height: '36px', borderRadius: '3px', flexShrink: 0,
            background: colors.sectionGradients[index % 4]
          }} />

          {/* Drag handle */}
          <div {...dragHandleProps} onClick={e => e.stopPropagation()} style={{ cursor: 'grab', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <GripVertical size={14} style={{ color: '#999' }} />
          </div>

          {/* Section metadata */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1.1px', color: '#555' }}>
              Section {index + 1}
            </div>
            <EditableField
              value={section.title}
              onChange={val => actions.updateSectionTitle(section.id, val)}
              placeholder="Section title"
              accentColor="#666"
              maxLength={80}
              style={{ flex: 1 }}
              inputStyle={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: '17.6px',
                color: '#111',
              }}
            />
          </div>

          {/* Hover-only action buttons */}
          <div style={{
            display: 'flex', gap: '4px', alignItems: 'center',
            opacity: hoveredSection === section.id ? 1 : 0,
            transition: 'opacity 0.15s',
            pointerEvents: hoveredSection === section.id ? 'auto' : 'none'
          }}>
            <button
              onClick={(e) => { e.stopPropagation(); actions.addSection(); }}
              style={{
                padding: '3px 8px', background: '#FFFFFF', color: '#333',
                border: '1px solid rgba(0,0,0,0.1)', borderRadius: '4px',
                cursor: 'pointer', fontSize: '11px', fontWeight: '600',
                display: 'flex', alignItems: 'center', gap: '3px',
                fontFamily: "'DM Sans', sans-serif"
              }}
              title="Add section"
            >
              <Plus size={10} /> Sec
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); actions.confirmDeleteSection(section.id); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '3px 5px',
                display: 'flex', alignItems: 'center', color: '#F87171', borderRadius: '5px'
              }}
              title="Delete section"
            >
              <Trash2 size={13} />
            </button>
          </div>

          {/* Chevron */}
          <div style={{ color: '#555', fontSize: '14.3px', flexShrink: 0, transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▾</div>
        </div>

        {!isCollapsed && (
          <div style={{
            background: '#FAFAFA',
            border: '1px solid rgba(0,0,0,0.09)',
            borderTop: 'none',
            borderRadius: '0 0 12px 12px',
            padding: '18px 16px 14px'
          }}>
            {/* Description edit — inline inside body */}
            <div style={{ marginBottom: '12px' }}>
              <EditableField
                value={section.description}
                onChange={val => actions.updateSectionDescription(section.id, val)}
                placeholder="Add a description…"
                accentColor="#666"
                maxLength={400}
                multiline
                style={{ flex: 1 }}
                inputStyle={{
                  fontSize: '14px',
                  color: '#333',
                  fontStyle: section.description ? 'normal' : 'italic',
                  fontWeight: '400'
                }}
              />
            </div>
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
                      padding: '20px 0',
                      color: '#444',
                      fontSize: '14px',
                      marginBottom: '12px'
                    }}>
                      <p style={{ margin: '0 0 10px' }}>No subsections yet</p>
                      <button
                        onClick={() => actions.addSubsection(section.id)}
                        style={{
                          background: 'transparent',
                          border: '1px dashed rgba(0,0,0,0.2)',
                          borderRadius: '6px',
                          padding: '5px 20px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: '#444',
                          fontFamily: "'DM Sans', sans-serif",
                          display: 'inline-block'
                        }}
                      >
                        + Add Subsection
                      </button>
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
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            onMouseEnter={() => setHoveredSubsection(sub.id)}
                            onMouseLeave={() => setHoveredSubsection(null)}
                            style={{
                              ...provided.draggableProps.style,
                              marginLeft: '24px',
                              marginBottom: '10px',
                              border: '1px solid rgba(0,0,0,0.08)',
                              borderRadius: '9px',
                              background: '#FFFFFF',
                              overflow: 'hidden',
                              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                              opacity: snapshot.isDragging ? 0.85 : 1,
                            }}
                          >
                            {/* Subsection header — vertical text layout */}
                            <div style={{
                              display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '11px 14px',
                              borderBottom: isSubCollapsed ? 'none' : '1px solid rgba(0,0,0,0.05)',
                              cursor: 'pointer', transition: 'background 0.15s'
                            }}>
                              {/* Drag handle */}
                              <div {...provided.dragHandleProps} style={{ cursor: 'grab', display: 'flex', alignItems: 'center', flexShrink: 0, paddingTop: '2px' }}>
                                <GripVertical size={13} style={{ color: '#999' }} />
                              </div>

                              {/* Collapse chevron */}
                              <button
                                onClick={() => actions.toggleSubsection(sub.id)}
                                style={{
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  color: '#555', fontSize: '14.3px', padding: '2px 4px',
                                  flexShrink: 0, transition: 'transform 0.2s',
                                  transform: isSubCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'
                                }}
                              >
                                ▾
                              </button>

                              {/* Sub number */}
                              <div style={{ fontSize: '13px', fontWeight: '500', color: '#555', minWidth: '20px', paddingTop: '2px', flexShrink: 0 }}>
                                {index + 1}.{subIdx + 1}
                              </div>

                              {/* Vertical text block */}
                              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <EditableField
                                  value={sub.title}
                                  onChange={val => actions.updateSubsectionTitle(section.id, sub.id, val)}
                                  placeholder="Subsection title"
                                  accentColor="#666"
                                  maxLength={80}
                                  style={{ flex: 1 }}
                                  inputStyle={{
                                    fontSize: '15px',
                                    fontWeight: '600',
                                    color: '#111',
                                    lineHeight: '1.35'
                                  }}
                                />
                                <EditableField
                                  value={sub.description}
                                  onChange={val => actions.updateSubsectionDescription(section.id, sub.id, val)}
                                  placeholder="Add a description…"
                                  accentColor="#555"
                                  maxLength={400}
                                  multiline
                                  style={{ flex: 1 }}
                                  inputStyle={{
                                    fontSize: '13.5px',
                                    color: '#333',
                                    fontWeight: '400',
                                    lineHeight: '1.4',
                                    fontStyle: sub.description ? 'normal' : 'italic'
                                  }}
                                />
                              </div>

                              {/* Hover-only action buttons */}
                              <div style={{
                                display: 'flex', gap: '4px', alignItems: 'center',
                                opacity: hoveredSubsection === sub.id ? 1 : 0,
                                transition: 'opacity 0.15s',
                                pointerEvents: hoveredSubsection === sub.id ? 'auto' : 'none'
                              }}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); actions.addSubsection(section.id); }}
                                  style={{
                                    padding: '3px 8px', background: '#FFFFFF', color: '#333',
                                    border: '1px solid rgba(0,0,0,0.1)', borderRadius: '4px',
                                    cursor: 'pointer', fontSize: '11px', fontWeight: '600',
                                    display: 'flex', alignItems: 'center', gap: '3px',
                                    fontFamily: "'DM Sans', sans-serif"
                                  }}
                                  title="Add subsection"
                                >
                                  <Plus size={10} /> Sub
                                </button>
                                <button
                                  onClick={() => actions.confirmDeleteSubsection(section.id, sub.id)}
                                  style={{
                                    background: 'none', border: 'none', cursor: 'pointer', padding: '3px 5px',
                                    display: 'flex', alignItems: 'center', color: '#F87171', borderRadius: '5px'
                                  }}
                                  title="Delete subsection"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            {/* Subsection content */}
                            {!isSubCollapsed && (
                              <div style={{ padding: '12px 14px 12px 44px' }}>
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
                                          padding: '20px 0',
                                          color: '#444',
                                          fontSize: '14px',
                                          marginBottom: '12px'
                                        }}>
                                          <p style={{ margin: '0 0 10px' }}>No topic boxes yet</p>
                                          <button
                                            onClick={() => actions.addTopicBox(section.id, sub.id)}
                                            style={{
                                              background: 'transparent',
                                              border: '1px dashed rgba(0,0,0,0.2)',
                                              borderRadius: '6px',
                                              padding: '5px 20px',
                                              cursor: 'pointer',
                                              fontSize: '14px',
                                              color: '#444',
                                              fontFamily: "'DM Sans', sans-serif",
                                              display: 'inline-block'
                                            }}
                                          >
                                            + Add Topic
                                          </button>
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
                                                  marginLeft: '28px',
                                                  marginBottom: '8px',
                                                  opacity: snapshot.isDragging ? 0.9 : 1
                                                }}
                                              >
                                                {renderTopicBoxRow(topic, section.id, sub.id, provided.dragHandleProps, topicIdx)}
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
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
            {/* Add subsection button at bottom of section body */}
            <button
              onClick={() => actions.addSubsection(section.id)}
              style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: '#444',
                background: '#FFFFFF', border: '1px dashed rgba(0,0,0,0.2)',
                borderRadius: '8px', padding: '7px 14px', cursor: 'pointer',
                width: 'calc(100% - 24px)', marginLeft: '24px', textAlign: 'left',
                marginTop: '10px', display: 'block'
              }}
            >
              + Add subsection
            </button>
          </div>
        )}
      </div>
    );
  };

  // ── RENDER ────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    @keyframes spin { to { transform: rotate(360deg); } }
  `}</style>
      {/* Top Bar */}
      <div style={{
        padding: '0 28px', height: '68px',
        display: 'flex', alignItems: 'center', gap: '8px',
        background: '#FFFFFF',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        flexShrink: 0, position: 'sticky', top: 0, zIndex: 9
      }}>
        <button onClick={() => onBack ? onBack() : navigate('/my-courses')} style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: '13.8px', fontWeight: '500',
          padding: '6px 13px', borderRadius: '8px', cursor: 'pointer',
          background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.12)',
          color: '#111', whiteSpace: 'nowrap', flexShrink: 0, transition: 'background 0.15s'
        }}>← Course View</button>

        {/* Centre: course title */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
          <EditableField
            value={courseName}
            onChange={val => setCourseName(val)}
            placeholder="Course name"
            accentColor="#666"
            maxLength={60}
            style={{ display: 'flex', alignItems: 'center' }}
            inputStyle={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: '20.9px',
              color: '#111',
              letterSpacing: '-0.3px'
            }}
          />
        </div>

        {/* Undo */}
        <button onClick={onUndo} disabled={!canUndo} style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: '13.8px', fontWeight: '500',
          padding: '6px 13px', borderRadius: '8px', cursor: !canUndo ? 'not-allowed' : 'pointer',
          background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.12)',
          color: !canUndo ? '#999' : '#111', whiteSpace: 'nowrap', flexShrink: 0
        }}>↶ Undo</button>

        {/* Save status */}
        <div style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: '13.8px', fontWeight: '500',
          padding: '6px 13px', borderRadius: '8px',
          background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.12)',
          color: saveStatus === 'saving' ? '#6B7280' : '#1C5C35',
          whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px'
        }}>
          {saveStatus === 'saving' && (
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#9CA3AF', display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
          )}
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? '✕ Error' : '✓ Saved'}
        </div>

        {/* Private / Public toggle */}
        <div
          onClick={onToggleVisibility}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer',
            padding: '5px 11px', borderRadius: '8px',
            background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.12)',
            whiteSpace: 'nowrap', flexShrink: 0, transition: 'background 0.15s',
            fontFamily: "'DM Sans', sans-serif", fontSize: '13.8px', fontWeight: '500', color: '#111'
          }}
        >
          <div style={{
            width: '28px', height: '16px', borderRadius: '8px',
            background: isPublic ? '#86EFAC' : '#D1D5DB',
            position: 'relative', transition: 'background 0.2s', flexShrink: 0
          }}>
            <div style={{
              position: 'absolute', top: '2px',
              left: isPublic ? '14px' : '2px',
              width: '12px', height: '12px', borderRadius: '50%',
              background: 'white', transition: 'left 0.2s',
              boxShadow: '0 1px 2px rgba(0,0,0,0.15)'
            }} />
          </div>
          <span>{isPublic ? 'Public' : 'Private'}</span>
        </div>

        {/* Share */}
        {onShare && (
          <button
            onClick={onShare}
            style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: '13.8px', fontWeight: '500',
              padding: '6px 13px', borderRadius: '8px', cursor: 'pointer',
              background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.12)',
              color: '#111', whiteSpace: 'nowrap', flexShrink: 0, transition: 'background 0.15s',
              display: 'flex', alignItems: 'center', gap: '5px'
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            Share
          </button>
        )}

        {/* Divider */}
        <div style={{ width: '1px', height: '22px', background: 'rgba(0,0,0,0.08)', flexShrink: 0 }} />

        {/* Edo — amber tint */}
        {onToggleEdo && (
          <button
            onClick={onToggleEdo}
            title={isEdoOpen ? 'Close Edo AI' : 'Open Edo AI'}
            style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: '13.8px', fontWeight: '500',
              padding: '6px 13px', borderRadius: '8px', cursor: 'pointer',
              background: isEdoOpen ? 'rgba(247,228,160,0.85)' : 'rgba(247,228,160,0.6)',
              border: '1px solid rgba(180,150,30,0.25)',
              color: '#5C460A', whiteSpace: 'nowrap', flexShrink: 0, transition: 'background 0.15s',
              display: 'flex', alignItems: 'center', gap: '5px'
            }}
          >
            <Sparkles size={12} />
            Edo
          </button>
        )}
      </div>


      {/* Main content — topic detail panel OR course sections */}
      {selectedTopicForDetail ? (
        <TopicDetailsModal
          topic={selectedTopicForDetail.topicBox}
          sectionId={selectedTopicForDetail.sectionId}
          subsectionId={selectedTopicForDetail.subsectionId}
          onClose={() => { setSelectedTopicForDetail(null); onTopicDetailOpen?.(null); }}
          onSave={handleSaveTopicDetail}
          actions={actions}
          videosByTopic={videosByTopic}
          handsOnResources={handsOnResources}
          currentUser={currentUser}
          accentColor={colors.topicBorderColors[(selectedTopicForDetail.topicIdx || 0) % 4]}
          accentDeepColor={colors.topicDeepColors[(selectedTopicForDetail.topicIdx || 0) % 4]}
        />
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 80px', position: 'relative', zIndex: 1 }}>
          {sections.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '80px 20px',
              border: '1px solid rgba(0,0,0,0.08)', borderRadius: '16px',
              background: '#FFFFFF'
            }}>
              <p style={{ fontSize: '30.8px', marginBottom: '8px' }}>📚</p>
              <p style={{ fontSize: '22px', color: colors.textPrimary, fontWeight: '600', margin: '0 0 4px' }}>No sections yet</p>
              <p style={{ fontSize: '14.3px', color: colors.textSecondary, margin: 0 }}>Click "+ Section" above to start building your course</p>
            </div>
          ) : (
            <Droppable droppableId="all-sections" type="SECTION">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  {sections.map((section, idx) => (
                    <Draggable key={section.id} draggableId={section.id} index={idx}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          style={{ ...provided.draggableProps.style, opacity: snapshot.isDragging ? 0.8 : 1 }}
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
          )}
        </div>
      )}

      {/* Modals */}
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