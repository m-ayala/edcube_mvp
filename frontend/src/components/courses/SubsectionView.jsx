// src/components/courses/SubsectionView.jsx
import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Droppable, Draggable } from '@hello-pangea/dnd';

const BLOCK_TYPE_STYLES = {
  content:   { bg: '#EAF0FF', border: '#BFD0FF', text: '#2A4A9A', badgeBg: '#6B8FE8', label: 'Content' },
  worksheet: { bg: '#FFF3E8', border: '#F5C98A', text: '#9A5C12', badgeBg: '#E8A55C', label: 'Worksheet' },
  activity:  { bg: '#EDFFF3', border: '#86EFAC', text: '#1E7C43', badgeBg: '#5CC97C', label: 'Activity' },
};

const BLOCK_W = 148;
const BLOCK_H = 148;
const BLOCK_GAP = 10;

const ROW_LABEL = { content: 'Content', worksheet: 'Worksheets', activity: 'Activities' };

const BlockRow = ({ blockType, blocks, subsectionId, sectionId, actions, onNavigateToBlock }) => {
  const containerRef = useRef(null);
  const [canLeft, setCanLeft]   = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);

  const s = BLOCK_TYPE_STYLES[blockType];
  const label = ROW_LABEL[blockType];
  const dndType = `BLOCK_${blockType.toUpperCase()}`;

  const refreshButtons = () => {
    const el = containerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 1);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  };

  useEffect(() => { refreshButtons(); }, [blocks.length]);

  const scrollBy = (dir) => {
    containerRef.current?.scrollBy({ left: dir * (BLOCK_W + BLOCK_GAP), behavior: 'smooth' });
  };

  const addBlock = () => {
    const newId = `block-${Date.now()}`;
    actions.addBlock(subsectionId, { id: newId, type: blockType, title: '', content: '' });
    onNavigateToBlock?.(sectionId, subsectionId, newId);
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      {/* Row header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            padding: '2px 9px', background: s.badgeBg, color: '#fff',
            borderRadius: '5px', fontSize: '11px', fontWeight: '700',
            textTransform: 'uppercase', letterSpacing: '0.05em',
            fontFamily: "'DM Sans', sans-serif",
          }}>{label}</span>
          {blocks.length > 0 && (
            <span style={{ fontSize: '12px', color: '#999', fontFamily: "'DM Sans', sans-serif" }}>
              {blocks.length}
            </span>
          )}
        </div>
        <button
          onClick={addBlock}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '5px 12px', borderRadius: '7px', cursor: 'pointer',
            background: s.bg, border: `1.5px solid ${s.border}`,
            color: s.text, fontSize: '12px', fontWeight: '600',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <Plus size={12} /> Add
        </button>
      </div>

      {/* Scroll row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          onClick={() => scrollBy(-1)}
          style={{
            width: '28px', height: '28px', borderRadius: '50%',
            border: '1px solid rgba(0,0,0,0.12)', background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: canLeft ? 'pointer' : 'default',
            opacity: canLeft ? 1 : 0.2,
            transition: 'opacity 0.15s',
            flexShrink: 0, fontSize: '17px', lineHeight: 1, color: '#444',
            pointerEvents: canLeft ? 'auto' : 'none',
          }}
        >‹</button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <Droppable
            droppableId={`block-row-${blockType}-${subsectionId}`}
            direction="horizontal"
            type={dndType}
            renderClone={(cProv, _cSnap, rubric) => {
              const block = blocks[rubric.source.index];
              return (
                <div
                  ref={cProv.innerRef}
                  {...cProv.draggableProps}
                  {...cProv.dragHandleProps}
                  style={{
                    ...cProv.draggableProps.style,
                    width: `${BLOCK_W}px`,
                    height: `${BLOCK_H}px`,
                    background: s.bg,
                    border: `1.5px solid ${s.border}`,
                    borderRadius: '12px',
                    padding: '12px',
                    cursor: 'grabbing',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    userSelect: 'none',
                    boxShadow: '0 14px 36px rgba(0,0,0,0.22)',
                    opacity: 0.93,
                    overflow: 'hidden',
                    rotate: '2deg',
                    scale: '1.04',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <span style={{
                      padding: '2px 7px', background: s.badgeBg, color: '#fff',
                      borderRadius: '5px', fontSize: '10px', fontWeight: '700',
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                      fontFamily: "'DM Sans', sans-serif",
                    }}>{s.label}</span>
                  </div>
                  <p style={{
                    margin: '6px 0 0', fontSize: '13px', fontWeight: '600',
                    color: s.text, lineHeight: '1.35', flex: 1,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                  }}>
                    {block?.title || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>Untitled</span>}
                  </p>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: s.text, opacity: 0.5, textAlign: 'right' }}>
                    Open →
                  </div>
                </div>
              );
            }}
          >
            {(provided, dropSnap) => {
              const setRef = (el) => { provided.innerRef(el); containerRef.current = el; };
              return (
                <div
                  ref={setRef}
                  {...provided.droppableProps}
                  onScroll={refreshButtons}
                  style={{
                    display: 'flex',
                    gap: `${BLOCK_GAP}px`,
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    padding: '6px 2px 8px',
                    background: dropSnap.isDraggingOver ? s.bg : 'transparent',
                    borderRadius: '12px',
                    transition: 'background 0.2s',
                    minHeight: `${BLOCK_H + 14}px`,
                    alignItems: 'flex-start',
                  }}
                >
                  {blocks.length === 0 && !dropSnap.isDraggingOver && (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: '100%', minHeight: `${BLOCK_H}px`,
                      border: `1.5px dashed ${s.border}`, borderRadius: '12px',
                      color: s.text, opacity: 0.45, fontSize: '13px', fontStyle: 'italic',
                      fontFamily: "'DM Sans', sans-serif",
                    }}>
                      No {label.toLowerCase()} yet
                    </div>
                  )}
                  {blocks.map((block, idx) => {
                    const isHov = hoveredId === block.id;
                    return (
                      <Draggable key={block.id} draggableId={block.id} index={idx}>
                        {(dProv, dSnap) => (
                          <div
                            ref={dProv.innerRef}
                            {...dProv.draggableProps}
                            {...dProv.dragHandleProps}
                            onMouseEnter={() => setHoveredId(block.id)}
                            onMouseLeave={() => setHoveredId(null)}
                            onClick={() => { if (!dSnap.isDragging) onNavigateToBlock?.(sectionId, subsectionId, block.id); }}
                            style={{
                              ...dProv.draggableProps.style,
                              width: `${BLOCK_W}px`,
                              height: `${BLOCK_H}px`,
                              flexShrink: 0,
                              background: dSnap.isDragging ? 'transparent' : s.bg,
                              border: `1.5px solid ${dSnap.isDragging ? 'rgba(0,0,0,0.08)' : s.border}`,
                              borderRadius: '12px',
                              padding: '12px',
                              cursor: 'grab',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              userSelect: 'none',
                              boxShadow: isHov && !dSnap.isDragging
                                ? '0 4px 16px rgba(0,0,0,0.12)'
                                : dSnap.isDragging
                                  ? 'none'
                                  : '0 1px 4px rgba(0,0,0,0.06)',
                              opacity: dSnap.isDragging ? 0 : 1,
                              overflow: 'hidden',
                              transition: dProv.draggableProps.style?.transition || 'box-shadow 0.15s, transform 0.15s',
                            }}
                          >
                            {/* Badge + delete */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                              <span style={{
                                padding: '2px 7px', background: s.badgeBg, color: '#fff',
                                borderRadius: '5px', fontSize: '10px', fontWeight: '700',
                                textTransform: 'uppercase', letterSpacing: '0.04em',
                                fontFamily: "'DM Sans', sans-serif",
                              }}>{s.label}</span>
                              <button
                                onMouseDown={e => e.stopPropagation()}
                                onClick={e => { e.stopPropagation(); actions.removeBlock(subsectionId, block.id); }}
                                style={{
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  color: s.text, padding: '2px',
                                  opacity: isHov && !dSnap.isDragging ? 0.7 : 0,
                                  transition: 'opacity 0.15s',
                                  display: 'flex', alignItems: 'center',
                                }}
                                title="Delete block"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                            {/* Title */}
                            <p style={{
                              margin: '6px 0 0', fontSize: '13px', fontWeight: '600',
                              color: s.text, lineHeight: '1.35', flex: 1,
                              overflow: 'hidden', display: '-webkit-box',
                              WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                            }}>
                              {block.title || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>Untitled</span>}
                            </p>
                            {/* Open arrow */}
                            <div style={{
                              fontSize: '11px', fontWeight: '600', color: s.text,
                              opacity: isHov && !dSnap.isDragging ? 1 : 0.35,
                              transition: 'opacity 0.15s', textAlign: 'right',
                            }}>Open →</div>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              );
            }}
          </Droppable>
        </div>

        <button
          onClick={() => scrollBy(1)}
          style={{
            width: '28px', height: '28px', borderRadius: '50%',
            border: '1px solid rgba(0,0,0,0.12)', background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: canRight ? 'pointer' : 'default',
            opacity: canRight ? 1 : 0.2,
            transition: 'opacity 0.15s',
            flexShrink: 0, fontSize: '17px', lineHeight: 1, color: '#444',
            pointerEvents: canRight ? 'auto' : 'none',
          }}
        >›</button>
      </div>
    </div>
  );
};

const SubsectionView = ({
  subsection,
  sectionId,
  sectionTitle,
  sectionNumber,
  subsectionNumber,
  handsOnResources,
  actions,
  onBack,
  onNavigateToBlock,
  trayBlocks,
  onAddBlockFromTray,
}) => {
  // Info card edit state
  const [editingTitle, setEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(subsection.title || '');
  const [editingDesc, setEditingDesc] = useState(false);
  const [localDesc, setLocalDesc] = useState(subsection.description || '');
  const [editingDuration, setEditingDuration] = useState(false);
  const [localDuration, setLocalDuration] = useState(subsection.duration_minutes ?? 20);
  const [editingObjectives, setEditingObjectives] = useState(false);
  const [localObjectives, setLocalObjectives] = useState(subsection.learning_objectives || []);
  const [newObjective, setNewObjective] = useState('');
  // Sync local state from props when parent state changes (e.g. after undo)
  useEffect(() => { if (!editingTitle) setLocalTitle(subsection.title || ''); }, [subsection.title, editingTitle]);
  useEffect(() => { if (!editingDesc) setLocalDesc(subsection.description || ''); }, [subsection.description, editingDesc]);
  useEffect(() => { if (!editingDuration) setLocalDuration(subsection.duration_minutes ?? 20); }, [subsection.duration_minutes, editingDuration]);
  useEffect(() => { if (!editingObjectives) setLocalObjectives(subsection.learning_objectives || []); }, [subsection.learning_objectives, editingObjectives]);

  const blocks = handsOnResources?.[subsection.id] || [];
  const contentBlocks   = blocks.filter(b => b.type === 'content');
  const worksheetBlocks = blocks.filter(b => b.type === 'worksheet');
  const activityBlocks  = blocks.filter(b => b.type === 'activity');

  // ── Field save helpers ────────────────────────────────────────────────
  const handleTitleBlur = () => {
    setEditingTitle(false);
    const trimmed = localTitle.trim() || 'Untitled Subsection';
    if (trimmed !== (subsection.title || '')) {
      actions.updateSubsectionTitle(sectionId, subsection.id, trimmed);
    }
  };

  const handleDescBlur = () => {
    setEditingDesc(false);
    if (localDesc !== (subsection.description || '')) {
      actions.updateSubsectionDescription(sectionId, subsection.id, localDesc);
    }
  };

  const handleDurationBlur = () => {
    setEditingDuration(false);
    const val = parseInt(localDuration) || 0;
    if (val !== (subsection.duration_minutes ?? 20)) {
      actions.updateSubsectionFull(sectionId, subsection.id, { duration_minutes: val });
    }
  };

  const saveObjectives = (objectives) => {
    setLocalObjectives(objectives);
    actions.updateSubsectionFull(sectionId, subsection.id, { learning_objectives: objectives });
  };

  const handleAddObjective = () => {
    const trimmed = newObjective.trim();
    if (!trimmed) return;
    saveObjectives([...localObjectives, trimmed]);
    setNewObjective('');
  };

  const handleRemoveObjective = (idx) => {
    saveObjectives(localObjectives.filter((_, i) => i !== idx));
  };

  const handleUpdateObjective = (idx, value) => {
    const updated = [...localObjectives];
    updated[idx] = value;
    setLocalObjectives(updated);
  };

  const handleObjectiveBlur = () => {
    actions.updateSubsectionFull(sectionId, subsection.id, { learning_objectives: localObjectives });
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 48px 80px', position: 'relative', zIndex: 1 }}>
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={onBack}
          style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: '13.8px', fontWeight: '500',
            padding: '8px 20px', borderRadius: '8px', cursor: 'pointer',
            background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.12)',
            color: '#111', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          ←
        </button>
        {sectionTitle && (
          <span style={{ color: '#555', fontSize: '13px', fontWeight: '500' }}>
            {sectionTitle} <span style={{ color: '#BBB' }}>›</span> <strong style={{ color: '#333', fontWeight: '600' }}>{subsection.title || 'Untitled Subsection'}</strong>
          </span>
        )}
      </div>

      {/* ── Edo block tray ── */}
      {(trayBlocks || []).length > 0 && (
        <div style={{
          marginBottom: '16px', padding: '12px 16px',
          background: 'rgba(247,228,160,0.15)', border: '1px solid rgba(180,150,30,0.2)',
          borderRadius: '10px',
        }}>
          <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: '700', color: '#5C460A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Edo Tray — Block Drafts
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {trayBlocks.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: '#FFF', borderRadius: '7px', padding: '8px 12px', border: '1px solid rgba(0,0,0,0.08)' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#111' }}>{item.data?.title || 'Untitled Block'}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#888' }}>{item.data?.type} · {item.data?.subcategory || item.data?.category || ''}</p>
                </div>
                <button
                  onClick={() => onAddBlockFromTray?.(item)}
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12.5px', fontWeight: '600', padding: '5px 12px', borderRadius: '7px', cursor: 'pointer', background: '#111', color: '#FFF', border: 'none', whiteSpace: 'nowrap' }}
                >
                  + Add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Subsection info card ── */}
      <div style={{
        background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '12px',
        padding: '20px 24px', marginBottom: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Subsection {sectionNumber}.{subsectionNumber}
        </p>

        {/* Title */}
        {editingTitle ? (
          <input
            autoFocus
            value={localTitle}
            onChange={e => setLocalTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setLocalTitle(subsection.title || ''); setEditingTitle(false); } }}
            maxLength={80}
            style={{
              fontSize: '22px', fontWeight: '700', color: '#111', fontFamily: "'DM Sans', sans-serif",
              border: '2px solid #111', borderRadius: '6px', padding: '4px 8px',
              width: '100%', outline: 'none', marginBottom: '12px', background: '#FAFAFA',
            }}
          />
        ) : (
          <h2
            onClick={() => setEditingTitle(true)}
            title="Click to edit title"
            style={{
              margin: '0 0 12px', fontSize: '22px', fontWeight: '700', color: '#111',
              fontFamily: "'DM Sans', sans-serif", lineHeight: '1.3', cursor: 'text',
              borderRadius: '4px', padding: '2px 4px', marginLeft: '-4px',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#F5F3EE'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {localTitle || 'Untitled Subsection'}
          </h2>
        )}

        {/* Description */}
        {editingDesc ? (
          <textarea
            autoFocus
            value={localDesc}
            onChange={e => setLocalDesc(e.target.value)}
            onBlur={handleDescBlur}
            onKeyDown={e => { if (e.key === 'Escape') { setLocalDesc(subsection.description || ''); setEditingDesc(false); } }}
            maxLength={400}
            rows={3}
            style={{
              fontSize: '14.5px', color: '#555', lineHeight: '1.55',
              border: '2px solid #111', borderRadius: '6px',
              padding: '6px 8px', width: '100%', outline: 'none',
              resize: 'vertical', fontFamily: "'DM Sans', sans-serif",
              background: '#FAFAFA', marginBottom: '16px',
            }}
          />
        ) : (
          <p
            onClick={() => setEditingDesc(true)}
            title="Click to edit description"
            style={{
              margin: '0 0 16px', fontSize: '14.5px', color: localDesc ? '#555' : '#AAA',
              lineHeight: '1.55', cursor: 'text', borderRadius: '4px',
              padding: '2px 4px', marginLeft: '-4px',
              fontStyle: localDesc ? 'normal' : 'italic',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#F5F3EE'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {localDesc || 'Add a description…'}
          </p>
        )}

        {/* Duration + Objectives row */}
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* Duration */}
          <div style={{ minWidth: '120px' }}>
            <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Duration
            </p>
            {editingDuration ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  autoFocus
                  type="number"
                  value={localDuration}
                  onChange={e => setLocalDuration(e.target.value)}
                  onBlur={handleDurationBlur}
                  onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  min="0"
                  style={{
                    width: '64px', padding: '5px 8px', border: '2px solid #111',
                    borderRadius: '6px', fontSize: '14px', outline: 'none',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                />
                <span style={{ fontSize: '14px', color: '#555' }}>min</span>
              </div>
            ) : (
              <div
                onClick={() => setEditingDuration(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  padding: '4px 10px', background: '#F5F3EE', borderRadius: '6px',
                  fontSize: '14px', color: '#333', cursor: 'text', fontWeight: '500',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#EDE9E0'}
                onMouseLeave={e => e.currentTarget.style.background = '#F5F3EE'}
              >
                ⏱ {localDuration ?? 20} min
              </div>
            )}
          </div>

          {/* Learning Objectives */}
          <div style={{ flex: 1, minWidth: '220px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Learning Objectives
              </p>
              <button
                onClick={() => setEditingObjectives(p => !p)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '11px', fontWeight: '600', color: editingObjectives ? '#111' : '#999',
                  fontFamily: "'DM Sans', sans-serif", padding: '2px 6px',
                }}
              >
                {editingObjectives ? 'Done' : 'Edit'}
              </button>
            </div>

            {localObjectives.length === 0 && !editingObjectives && (
              <p style={{ margin: 0, fontSize: '13.5px', color: '#AAA', fontStyle: 'italic' }}>
                No objectives yet
              </p>
            )}

            {localObjectives.length > 0 && (
              <ul style={{ margin: '0 0 8px', padding: 0, listStyle: 'none' }}>
                {localObjectives.map((obj, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ color: '#CCC', fontSize: '14px', lineHeight: '1.55', flexShrink: 0, marginTop: '1px' }}>•</span>
                    {editingObjectives ? (
                      <input
                        value={obj}
                        onChange={e => handleUpdateObjective(i, e.target.value)}
                        onBlur={handleObjectiveBlur}
                        style={{
                          flex: 1, fontSize: '13.5px', color: '#333', padding: '3px 8px',
                          border: '1px solid rgba(0,0,0,0.12)', borderRadius: '5px',
                          outline: 'none', fontFamily: "'DM Sans', sans-serif",
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: '13.5px', color: '#333', lineHeight: '1.55', flex: 1 }}>{obj}</span>
                    )}
                    {editingObjectives && (
                      <button
                        onClick={() => handleRemoveObjective(i)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F87171', padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {editingObjectives && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  value={newObjective}
                  onChange={e => setNewObjective(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddObjective(); }}
                  placeholder="Add objective…"
                  style={{
                    flex: 1, fontSize: '13.5px', color: '#111', padding: '5px 9px',
                    border: '1px solid rgba(0,0,0,0.15)', borderRadius: '6px',
                    outline: 'none', fontFamily: "'DM Sans', sans-serif",
                  }}
                />
                <button
                  onClick={handleAddObjective}
                  style={{
                    padding: '5px 12px', background: '#111', color: '#FFF',
                    border: 'none', borderRadius: '6px', cursor: 'pointer',
                    fontSize: '13px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Add
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Blocks section ── */}
      <div>
        <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: '700', color: '#111', fontFamily: "'DM Sans', sans-serif" }}>
          Blocks
          {blocks.length > 0 && (
            <span style={{ marginLeft: '8px', fontSize: '13px', fontWeight: '500', color: '#999' }}>
              {blocks.length}
            </span>
          )}
        </h3>
        <BlockRow
          blockType="content"
          blocks={contentBlocks}
          subsectionId={subsection.id}
          sectionId={sectionId}
          actions={actions}
          onNavigateToBlock={onNavigateToBlock}
        />
        <BlockRow
          blockType="worksheet"
          blocks={worksheetBlocks}
          subsectionId={subsection.id}
          sectionId={sectionId}
          actions={actions}
          onNavigateToBlock={onNavigateToBlock}
        />
        <BlockRow
          blockType="activity"
          blocks={activityBlocks}
          subsectionId={subsection.id}
          sectionId={sectionId}
          actions={actions}
          onNavigateToBlock={onNavigateToBlock}
        />
      </div>
      </div>
    </div>
  );
};

export default SubsectionView;
