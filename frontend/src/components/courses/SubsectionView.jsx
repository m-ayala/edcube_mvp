// src/components/courses/SubsectionView.jsx
import { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronRight } from 'lucide-react';
import CardRow from './CardRow';

// Per-type card styling.
const TYPE_STYLES = {
  content:   { innerBg: '#FFF1E9', accent: '#FF5900', pillBg: '#FFDCCB', label: 'Content',   defaultDuration: 15 },
  worksheet: { innerBg: '#FFF2F8', accent: '#FF006E', pillBg: 'rgba(255,0,110,0.13)', label: 'Worksheet', defaultDuration: 20 },
  activity:  { innerBg: '#F4F4E4', accent: '#768B00', pillBg: 'rgba(118,139,0,0.20)', label: 'Activity',  defaultDuration: 20 },
};

const Pill = ({ style, children }) => (
  <span style={{
    display: 'inline-block', padding: '4px 12px', borderRadius: '20px',
    fontSize: '11px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif",
    lineHeight: 1.2, whiteSpace: 'nowrap', ...style,
  }}>{children}</span>
);

// ── Card geometry ──────────────────────────────────────────────────────────
const CARD_W = 272;   // sized so ~4 tiles fit per row in the 1180px content area
const CARD_H = 168;
const FOOTER_H = 44;

// ── Block card ─────────────────────────────────────────────────────────────
const BlockCard = ({ block, subsectionId, sectionId, actions, onNavigateToBlock }) => {
  const s = TYPE_STYLES[block.type] || TYPE_STYLES.content;
  const [hov, setHov] = useState(false);

  const open = () => onNavigateToBlock?.(sectionId, subsectionId, block.id);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={open}
      style={{
        width: CARD_W, height: CARD_H, flexShrink: 0, boxSizing: 'border-box',
        background: '#FFFFFF', border: '1px solid #C8CDD6', borderRadius: '16px',
        overflow: 'hidden', cursor: 'pointer',
        boxShadow: hov ? '0 8px 22px rgba(0,0,0,0.14)' : '0 2px 6px rgba(0,0,0,0.08)',
        transition: 'box-shadow .15s',
      }}
    >
      <div style={{
        margin: '8px 8px 0', height: CARD_H - 8 - FOOTER_H, boxSizing: 'border-box',
        borderRadius: '12px', background: s.innerBg, padding: '14px 16px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden',
      }}>
        <p style={{
          margin: 0, fontFamily: "'DM Sans', sans-serif", fontStyle: 'italic',
          fontWeight: '500', fontSize: '16px', lineHeight: '1.3', color: s.accent,
          overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {block.title || <span style={{ opacity: .55 }}>Untitled {s.label}</span>}
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <Pill style={{ background: s.pillBg, color: s.accent }}>{s.label}</Pill>
          <Pill style={{ background: s.pillBg, color: s.accent }}>
            {block.duration_minutes ?? s.defaultDuration} Mins
          </Pill>
        </div>
      </div>

      <div style={{
        height: FOOTER_H, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 14px',
      }}>
        <button
          onClick={e => { e.stopPropagation(); open(); }}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif", fontSize: '13.5px', fontWeight: '500', color: '#383838',
          }}
        >
          Edit {s.label}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={e => { e.stopPropagation(); actions.removeBlock(subsectionId, block.id); }}
            title="Delete block"
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
              display: 'flex', alignItems: 'center', color: '#F87171',
              opacity: hov ? 0.9 : 0, transition: 'opacity .15s',
            }}
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); open(); }}
            title="Open block"
            style={{
              width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0,
              background: '#EBEBEB', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555',
            }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

// Outlined "Add …" buttons.
const ADD_BUTTONS = [
  { type: 'content',   label: 'Add Content Block',   accent: '#3E62BC' },
  { type: 'worksheet', label: 'Add Worksheet Block', accent: '#D28E3C' },
  { type: 'activity',  label: 'Add Activity Block',  accent: '#768B00' },
];

const AddButton = ({ label, accent, onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        padding: '6px 12px', borderRadius: '6.4px', cursor: 'pointer',
        background: hov ? `${accent}14` : 'transparent',
        border: `1px solid ${accent}`,
        color: accent, fontSize: '12.5px', fontWeight: '500',
        fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap',
        transition: 'background .15s',
      }}
    >
      <Plus size={13} /> {label}
    </button>
  );
};

// ── Block section — three horizontally-scrolling type rows ─────────────────
// Reuses <CardRow> (the same pager component as the My Courses page): a native
// horizontal scroll track that shows ~4 tiles and reveals circular prev/next
// pagers only when the row overflows.
const BLOCK_ROWS = [
  { type: 'content',   label: 'Content' },
  { type: 'worksheet', label: 'Worksheets' },
  { type: 'activity',  label: 'Activities' },
];

const EmptyRow = ({ label, accent }) => (
  <div style={{
    width: CARD_W, height: CARD_H, flexShrink: 0, boxSizing: 'border-box',
    display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
    padding: '20px', borderRadius: '16px', border: `1.5px dashed ${accent}55`,
    color: '#AAB0BC', fontSize: '12.5px', fontStyle: 'italic', fontFamily: "'DM Sans', sans-serif",
  }}>
    No {label.toLowerCase()} yet
  </div>
);

const BlockGroupGrid = ({ allBlocks, subsectionId, sectionId, actions, onNavigateToBlock }) => {
  // Add the block into its row and stay on the page — the new card shows up in
  // the matching row; click it to open the editor.
  const addBlock = (type) => {
    actions.addBlock(subsectionId, { id: `block-${Date.now()}`, type, title: '', content: '' });
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '22px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '16px', fontWeight: '700', color: '#111', fontFamily: "'DM Sans', sans-serif" }}>
          Blocks
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {ADD_BUTTONS.map(b => (
            <AddButton key={b.type} label={b.label} accent={b.accent} onClick={() => addBlock(b.type)} />
          ))}
        </div>
      </div>

      {BLOCK_ROWS.map(row => {
        const rowBlocks = allBlocks.filter(b => b.type === row.type);
        const accent = (TYPE_STYLES[row.type] || TYPE_STYLES.content).accent;
        return (
          <CardRow key={row.type} label={row.label} count={rowBlocks.length}>
            {rowBlocks.length === 0
              ? <EmptyRow label={row.label} accent={accent} />
              : rowBlocks.map(block => (
                <BlockCard
                  key={block.id}
                  block={block}
                  subsectionId={subsectionId}
                  sectionId={sectionId}
                  actions={actions}
                  onNavigateToBlock={onNavigateToBlock}
                />
              ))}
          </CardRow>
        );
      })}
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
      <div style={{ maxWidth: '1180px', margin: '0 auto' }}>

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

        {/* Subsection info card — full-width header per the Figma spec */}
        <div style={{
          width: '100%', background: '#FFFFFF', border: '2px solid #D1DEFF', borderRadius: '8px',
          padding: '22px 26px', marginBottom: '28px',
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

        {/* Blocks */}
        <BlockGroupGrid
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
