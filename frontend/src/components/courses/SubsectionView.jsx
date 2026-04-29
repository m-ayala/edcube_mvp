// src/components/courses/SubsectionView.jsx
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

const BLOCK_TYPE_STYLES = {
  content:   { bg: '#EAF0FF', border: '#BFD0FF', text: '#2A4A9A', badgeBg: '#6B8FE8', label: 'Content' },
  worksheet: { bg: '#FFF3E8', border: '#F5C98A', text: '#9A5C12', badgeBg: '#E8A55C', label: 'Worksheet' },
  activity:  { bg: '#EDFFF3', border: '#86EFAC', text: '#1E7C43', badgeBg: '#5CC97C', label: 'Activity' },
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
  const [hoveredBlock, setHoveredBlock] = useState(null);

  const blocks = handsOnResources?.[subsection.id] || [];

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

  // ── Add block & navigate ──────────────────────────────────────────────
  const handleAddBlock = (type) => {
    const newId = `block-${Date.now()}`;
    actions.addBlock(subsection.id, { id: newId, type, title: '', content: '' });
    onNavigateToBlock?.(sectionId, subsection.id, newId);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 80px', position: 'relative', zIndex: 1 }}>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        <button
          onClick={onBack}
          style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: '13.8px', fontWeight: '500',
            padding: '6px 13px', borderRadius: '8px', cursor: 'pointer',
            background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.12)',
            color: '#111', whiteSpace: 'nowrap',
          }}
        >
          ← Outline
        </button>
        {sectionNumber && sectionTitle && (
          <span style={{ color: '#555', fontSize: '13px', fontWeight: '500' }}>
            Section {sectionNumber}: {sectionTitle}
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
        {/* Header row with add buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111', fontFamily: "'DM Sans', sans-serif" }}>
            Blocks
            {blocks.length > 0 && (
              <span style={{ marginLeft: '8px', fontSize: '13px', fontWeight: '500', color: '#999' }}>
                {blocks.length}
              </span>
            )}
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['content', 'worksheet', 'activity'].map(type => {
              const s = BLOCK_TYPE_STYLES[type];
              return (
                <button
                  key={type}
                  onClick={() => handleAddBlock(type)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '6px 13px', borderRadius: '8px', cursor: 'pointer',
                    background: s.bg, border: `1px solid ${s.border}`,
                    color: s.text, fontSize: '13px', fontWeight: '600',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  <Plus size={13} /> {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Blocks grid */}
        {blocks.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            border: '1px dashed rgba(0,0,0,0.12)', borderRadius: '12px',
            background: '#FFFFFF',
          }}>
            <p style={{ fontSize: '28px', marginBottom: '8px' }}>📦</p>
            <p style={{ fontSize: '18px', color: '#111', fontWeight: '600', margin: '0 0 4px' }}>No blocks yet</p>
            <p style={{ fontSize: '14px', color: '#777', margin: '0 0 20px' }}>Add content, worksheets, or activities to this subsection</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {['content', 'worksheet', 'activity'].map(type => {
                const s = BLOCK_TYPE_STYLES[type];
                return (
                  <button
                    key={type}
                    onClick={() => handleAddBlock(type)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '9px 20px', borderRadius: '8px', cursor: 'pointer',
                      background: s.bg, border: `1px solid ${s.border}`,
                      color: s.text, fontSize: '14px', fontWeight: '600',
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <Plus size={14} /> {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '14px',
          }}>
            {blocks.map(block => {
              const s = BLOCK_TYPE_STYLES[block.type] || BLOCK_TYPE_STYLES.content;
              const isHovered = hoveredBlock === block.id;
              return (
                <div
                  key={block.id}
                  onClick={() => onNavigateToBlock?.(sectionId, subsection.id, block.id)}
                  onMouseEnter={() => setHoveredBlock(block.id)}
                  onMouseLeave={() => setHoveredBlock(null)}
                  style={{
                    aspectRatio: '1 / 1',
                    background: s.bg,
                    border: `1.5px solid ${s.border}`,
                    borderRadius: '12px',
                    padding: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: isHovered ? '0 4px 14px rgba(0,0,0,0.12)' : '0 1px 4px rgba(0,0,0,0.06)',
                    transition: 'box-shadow 0.15s, transform 0.1s',
                    transform: isHovered ? 'translateY(-2px)' : 'none',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Type badge */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <span style={{
                      display: 'inline-block', padding: '3px 8px',
                      background: s.badgeBg, color: 'white',
                      borderRadius: '6px', fontSize: '10px', fontWeight: '700',
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                      fontFamily: "'DM Sans', sans-serif",
                    }}>
                      {s.label}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); actions.removeBlock(subsection.id, block.id); }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: s.text, padding: '2px',
                        opacity: isHovered ? 0.7 : 0,
                        transition: 'opacity 0.15s',
                        display: 'flex', alignItems: 'center',
                      }}
                      title="Delete block"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* Title */}
                  <div>
                    <p style={{
                      margin: '0 0 4px', fontSize: '14px', fontWeight: '600',
                      color: s.text, fontFamily: "'DM Sans', sans-serif",
                      lineHeight: '1.35',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {block.title || <span style={{ fontStyle: 'italic', opacity: 0.6 }}>Untitled</span>}
                    </p>
                    {block.category && (
                      <p style={{ margin: 0, fontSize: '11px', color: s.text, opacity: 0.65, fontFamily: "'DM Sans', sans-serif" }}>
                        {block.subcategory || block.category}
                      </p>
                    )}
                  </div>

                  {/* Open arrow */}
                  <div style={{
                    fontSize: '11px', fontWeight: '600', color: s.text,
                    opacity: isHovered ? 1 : 0.45, transition: 'opacity 0.15s',
                    textAlign: 'right',
                  }}>
                    Open →
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SubsectionView;
