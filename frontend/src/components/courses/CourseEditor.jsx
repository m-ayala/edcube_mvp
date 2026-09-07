// src/components/courses/CourseEditor.jsx
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Edit2, Check, Trash2, Plus, ChevronDown, ChevronLeft, Pencil } from 'lucide-react';
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

// ── Redesigned outline palette (Figma "Edit workspace") ─────────────────
const FONT = "'DM Sans', sans-serif";
const T = {
  crumbMuted: '#8a8a8a',
  crumbActive: '#3e62bc',
  sectionTag: '#3e62bc',
  heading: '#1f1f1f',
  desc: '#727272',
  rowBorder: '#d7e1fb',
  numBg: '#ebf0ff',
  numFg: '#3e62bc',
  cardBorder: '#e4e4e4',
  cardTitle: '#262626',
  cardDesc: '#8f8f8f',
  primary: '#bf2066',
  dashed: '#cdd7ee',
  addPillBg: '#f1f1f1',
  addPillFg: '#9b9b9b',
  iconEditBg: '#fff2f8', iconEditFg: '#bf2066',
  iconDelBg: '#fff3dc', iconDelFg: '#c0871d',
};

const BLOCK_TAG = {
  content:   { bg: '#fff2f8', fg: '#ad004b', label: 'Content' },
  worksheet: { bg: '#fff3dc', fg: '#a9761b', label: 'Worksheet' },
  activity:  { bg: '#e7f7ee', fg: '#1a7a40', label: 'Activity' },
};

const iconBtn = (bg, fg, size = 30) => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: `${size}px`, height: `${size}px`, borderRadius: size >= 30 ? '8px' : '7px',
  border: 'none', padding: 0,
  background: bg, color: fg, cursor: 'pointer', flexShrink: 0,
});

const menuActionStyle = {
  display: 'flex', width: '100%', alignItems: 'center', gap: '8px',
  padding: '9px 10px', border: 'none', borderRadius: '8px', cursor: 'pointer',
  background: 'transparent', color: '#3e62bc', fontFamily: FONT, fontSize: '13px', fontWeight: 600, textAlign: 'left',
};

const addPill = {
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  padding: '6px 16px', borderRadius: '7px', background: T.addPillBg,
  color: T.addPillFg, fontFamily: FONT, fontWeight: 600, fontSize: '11px',
};

const EmptyState = ({ onAdd }) => (
  <div style={{
    textAlign: 'center', padding: '90px 20px', marginTop: '30px',
    border: '1px solid #ececec', borderRadius: '16px', background: '#FFFFFF',
  }}>
    <p style={{ fontSize: '30px', margin: '0 0 8px' }}>📚</p>
    <p style={{ fontSize: '20px', fontWeight: 600, color: T.heading, margin: '0 0 4px' }}>No sections yet</p>
    <p style={{ fontSize: '14px', color: T.desc, margin: '0 0 16px' }}>Start building your course outline.</p>
    <button
      onClick={onAdd}
      style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: T.primary, color: '#fff', fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}
    >
      + Add section
    </button>
  </div>
);

const ConfirmDialog = ({ isOpen, onConfirm, onCancel, title, message }) => {
  if (!isOpen) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '12px', padding: '24px',
        maxWidth: '400px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', fontFamily: FONT,
      }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '19px', color: T.heading }}>{title}</h3>
        <p style={{ margin: '0 0 20px', fontSize: '15px', color: '#444' }}>{message}</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{ padding: '8px 16px', backgroundColor: '#f3f4f6', color: T.heading, border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{ padding: '8px 16px', backgroundColor: '#F87171', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

let _blockSeq = 0;
const nextBlockId = () => `block-${Date.now()}-${(_blockSeq += 1)}`;

const CourseEditor = ({
  sections,
  handsOnResources,
  formData,
  actions,
  onAddBreak,
  navigate,
  onNavigateToSubsection,
  onNavigateToBlock,
  onBack,
  courseName,
  pendingSubsectionIds,
}) => {
  const [activeId, setActiveId] = useState(sections[0]?.id || null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoveredSub, setHoveredSub] = useState(null);

  // Resolve the visible section from the stored id, falling back to the first
  // section when the stored id no longer exists (e.g. it was just deleted).
  const activeIndex = Math.max(0, sections.findIndex(s => s.id === activeId));
  const section = sections[activeIndex] || null;
  const secNum = activeIndex + 1;

  const addBlockToSub = (subId) => {
    if (!section) return;
    const id = nextBlockId();
    actions.addBlock(subId, { id, type: 'content', title: 'New block', content: '' });
    onNavigateToBlock?.(section.id, subId, id);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#FFFFFF', fontFamily: FONT, position: 'relative', zIndex: 1 }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '26px 44px 120px' }}>

        {/* ── Breadcrumb ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 600 }}>
          <span onClick={() => navigate?.('/my-courses')} style={{ color: T.crumbMuted, cursor: 'pointer' }}>My courses</span>
          <ChevronLeft size={15} style={{ color: '#c7c7c7' }} />
          <span onClick={() => onBack?.()} style={{ color: T.crumbMuted, cursor: 'pointer' }}>Course Outline</span>
          <ChevronLeft size={15} style={{ color: '#c7c7c7' }} />
          <span style={{ color: T.crumbActive, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {courseName || formData?.courseName || 'Untitled course'}
          </span>
        </div>

        {sections.length === 0 ? (
          <EmptyState onAdd={() => actions.addSection()} />
        ) : (
          <>
            {/* ── Section switcher ── */}
            <div style={{ position: 'relative', marginTop: '22px' }}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 0',
                  color: T.sectionTag, fontFamily: FONT, fontWeight: 600, fontSize: '15px',
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                }}
              >
                {section?.type === 'break' ? 'Break' : `Section ${secNum}`}
                <ChevronDown size={15} style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
              </button>

              {menuOpen && (
                <>
                  <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                  <div style={{
                    position: 'absolute', top: '34px', left: 0, zIndex: 41,
                    minWidth: '280px', maxHeight: '340px', overflowY: 'auto',
                    background: '#FFFFFF', border: '1px solid #e6e6e6', borderRadius: '12px',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.12)', padding: '6px',
                  }}>
                    {sections.map((s, i) => (
                      <button
                        key={s.id}
                        onClick={() => { setActiveId(s.id); setMenuOpen(false); }}
                        style={{
                          display: 'flex', width: '100%', alignItems: 'center', gap: '10px',
                          padding: '9px 10px', border: 'none', borderRadius: '8px', cursor: 'pointer',
                          background: s.id === section?.id ? '#f2f5ff' : 'transparent',
                          color: '#262626', fontFamily: FONT, fontSize: '13.5px', textAlign: 'left',
                        }}
                      >
                        <span style={{
                          flexShrink: 0, width: '22px', height: '22px', borderRadius: '6px',
                          background: T.numBg, color: T.numFg, fontSize: '11px', fontWeight: 600,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>{i + 1}</span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.type === 'break' ? `Break — ${s.duration}` : (s.title || 'Untitled section')}
                        </span>
                      </button>
                    ))}
                    <div style={{ height: '1px', background: '#efefef', margin: '6px 4px' }} />
                    <button onClick={() => { actions.addSection(); setMenuOpen(false); }} style={menuActionStyle}>
                      <Plus size={14} /> Add section
                    </button>
                    {onAddBreak && (
                      <button onClick={() => { onAddBreak(); setMenuOpen(false); }} style={menuActionStyle}>
                        <Plus size={14} /> Add break
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* ── Section body ── */}
            {section?.type === 'break' ? (
              <div style={{
                marginTop: '14px', padding: '18px 20px', borderRadius: '12px',
                background: '#FFFDF0', border: '1px solid #efe6c8',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: '16px', fontWeight: 600, color: '#7a5c12' }}>⏸ Break — {section.duration}</span>
                <button onClick={() => actions.confirmDeleteSection(section.id)} style={iconBtn(T.iconDelBg, T.iconDelFg)} title="Delete break">
                  <Trash2 size={15} />
                </button>
              </div>
            ) : section ? (
              <>
                <div style={{ marginTop: '10px' }}>
                  <EditableField
                    value={section.title}
                    onChange={(v) => actions.updateSectionTitle(section.id, v)}
                    placeholder="Section title"
                    accentColor={T.primary}
                    maxLength={120}
                    style={{ flex: 1 }}
                    inputStyle={{ fontFamily: FONT, fontWeight: 600, fontSize: '25px', color: T.heading }}
                  />
                </div>
                <div style={{ marginTop: '6px', maxWidth: '900px' }}>
                  <EditableField
                    value={section.description}
                    onChange={(v) => actions.updateSectionDescription(section.id, v)}
                    placeholder="Add a section description…"
                    accentColor={T.primary}
                    maxLength={600}
                    multiline
                    style={{ flex: 1 }}
                    inputStyle={{ fontFamily: FONT, fontWeight: 500, fontSize: '15px', lineHeight: '1.65', color: T.desc }}
                  />
                </div>

                {/* ── Subsection rows ── */}
                <Droppable droppableId={`subsections-${section.id}`} type="SUBSECTION">
                  {(dropProv) => (
                    <div ref={dropProv.innerRef} {...dropProv.droppableProps} style={{ marginTop: '24px' }}>
                      {(section.subsections || []).map((sub, subIdx) => {
                        const blocks = handsOnResources[sub.id] || [];
                        const pending = pendingSubsectionIds?.has(sub.id);
                        return (
                          <Draggable key={sub.id} draggableId={sub.id} index={subIdx}>
                            {(dragProv, dragSnap) => (
                              <div
                                ref={dragProv.innerRef}
                                {...dragProv.draggableProps}
                                onMouseEnter={() => setHoveredSub(sub.id)}
                                onMouseLeave={() => setHoveredSub(null)}
                                onClick={() => onNavigateToSubsection?.(section.id, sub.id)}
                                style={{
                                  ...dragProv.draggableProps.style,
                                  border: `1px solid ${T.rowBorder}`,
                                  borderRadius: '12px',
                                  background: '#FFFFFF',
                                  padding: '20px 22px',
                                  marginBottom: '20px',
                                  cursor: 'pointer',
                                  boxShadow: dragSnap.isDragging
                                    ? '0 8px 24px rgba(0,0,0,0.12)'
                                    : hoveredSub === sub.id ? '0 2px 12px rgba(0,0,0,0.07)' : 'none',
                                  transition: 'box-shadow .15s',
                                }}
                              >
                                {/* Row header */}
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                  <div
                                    {...dragProv.dragHandleProps}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ cursor: 'grab', display: 'flex', alignItems: 'center', paddingTop: '5px', opacity: hoveredSub === sub.id ? 1 : 0.25, transition: 'opacity .15s' }}
                                  >
                                    <GripVertical size={16} style={{ color: '#b6b6b6' }} />
                                  </div>
                                  <span style={{
                                    flexShrink: 0, width: '30px', height: '30px', borderRadius: '8px',
                                    background: T.numBg, color: T.numFg, fontSize: '13px', fontWeight: 600,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px',
                                  }}>{secNum}.{subIdx + 1}</span>
                                  <div style={{ flex: 1, minWidth: 0, paddingTop: '3px' }}>
                                    <div style={{
                                      fontFamily: FONT, fontWeight: 700, fontSize: '20px', lineHeight: 1.3,
                                      color: T.cardTitle, textTransform: 'capitalize',
                                    }}>
                                      {sub.title || 'Untitled subsection'}
                                    </div>
                                    {pending && (
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '6px',
                                        fontSize: '11px', padding: '2px 8px', borderRadius: '6px',
                                        background: 'rgba(56,161,105,0.10)', color: '#276749',
                                      }}>
                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38A169', animation: 'pulse 1.2s ease-in-out infinite' }} />
                                        Generating…
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0, marginTop: '2px' }}>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); onNavigateToSubsection?.(section.id, sub.id); }}
                                      style={iconBtn(T.iconEditBg, T.iconEditFg)}
                                      title="Open subsection to edit"
                                    >
                                      <Pencil size={16} />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); actions.confirmDeleteSubsection(section.id, sub.id); }}
                                      style={iconBtn(T.iconDelBg, T.iconDelFg)}
                                      title="Delete subsection"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </div>

                                {/* Block cards */}
                                <Droppable droppableId={`blocks-${sub.id}`} type="BLOCK" direction="horizontal">
                                  {(blockDrop, blockSnap) => (
                                    <div
                                      ref={blockDrop.innerRef}
                                      {...blockDrop.droppableProps}
                                      style={{
                                        display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'stretch',
                                        marginTop: '18px',
                                        background: blockSnap.isDraggingOver ? 'rgba(62,98,188,0.04)' : 'transparent',
                                        borderRadius: '10px', transition: 'background .15s',
                                      }}
                                    >
                                      {blocks.map((block, blockIdx) => {
                                        const tag = BLOCK_TAG[block.type] || BLOCK_TAG.content;
                                        const preview = (block.content || block.description || '').replace(/[#*_`>[\]]/g, '').trim();
                                        const dur = block.duration_minutes || block.duration;
                                        return (
                                          <Draggable key={block.id} draggableId={block.id} index={blockIdx}>
                                            {(bProv, bSnap) => (
                                              <div
                                                ref={bProv.innerRef}
                                                {...bProv.draggableProps}
                                                onClick={(e) => { e.stopPropagation(); onNavigateToBlock?.(section.id, sub.id, block.id); }}
                                                style={{
                                                  ...bProv.draggableProps.style,
                                                  width: '236px', display: 'flex', flexDirection: 'column',
                                                  border: `1px solid ${T.cardBorder}`, borderRadius: '12px',
                                                  background: '#FFFFFF', padding: '15px 16px', cursor: 'pointer',
                                                  boxShadow: bSnap.isDragging ? '0 10px 26px rgba(0,0,0,0.14)' : 'none',
                                                }}
                                              >
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                                                  <div style={{
                                                    flex: 1, minWidth: 0,
                                                    fontFamily: FONT, fontWeight: 700, fontSize: '16px', lineHeight: 1.3,
                                                    color: T.cardTitle, textTransform: 'capitalize',
                                                  }}>
                                                    {block.title || 'Untitled block'}
                                                  </div>
                                                  <button
                                                    {...bProv.dragHandleProps}
                                                    onClick={(e) => e.stopPropagation()}
                                                    style={{ background: 'none', border: 'none', cursor: 'grab', padding: '2px', color: '#c4c4c4', flexShrink: 0 }}
                                                    title="Drag to reorder"
                                                  >
                                                    <GripVertical size={13} />
                                                  </button>
                                                  <button
                                                    onClick={(e) => { e.stopPropagation(); onNavigateToBlock?.(section.id, sub.id, block.id); }}
                                                    style={iconBtn(T.iconEditBg, T.iconEditFg, 24)}
                                                    title="Open block to edit"
                                                  >
                                                    <Pencil size={13} />
                                                  </button>
                                                  <button
                                                    onClick={(e) => { e.stopPropagation(); actions.removeBlock(sub.id, block.id); }}
                                                    style={iconBtn(T.iconDelBg, T.iconDelFg, 24)}
                                                    title="Remove block"
                                                  >
                                                    <Trash2 size={13} />
                                                  </button>
                                                </div>

                                                <p style={{
                                                  margin: '10px 0 0', fontSize: '12px', fontWeight: 500, lineHeight: '1.5',
                                                  color: T.cardDesc, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
                                                  overflow: 'hidden',
                                                }}>
                                                  {preview || 'No description yet.'}
                                                </p>

                                                <div style={{ flex: 1, minHeight: '10px' }} />

                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '12px' }}>
                                                  <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '3px 9px', borderRadius: '6px', background: tag.bg, color: tag.fg }}>{tag.label}</span>
                                                  {dur ? (
                                                    <span style={{ fontSize: '10.5px', fontWeight: 500, padding: '3px 9px', borderRadius: '6px', background: '#efefef', color: '#828282' }}>
                                                      {typeof dur === 'number' ? `${dur} mins` : dur}
                                                    </span>
                                                  ) : null}
                                                </div>
                                              </div>
                                            )}
                                          </Draggable>
                                        );
                                      })}
                                      {blockDrop.placeholder}

                                      {pending && blocks.length === 0 ? (
                                        [0, 1, 2].map(i => (
                                          <div key={i} style={{
                                            width: '236px', height: '210px', borderRadius: '12px',
                                            background: `rgba(56,161,105,${0.06 + i * 0.02})`,
                                            animation: 'pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.15}s`,
                                          }} />
                                        ))
                                      ) : (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); addBlockToSub(sub.id); }}
                                          style={{
                                            width: '236px', minHeight: '210px', borderRadius: '12px',
                                            border: `1.5px dashed ${T.dashed}`, background: 'transparent', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          }}
                                        >
                                          <span style={addPill}><Plus size={15} /> Add Block</span>
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </Droppable>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {dropProv.placeholder}
                    </div>
                  )}
                </Droppable>

                {/* ── Add subsection (full-width dashed) ── */}
                <button
                  onClick={() => actions.addSubsection(section.id)}
                  style={{
                    width: '100%', padding: '30px', borderRadius: '12px',
                    border: `1.5px dashed ${T.dashed}`, background: 'transparent', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '4px',
                  }}
                >
                  <span style={addPill}><Plus size={15} /> Add Subsection</span>
                </button>
              </>
            ) : null}
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={actions.deleteConfirm !== null}
        onConfirm={actions.handleConfirmDelete}
        onCancel={() => actions.setDeleteConfirm(null)}
        title={actions.deleteConfirm?.title || ''}
        message={actions.deleteConfirm?.message || ''}
      />
    </div>
  );
};

export default CourseEditor;
