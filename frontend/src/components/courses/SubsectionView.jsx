// src/components/courses/SubsectionView.jsx
import { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Droppable, Draggable } from '@hello-pangea/dnd';

const TYPE_STYLES = {
  content:   { bg: '#EAF0FF', border: '#BFD0FF', text: '#2A4A9A', badgeBg: '#6B8FE8', accentBorder: '#6B8FE8', label: 'Content' },
  worksheet: { bg: '#FFF3E8', border: '#F5C98A', text: '#9A5C12', badgeBg: '#E8A55C', accentBorder: '#E8A55C', label: 'Worksheet' },
  activity:  { bg: '#EDFFF3', border: '#86EFAC', text: '#1E7C43', badgeBg: '#5CC97C', accentBorder: '#5CC97C', label: 'Activity' },
};

const TypeBadge = ({ type }) => {
  const s = TYPE_STYLES[type] || TYPE_STYLES.content;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px',
      background: s.badgeBg, color: '#fff',
      borderRadius: '5px', fontSize: '10px', fontWeight: '700',
      textTransform: 'uppercase', letterSpacing: '.05em',
      fontFamily: "'DM Sans', sans-serif",
    }}>{s.label}</span>
  );
};

// ── Linked block card (worksheet / activity on the right column) ──────────────
const LinkedCard = ({ block, subsectionId, sectionId, actions, onNavigateToBlock, provided, snapshot }) => {
  const s = TYPE_STYLES[block.type] || TYPE_STYLES.content;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (!snapshot.isDragging) onNavigateToBlock?.(sectionId, subsectionId, block.id); }}
      style={{
        ...provided.draggableProps.style,
        background: snapshot.isDragging ? 'transparent' : s.bg,
        border: `1.5px solid ${snapshot.isDragging ? 'rgba(0,0,0,0.08)' : s.border}`,
        borderRadius: '10px',
        padding: '11px 14px',
        cursor: 'grab',
        userSelect: 'none',
        opacity: snapshot.isDragging ? 0 : 1,
        boxShadow: hovered && !snapshot.isDragging ? '0 3px 12px rgba(0,0,0,0.10)' : '0 1px 3px rgba(0,0,0,0.05)',
        transition: provided.draggableProps.style?.transition || 'box-shadow .15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div {...provided.dragHandleProps} style={{ color: '#CCC', cursor: 'grab', display: 'flex', alignItems: 'center' }}>
            <GripVertical size={12} />
          </div>
          <TypeBadge type={block.type} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: '#AAA' }}>{block.duration_minutes ?? 15} min</span>
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); actions.removeBlock(subsectionId, block.id); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#F87171', padding: '2px', display: 'flex', alignItems: 'center',
              opacity: hovered ? 0.8 : 0, transition: 'opacity .15s',
            }}
            title="Delete"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
      <p style={{
        margin: 0, fontSize: '13px', fontWeight: '600', color: s.text,
        lineHeight: '1.35',
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {block.title || <span style={{ fontStyle: 'italic', opacity: .5 }}>Untitled</span>}
      </p>
      {hovered && !snapshot.isDragging && (
        <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: '600', color: s.text, opacity: .5, textAlign: 'right' }}>
          Open →
        </div>
      )}
    </div>
  );
};

// ── Add slot ghost button ─────────────────────────────────────────────────────
const AddSlot = ({ type, onClick }) => {
  const s = TYPE_STYLES[type] || TYPE_STYLES.content;
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', padding: '8px 12px',
        border: `1.5px dashed ${s.border}`,
        borderRadius: '9px', cursor: 'pointer',
        background: hov ? s.bg : 'transparent',
        color: s.text, fontSize: '12px', fontWeight: '600',
        display: 'flex', alignItems: 'center', gap: '5px',
        fontFamily: "'DM Sans', sans-serif",
        transition: 'background .15s',
      }}
    >
      <Plus size={12} /> Add {s.label}
    </button>
  );
};

// ── Content block card (left column) ─────────────────────────────────────────
const ContentCard = ({ block, index, subsectionId, sectionId, actions, onNavigateToBlock, provided, snapshot }) => {
  const s = TYPE_STYLES.content;
  const [hov, setHov] = useState(false);

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        ...provided.draggableProps.style,
        background: snapshot.isDragging ? 'transparent' : '#fff',
        border: `1.5px solid ${snapshot.isDragging ? 'rgba(0,0,0,0.08)' : s.border}`,
        borderLeft: snapshot.isDragging ? `1.5px solid rgba(0,0,0,0.08)` : `4px solid ${s.accentBorder}`,
        borderRadius: '12px',
        padding: '14px 16px',
        cursor: 'pointer',
        userSelect: 'none',
        opacity: snapshot.isDragging ? 0 : 1,
        boxShadow: hov && !snapshot.isDragging
          ? '0 4px 16px rgba(42,74,154,0.12)'
          : '0 1px 4px rgba(0,0,0,0.05)',
        transition: provided.draggableProps.style?.transition || 'box-shadow .15s',
      }}
      onClick={() => { if (!snapshot.isDragging) onNavigateToBlock?.(sectionId, subsectionId, block.id); }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div {...provided.dragHandleProps}
            style={{ color: '#C5CFEC', cursor: 'grab', display: 'flex', alignItems: 'center' }}
            onClick={e => e.stopPropagation()}
          >
            <GripVertical size={14} />
          </div>
          <TypeBadge type="content" />
          <span style={{ fontSize: '11px', fontWeight: '700', color: '#D0D8F0', fontFamily: "'DM Sans', sans-serif" }}>
            {index + 1}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {block.subcategory && (
            <span style={{
              display: 'inline-block', padding: '2px 8px',
              background: '#EAF0FF', border: '1px solid #BFD0FF',
              borderRadius: '20px', fontSize: '11px', fontWeight: '600',
              color: '#2A4A9A', fontFamily: "'DM Sans', sans-serif",
            }}>{block.subcategory}</span>
          )}
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); actions.removeBlock(subsectionId, block.id); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#F87171', padding: '2px', display: 'flex', alignItems: 'center',
              opacity: hov ? 0.8 : 0, transition: 'opacity .15s',
            }}
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <h3 style={{
        margin: '0 0 10px', fontSize: '15px', fontWeight: '700',
        color: '#111', lineHeight: '1.35', fontFamily: "'DM Sans', sans-serif",
      }}>
        {block.title || <span style={{ color: '#AAA', fontStyle: 'italic', fontWeight: '400' }}>Untitled Block</span>}
      </h3>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '2px 9px', background: '#F1F5F9', border: '1px solid #E2E8F0',
          borderRadius: '20px', fontSize: '11.5px', fontWeight: '600', color: '#555',
        }}>⏱ {block.duration_minutes ?? 15} min</span>
        <span style={{ fontSize: '11px', fontWeight: '600', color: s.text, opacity: hov ? .6 : .3, transition: 'opacity .15s' }}>
          Open →
        </span>
      </div>
    </div>
  );
};

// ── Prerequisite divider ──────────────────────────────────────────────────────
const PrereqDivider = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0 8px 20px' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
      <div style={{ width: '1.5px', height: '10px', background: '#E5E7EB' }} />
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#D1D5DB' }} />
      <div style={{ width: '1.5px', height: '10px', background: '#E5E7EB' }} />
    </div>
    <span style={{
      fontSize: '10.5px', fontWeight: '700', color: '#C5CAD3',
      letterSpacing: '.05em', textTransform: 'uppercase',
      fontFamily: "'DM Sans', sans-serif",
    }}>taught before</span>
  </div>
);

// ── Two-column block group grid ───────────────────────────────────────────────
const BlockGroupGrid = ({ contentBlocks, allBlocks, subsectionId, sectionId, actions, onNavigateToBlock }) => {
  const addLinkedBlock = (type, parentContentBlockId) => {
    const newId = `block-${Date.now()}`;
    actions.addBlock(subsectionId, { id: newId, type, title: '', content: '', parentContentBlockId });
    onNavigateToBlock?.(sectionId, subsectionId, newId);
  };

  const addContentBlock = () => {
    const newId = `block-${Date.now()}`;
    actions.addBlock(subsectionId, { id: newId, type: 'content', title: '', content: '' });
    onNavigateToBlock?.(sectionId, subsectionId, newId);
  };

  // Unlinked worksheet/activity blocks (no parentContentBlockId or parent deleted)
  const contentIds = new Set(contentBlocks.map(b => b.id));
  const unlinkedBlocks = allBlocks.filter(b =>
    b.type !== 'content' &&
    (!b.parentContentBlockId || !contentIds.has(b.parentContentBlockId))
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#111', fontFamily: "'DM Sans', sans-serif" }}>
            Blocks
          </span>
          {allBlocks.length > 0 && (
            <span style={{ marginLeft: '8px', fontSize: '13px', fontWeight: '500', color: '#AAA' }}>
              {allBlocks.length}
            </span>
          )}
        </div>
        <button
          onClick={addContentBlock}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '6px 14px', borderRadius: '8px', cursor: 'pointer',
            background: '#EAF0FF', border: '1.5px solid #BFD0FF',
            color: '#2A4A9A', fontSize: '12.5px', fontWeight: '600',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <Plus size={13} /> Add Content Block
        </button>
      </div>

      {/* Content block groups */}
      <Droppable droppableId={`content-col-${subsectionId}`} type={`CONTENT_COL_${subsectionId}`}>
        {(colProvided) => (
          <div ref={colProvided.innerRef} {...colProvided.droppableProps}>
            {contentBlocks.length === 0 && (
              <div style={{
                padding: '32px', textAlign: 'center',
                border: '1.5px dashed #BFD0FF', borderRadius: '12px',
                color: '#7B9FE8', fontSize: '13.5px', fontStyle: 'italic',
                fontFamily: "'DM Sans', sans-serif",
              }}>
                No content blocks yet — click "Add Content Block" to start
              </div>
            )}

            {contentBlocks.map((contentBlock, idx) => {
              const linkedBlocks = allBlocks.filter(
                b => b.type !== 'content' && b.parentContentBlockId === contentBlock.id
              );

              return (
                <div key={contentBlock.id}>
                  {idx > 0 && <PrereqDivider />}

                  {/* Row: content card (left) + linked column (right) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '14px', alignItems: 'start' }}>

                    {/* Left: Content block card */}
                    <Draggable draggableId={contentBlock.id} index={idx}>
                      {(provided, snapshot) => (
                        <ContentCard
                          block={contentBlock}
                          index={idx}
                          subsectionId={subsectionId}
                          sectionId={sectionId}
                          actions={actions}
                          onNavigateToBlock={onNavigateToBlock}
                          provided={provided}
                          snapshot={snapshot}
                        />
                      )}
                    </Draggable>

                    {/* Right: linked worksheet/activity + add slots */}
                    <Droppable
                      droppableId={`linked-col-${contentBlock.id}`}
                      type={`LINKED_${subsectionId}`}
                    >
                      {(linkProvided, linkSnap) => (
                        <div
                          ref={linkProvided.innerRef}
                          {...linkProvided.droppableProps}
                          style={{
                            display: 'flex', flexDirection: 'column', gap: '8px',
                            minHeight: '52px',
                            position: 'relative',
                            background: linkSnap.isDraggingOver ? 'rgba(241,245,249,0.6)' : 'transparent',
                            borderRadius: '10px',
                            transition: 'background .2s',
                          }}
                        >
                          {/* Connector line from content card */}
                          <div style={{
                            position: 'absolute',
                            top: '20px', left: '-14px',
                            width: '14px', height: '1.5px',
                            background: '#D1D5DB',
                            pointerEvents: 'none',
                          }} />

                          {linkedBlocks.map((lb, lbIdx) => (
                            <Draggable key={lb.id} draggableId={lb.id} index={lbIdx}>
                              {(lbProv, lbSnap) => (
                                <LinkedCard
                                  block={lb}
                                  subsectionId={subsectionId}
                                  sectionId={sectionId}
                                  actions={actions}
                                  onNavigateToBlock={onNavigateToBlock}
                                  provided={lbProv}
                                  snapshot={lbSnap}
                                />
                              )}
                            </Draggable>
                          ))}
                          {linkProvided.placeholder}

                          {/* Add worksheet slot if none linked */}
                          {!linkedBlocks.some(b => b.type === 'worksheet') && (
                            <AddSlot type="worksheet" onClick={() => addLinkedBlock('worksheet', contentBlock.id)} />
                          )}
                          {/* Add activity slot if none linked */}
                          {!linkedBlocks.some(b => b.type === 'activity') && (
                            <AddSlot type="activity" onClick={() => addLinkedBlock('activity', contentBlock.id)} />
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>
                </div>
              );
            })}
            {colProvided.placeholder}
          </div>
        )}
      </Droppable>

      {/* Unlinked blocks section — draggable into content block rows */}
      {unlinkedBlocks.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <p style={{
              margin: 0,
              fontSize: '11px', fontWeight: '700', color: '#BBB',
              textTransform: 'uppercase', letterSpacing: '.06em',
              fontFamily: "'DM Sans', sans-serif",
            }}>
              Unlinked Blocks
            </p>
            <span style={{ fontSize: '11px', color: '#CCC', fontStyle: 'italic', fontFamily: "'DM Sans', sans-serif" }}>
              — drag into a content row to link
            </span>
          </div>
          <Droppable droppableId="linked-col-unlinked" type={`LINKED_${subsectionId}`}>
            {(uprov, usnap) => (
              <div
                ref={uprov.innerRef}
                {...uprov.droppableProps}
                style={{
                  display: 'flex', flexDirection: 'column', gap: '8px',
                  minHeight: '52px', padding: '8px',
                  border: `1.5px dashed ${usnap.isDraggingOver ? '#6B8FE8' : '#E5E7EB'}`,
                  borderRadius: '10px',
                  background: usnap.isDraggingOver ? 'rgba(107,143,232,0.05)' : 'transparent',
                  transition: 'border-color .2s, background .2s',
                }}
              >
                {unlinkedBlocks.map((block, idx) => (
                  <Draggable key={block.id} draggableId={block.id} index={idx}>
                    {(prov, snap) => (
                      <LinkedCard
                        block={block}
                        subsectionId={subsectionId}
                        sectionId={sectionId}
                        actions={actions}
                        onNavigateToBlock={onNavigateToBlock}
                        provided={prov}
                        snapshot={snap}
                      />
                    )}
                  </Draggable>
                ))}
                {uprov.placeholder}
                {usnap.isDraggingOver && (
                  <div style={{
                    padding: '8px', textAlign: 'center',
                    fontSize: '11.5px', fontWeight: '600', color: '#6B8FE8',
                    fontFamily: "'DM Sans', sans-serif",
                  }}>
                    Drop here to unlink
                  </div>
                )}
              </div>
            )}
          </Droppable>
        </div>
      )}
    </div>
  );
};

// ── Main SubsectionView ───────────────────────────────────────────────────────
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
  const [editingTitle, setEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(subsection.title || '');
  const [editingDesc, setEditingDesc] = useState(false);
  const [localDesc, setLocalDesc] = useState(subsection.description || '');
  const [editingDuration, setEditingDuration] = useState(false);
  const [localDuration, setLocalDuration] = useState(subsection.duration_minutes ?? 60);
  const [editingObjectives, setEditingObjectives] = useState(false);
  const [localObjectives, setLocalObjectives] = useState(subsection.learning_objectives || []);
  const [newObjective, setNewObjective] = useState('');

  useEffect(() => { if (!editingTitle) setLocalTitle(subsection.title || ''); }, [subsection.title, editingTitle]);
  useEffect(() => { if (!editingDesc) setLocalDesc(subsection.description || ''); }, [subsection.description, editingDesc]);
  useEffect(() => { if (!editingDuration) setLocalDuration(subsection.duration_minutes ?? 60); }, [subsection.duration_minutes, editingDuration]);
  useEffect(() => { if (!editingObjectives) setLocalObjectives(subsection.learning_objectives || []); }, [subsection.learning_objectives, editingObjectives]);

  const allBlocks = handsOnResources?.[subsection.id] || [];
  const contentBlocks = allBlocks.filter(b => b.type === 'content');

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
    if (val !== (subsection.duration_minutes ?? 60)) {
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

  const handleRemoveObjective = (idx) => saveObjectives(localObjectives.filter((_, i) => i !== idx));

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

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <button
            onClick={onBack}
            style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: '13.8px', fontWeight: '500',
              padding: '8px 20px', borderRadius: '8px', cursor: 'pointer',
              background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.12)', color: '#111',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >←</button>
          {sectionTitle && (
            <span style={{ color: '#555', fontSize: '13px', fontWeight: '500', fontFamily: "'DM Sans', sans-serif" }}>
              {sectionTitle} <span style={{ color: '#BBB' }}>›</span>{' '}
              <strong style={{ color: '#333', fontWeight: '600' }}>{subsection.title || 'Untitled Subsection'}</strong>
            </span>
          )}
        </div>

        {/* Edo tray */}
        {(trayBlocks || []).length > 0 && (
          <div style={{
            marginBottom: '16px', padding: '12px 16px',
            background: 'rgba(247,228,160,0.15)', border: '1px solid rgba(180,150,30,0.2)',
            borderRadius: '10px',
          }}>
            <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: '700', color: '#5C460A', textTransform: 'uppercase', letterSpacing: '.05em' }}>
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
                  >+ Add</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subsection info card */}
        <div style={{
          background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '12px',
          padding: '20px 24px', marginBottom: '28px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        }}>
          <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: "'DM Sans', sans-serif" }}>
            Subsection {sectionNumber}.{subsectionNumber}
          </p>

          {/* Title */}
          {editingTitle ? (
            <input
              autoFocus value={localTitle}
              onChange={e => setLocalTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setLocalTitle(subsection.title || ''); setEditingTitle(false); } }}
              maxLength={80}
              style={{ fontSize: '22px', fontWeight: '700', color: '#111', fontFamily: "'DM Sans', sans-serif", border: '2px solid #111', borderRadius: '6px', padding: '4px 8px', width: '100%', outline: 'none', marginBottom: '12px', background: '#FAFAFA' }}
            />
          ) : (
            <h2
              onClick={() => setEditingTitle(true)}
              style={{ margin: '0 0 12px', fontSize: '22px', fontWeight: '700', color: '#111', fontFamily: "'DM Sans', sans-serif", lineHeight: '1.3', cursor: 'text', borderRadius: '4px', padding: '2px 4px', marginLeft: '-4px' }}
              onMouseEnter={e => e.currentTarget.style.background = '#F5F3EE'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {localTitle || 'Untitled Subsection'}
            </h2>
          )}

          {/* Description */}
          {editingDesc ? (
            <textarea
              autoFocus value={localDesc}
              onChange={e => setLocalDesc(e.target.value)}
              onBlur={handleDescBlur}
              onKeyDown={e => { if (e.key === 'Escape') { setLocalDesc(subsection.description || ''); setEditingDesc(false); } }}
              maxLength={400} rows={3}
              style={{ fontSize: '14.5px', color: '#555', lineHeight: '1.55', border: '2px solid #111', borderRadius: '6px', padding: '6px 8px', width: '100%', outline: 'none', resize: 'vertical', fontFamily: "'DM Sans', sans-serif", background: '#FAFAFA', marginBottom: '16px' }}
            />
          ) : (
            <p
              onClick={() => setEditingDesc(true)}
              style={{ margin: '0 0 16px', fontSize: '14.5px', color: localDesc ? '#555' : '#AAA', lineHeight: '1.55', cursor: 'text', borderRadius: '4px', padding: '2px 4px', marginLeft: '-4px', fontStyle: localDesc ? 'normal' : 'italic' }}
              onMouseEnter={e => e.currentTarget.style.background = '#F5F3EE'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {localDesc || 'Add a description…'}
            </p>
          )}

          {/* Duration + Objectives */}
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ minWidth: '120px' }}>
              <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: "'DM Sans', sans-serif" }}>Duration</p>
              {editingDuration ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    autoFocus type="number" value={localDuration}
                    onChange={e => setLocalDuration(e.target.value)}
                    onBlur={handleDurationBlur}
                    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    min="0"
                    style={{ width: '64px', padding: '5px 8px', border: '2px solid #111', borderRadius: '6px', fontSize: '14px', outline: 'none', fontFamily: "'DM Sans', sans-serif" }}
                  />
                  <span style={{ fontSize: '14px', color: '#555' }}>min</span>
                </div>
              ) : (
                <div
                  onClick={() => setEditingDuration(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: '#F5F3EE', borderRadius: '6px', fontSize: '14px', color: '#333', cursor: 'text', fontWeight: '500' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#EDE9E0'}
                  onMouseLeave={e => e.currentTarget.style.background = '#F5F3EE'}
                >
                  ⏱ {localDuration ?? 60} min
                </div>
              )}
            </div>

            <div style={{ flex: 1, minWidth: '220px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: "'DM Sans', sans-serif" }}>Learning Objectives</p>
                <button
                  onClick={() => setEditingObjectives(p => !p)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '600', color: editingObjectives ? '#111' : '#999', fontFamily: "'DM Sans', sans-serif", padding: '2px 6px' }}
                >
                  {editingObjectives ? 'Done' : 'Edit'}
                </button>
              </div>

              {localObjectives.length === 0 && !editingObjectives && (
                <p style={{ margin: 0, fontSize: '13.5px', color: '#AAA', fontStyle: 'italic' }}>No objectives yet</p>
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
                          style={{ flex: 1, fontSize: '13.5px', color: '#333', padding: '3px 8px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: '5px', outline: 'none', fontFamily: "'DM Sans', sans-serif" }}
                        />
                      ) : (
                        <span style={{ fontSize: '13.5px', color: '#333', lineHeight: '1.55', flex: 1 }}>{obj}</span>
                      )}
                      {editingObjectives && (
                        <button onClick={() => handleRemoveObjective(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F87171', padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
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
                    style={{ flex: 1, fontSize: '13.5px', color: '#111', padding: '5px 9px', border: '1px solid rgba(0,0,0,0.15)', borderRadius: '6px', outline: 'none', fontFamily: "'DM Sans', sans-serif" }}
                  />
                  <button
                    onClick={handleAddObjective}
                    style={{ padding: '5px 12px', background: '#111', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif" }}
                  >Add</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Block group grid */}
        <BlockGroupGrid
          contentBlocks={contentBlocks}
          allBlocks={allBlocks}
          subsectionId={subsection.id}
          sectionId={sectionId}
          actions={actions}
          onNavigateToBlock={onNavigateToBlock}
        />

      </div>
    </div>
  );
};

export default SubsectionView;
