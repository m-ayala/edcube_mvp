// src/components/courses/CourseEditor.jsx
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Edit2, Check, Trash2, Plus } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

// Extracted outside CourseEditor so React keeps stable identity across renders
export const EditableField = ({
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
  courseClass,
  setCourseClass,
  sections,
  setSections,
  videosByTopic,
  handsOnResources,
  formData,
  currentUser,
  actions,
  onAddBreak,
  navigate,
  onNavigateToSubsection,
}) => {

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

  // ── Inline Components ─────────────────────────────────────────────────
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
                    const blockCount = (handsOnResources[sub.id] || []).length;

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
                            onClick={() => onNavigateToSubsection?.(section.id, sub.id)}
                            style={{
                              ...provided.draggableProps.style,
                              marginLeft: '24px',
                              marginBottom: '10px',
                              border: '1px solid rgba(0,0,0,0.08)',
                              borderRadius: '9px',
                              background: '#FFFFFF',
                              overflow: 'hidden',
                              boxShadow: hoveredSubsection === sub.id
                                ? '0 2px 8px rgba(0,0,0,0.10)'
                                : '0 1px 4px rgba(0,0,0,0.05)',
                              opacity: snapshot.isDragging ? 0.85 : 1,
                              cursor: 'pointer',
                              transition: 'box-shadow 0.15s',
                            }}
                          >
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 14px',
                            }}>
                              {/* Subsection color bar */}
                              <div style={{
                                width: '3px', height: '28px', borderRadius: '2px', flexShrink: 0,
                                background: colors.sectionGradients[index % 4],
                              }} />

                              {/* Drag handle */}
                              <div
                                {...provided.dragHandleProps}
                                onClick={e => e.stopPropagation()}
                                style={{ cursor: 'grab', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                              >
                                <GripVertical size={13} style={{ color: '#999' }} />
                              </div>

                              {/* Sub number */}
                              <div style={{ fontSize: '13px', fontWeight: '500', color: '#555', minWidth: '20px', flexShrink: 0 }}>
                                {index + 1}.{subIdx + 1}
                              </div>

                              {/* Title + description (read-only) */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '15px', fontWeight: '600', color: '#111', lineHeight: '1.35' }}>
                                  {sub.title || 'Untitled subsection'}
                                </div>
                                {sub.description && (
                                  <div style={{
                                    fontSize: '13px', color: '#555', lineHeight: '1.4', marginTop: '3px',
                                    overflow: 'hidden', display: '-webkit-box',
                                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'
                                  }}>
                                    {sub.description}
                                  </div>
                                )}
                              </div>

                              {/* Block count */}
                              <span style={{ fontSize: '12px', color: '#888', flexShrink: 0 }}>
                                {blockCount} block{blockCount !== 1 ? 's' : ''}
                              </span>

                              {/* Delete — hover only */}
                              <button
                                onClick={e => { e.stopPropagation(); actions.confirmDeleteSubsection(section.id, sub.id); }}
                                style={{
                                  background: 'none', border: 'none', cursor: 'pointer', padding: '3px 5px',
                                  display: 'flex', alignItems: 'center', color: '#F87171', borderRadius: '5px',
                                  flexShrink: 0,
                                  opacity: hoveredSubsection === sub.id ? 1 : 0,
                                  transition: 'opacity 0.15s',
                                  pointerEvents: hoveredSubsection === sub.id ? 'auto' : 'none',
                                }}
                                title="Delete subsection"
                              >
                                <Trash2 size={13} />
                              </button>

                              {/* Arrow */}
                              <span style={{ color: '#bbb', fontSize: '14px', flexShrink: 0 }}>›</span>
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
      {/* Course Outline — sections and subsections only */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 48px 80px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
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
      </div>

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