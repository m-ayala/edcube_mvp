// src/components/courses/SubsectionSelectionMatrix.jsx
//
// Phase 1.5 ("Course Design") teacher review UI: for each section, shows rows of
// independent Basics / Intermediate / Advanced subsection candidates proposed by
// the AI. The teacher checks which subsections to include (locked to prerequisite
// order), can preview any subsection's blocks before deciding, and can ask for
// more candidate ideas per depth level.
import { useMemo, useState } from 'react';
import { useGeneration } from '../../contexts/GenerationContext';

const DEPTH_COLORS = {
  Basics: '#2C5F3A',
  Intermediate: '#B5820A',
  Advanced: '#B34700',
};

const DEPTH_ORDER = { Basics: 0, Intermediate: 1, Advanced: 2 };
const DEPTH_ROWS = ['Basics', 'Intermediate', 'Advanced'];

function buildIndex(sections, candidatesBySection) {
  const subsectionsById = {};
  const parentOf = {};
  const childrenOf = {};
  const chainsBySection = {};

  sections.forEach(section => {
    const chains = candidatesBySection[section.id] || [];
    chainsBySection[section.id] = chains;

    chains.forEach(chain => {
      chain.subsections.forEach(sub => {
        subsectionsById[sub.id] = { ...sub, sectionId: section.id, sectionTitle: section.title, chainId: chain.chain_id };
        parentOf[sub.id] = sub.prerequisite_subsection_id || null;
        if (sub.prerequisite_subsection_id) {
          childrenOf[sub.prerequisite_subsection_id] = [...(childrenOf[sub.prerequisite_subsection_id] || []), sub.id];
        }
      });
    });
  });

  return { subsectionsById, parentOf, childrenOf, chainsBySection };
}

function allowedDepthRows(depthCeiling) {
  const ceilingIdx = DEPTH_ORDER[depthCeiling] ?? 0;
  return DEPTH_ROWS.filter(depth => DEPTH_ORDER[depth] <= ceilingIdx);
}

function BlockPreviewRow({ block, interactive, excluded, onToggle }) {
  return (
    <label
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: interactive ? 'pointer' : 'default',
        padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,0.05)',
      }}
    >
      <input
        type="checkbox"
        checked={!excluded}
        disabled={!interactive}
        onChange={interactive ? onToggle : undefined}
        style={{ marginTop: '3px', flexShrink: 0, cursor: interactive ? 'pointer' : 'default' }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
          <span style={{
            fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em',
            padding: '1px 6px', borderRadius: '4px', flexShrink: 0,
            background: block.type === 'content' ? '#EBF8FF' : block.type === 'worksheet' ? '#FFF7E6' : '#EFFAF3',
            color: block.type === 'content' ? '#2b6cb0' : block.type === 'worksheet' ? '#B5820A' : '#2C5F3A',
          }}>
            {block.type}
          </span>
          <span style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 600,
            color: excluded ? '#9CA3AF' : '#171717', textDecoration: excluded ? 'line-through' : 'none',
          }}>
            {block.title}
          </span>
          <span style={{ color: '#999', fontSize: '11px', fontFamily: "'DM Sans', sans-serif" }}>({block.subtype})</span>
        </div>
        {block.description && (
          <div style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: '12px', lineHeight: '1.4',
            color: excluded ? '#B0B0B0' : '#666',
          }}>
            {block.description}
          </div>
        )}
      </div>
    </label>
  );
}

function SubsectionCard({ subsection, isLocked, selection, onToggleIncluded, onToggleExpanded, onToggleBlock }) {
  const included = !!selection?.included;
  const expanded = !!selection?.expanded;
  const excludedBlockIds = selection?.excludedBlockIds || new Set();
  const totalBlocks = subsection.blocks?.length || 0;
  const selectedBlocks = totalBlocks - excludedBlockIds.size;
  const depthColor = DEPTH_COLORS[subsection.depth_level] || '#666';

  return (
    <div style={{
      border: `1.5px solid ${included ? depthColor + '66' : 'rgba(0,0,0,0.12)'}`,
      borderRadius: '14px', background: included ? depthColor + '0d' : '#FFFFFF',
      opacity: isLocked ? 0.55 : 1, transition: 'opacity 0.15s, border-color 0.15s',
      width: '340px', flexShrink: 0, display: 'flex', flexDirection: 'column',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '16px 18px' }}>
        <input
          type="checkbox"
          checked={included}
          disabled={isLocked}
          onChange={() => onToggleIncluded(subsection.id)}
          style={{ marginTop: '3px', cursor: isLocked ? 'not-allowed' : 'pointer', width: '16px', height: '16px', flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{
              fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
              padding: '2px 8px', borderRadius: '5px', color: '#fff', background: depthColor, flexShrink: 0,
            }}>
              {subsection.depth_level}
            </span>
            {included && (
              <span style={{ fontSize: '11.5px', color: '#666', fontFamily: "'DM Sans', sans-serif" }}>
                {selectedBlocks}/{totalBlocks} blocks
              </span>
            )}
          </div>
          <div style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: '15px', fontWeight: 600, lineHeight: '1.3',
            color: isLocked ? '#999' : '#111', marginBottom: '5px',
          }}>
            {subsection.title}
          </div>
          {subsection.description && (
            <div style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: '12.5px', lineHeight: '1.45',
              color: isLocked ? '#AAA' : '#666',
            }}>
              {subsection.description}
            </div>
          )}
        </div>
        <button
          onClick={() => onToggleExpanded(subsection.id)}
          title={expanded ? 'Hide blocks' : 'Preview blocks'}
          style={{
            border: 'none', background: 'rgba(0,0,0,0.04)', cursor: 'pointer', borderRadius: '6px',
            fontSize: '12px', color: '#555', padding: '5px 7px', flexShrink: 0,
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s',
          }}
        >
          ▶
        </button>
      </div>
      {expanded && (
        <div style={{ padding: '0 18px 14px 18px', borderTop: '1px solid rgba(0,0,0,0.06)', marginTop: '-2px' }}>
          <div style={{ paddingTop: '10px' }}>
            {(subsection.blocks || []).map(block => (
              <BlockPreviewRow
                key={block.id}
                block={block}
                interactive={included}
                excluded={excludedBlockIds.has(block.id)}
                onToggle={() => onToggleBlock(subsection.id, block.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AddMoreCard({ label, onClick, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        width: '160px', flexShrink: 0, minHeight: '96px', borderRadius: '14px',
        border: '1.5px dashed rgba(0,0,0,0.2)', background: 'transparent',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px',
        cursor: loading ? 'wait' : 'pointer', color: '#666',
        fontFamily: "'DM Sans', sans-serif", fontSize: '12.5px', fontWeight: 500,
      }}
    >
      <span style={{ fontSize: '22px', lineHeight: 1 }}>{loading ? '…' : '+'}</span>
      <span style={{ textAlign: 'center', padding: '0 8px' }}>{loading ? 'Generating…' : label}</span>
    </button>
  );
}

function DepthRow({ depth, subsections, selectionState, isLocked, onToggleIncluded, onToggleExpanded, onToggleBlock, onAddMore, addMoreLoading }) {
  const ordered = useMemo(
    () => [...subsections].sort((a, b) => (a.chainId || '').localeCompare(b.chainId || '')),
    [subsections]
  );
  const rowLabel = depth === 'Basics' ? 'more basic ideas' : depth === 'Intermediate' ? 'more ideas' : 'more advanced ideas';

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{
        fontFamily: "'DM Sans', sans-serif", fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.05em', color: DEPTH_COLORS[depth], marginBottom: '8px',
      }}>
        {depth}
      </div>
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {ordered.map(sub => (
          <SubsectionCard
            key={sub.id}
            subsection={sub}
            isLocked={isLocked(sub.id)}
            selection={selectionState[sub.id]}
            onToggleIncluded={onToggleIncluded}
            onToggleExpanded={onToggleExpanded}
            onToggleBlock={onToggleBlock}
          />
        ))}
        <AddMoreCard label={`+ ${rowLabel}`} onClick={onAddMore} loading={addMoreLoading} />
      </div>
    </div>
  );
}

function SelectionSidePanel({ subsectionsById, selectionState, onSubmit, submitting }) {
  const includedSubs = Object.entries(selectionState)
    .filter(([, s]) => s.included)
    .map(([id]) => subsectionsById[id])
    .filter(Boolean);

  const grouped = {};
  includedSubs.forEach(sub => {
    grouped[sub.chainId] = grouped[sub.chainId] || [];
    grouped[sub.chainId].push(sub);
  });
  Object.values(grouped).forEach(list => list.sort((a, b) => (DEPTH_ORDER[a.depth_level] ?? 9) - (DEPTH_ORDER[b.depth_level] ?? 9)));

  const hasSelection = includedSubs.length > 0;

  return (
    <div style={{
      width: '280px', flexShrink: 0, borderLeft: '1px solid rgba(0,0,0,0.08)',
      display: 'flex', flexDirection: 'column', height: '100%',
    }}>
      <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '16px', color: '#111' }}>Your selection</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px' }}>
        {!hasSelection && (
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#999' }}>
            Nothing selected yet. Check subsections to build your course.
          </div>
        )}
        {Object.entries(grouped).map(([chainId, subs]) => (
          <div key={chainId} style={{ marginBottom: '14px' }}>
            {subs.map(sub => {
              const excluded = selectionState[sub.id]?.excludedBlockIds || new Set();
              const total = sub.blocks?.length || 0;
              const indent = sub.depth_level === 'Advanced' ? 24 : sub.depth_level === 'Intermediate' ? 12 : 0;
              return (
                <div key={sub.id} style={{ marginLeft: `${indent}px`, marginBottom: '6px' }}>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12.5px', fontWeight: 500, color: '#111' }}>
                    {sub.title}
                  </div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#888' }}>
                    {total - excluded.size}/{total} blocks selected
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ padding: '14px 18px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <button
          onClick={onSubmit}
          disabled={!hasSelection || submitting}
          style={{
            width: '100%', padding: '10px', borderRadius: '9px', border: 'none',
            background: hasSelection && !submitting ? '#2C5F3A' : '#D1D5DB',
            color: '#fff', fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 600,
            cursor: hasSelection && !submitting ? 'pointer' : 'not-allowed',
          }}
        >
          {submitting ? 'Starting…' : 'Generate blocks'}
        </button>
      </div>
    </div>
  );
}

const SubsectionSelectionMatrix = ({ sections, candidatesBySection, onSubmit }) => {
  const { generateMoreSubsections } = useGeneration();
  const { subsectionsById, parentOf, childrenOf, chainsBySection } = useMemo(
    () => buildIndex(sections, candidatesBySection),
    [sections, candidatesBySection]
  );

  const [selectionState, setSelectionState] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [addMoreLoading, setAddMoreLoading] = useState({}); // { [sectionId]: bool }

  const isLocked = (subsectionId) => {
    const parentId = parentOf[subsectionId];
    if (!parentId) return false;
    return !selectionState[parentId]?.included;
  };

  const uncheckDownstream = (subsectionId, next) => {
    (childrenOf[subsectionId] || []).forEach(childId => {
      if (next[childId]?.included) {
        next[childId] = { included: false, excludedBlockIds: new Set(), expanded: next[childId]?.expanded || false };
      }
      uncheckDownstream(childId, next);
    });
  };

  const onToggleIncluded = (subsectionId) => {
    setSelectionState(prev => {
      const next = { ...prev };
      const wasIncluded = !!prev[subsectionId]?.included;
      if (wasIncluded) {
        next[subsectionId] = { included: false, excludedBlockIds: new Set(), expanded: prev[subsectionId]?.expanded || false };
        uncheckDownstream(subsectionId, next);
      } else {
        next[subsectionId] = { included: true, excludedBlockIds: new Set(), expanded: prev[subsectionId]?.expanded || false };
      }
      return next;
    });
  };

  const onToggleExpanded = (subsectionId) => {
    setSelectionState(prev => ({
      ...prev,
      [subsectionId]: { ...(prev[subsectionId] || { included: false, excludedBlockIds: new Set() }), expanded: !prev[subsectionId]?.expanded },
    }));
  };

  const onToggleBlock = (subsectionId, blockId) => {
    setSelectionState(prev => {
      const current = prev[subsectionId] || { included: true, excludedBlockIds: new Set(), expanded: true };
      const nextExcluded = new Set(current.excludedBlockIds);
      if (nextExcluded.has(blockId)) nextExcluded.delete(blockId);
      else nextExcluded.add(blockId);
      return { ...prev, [subsectionId]: { ...current, excludedBlockIds: nextExcluded } };
    });
  };

  const handleAddMore = async (sectionId) => {
    setAddMoreLoading(prev => ({ ...prev, [sectionId]: true }));
    try {
      await generateMoreSubsections(sectionId);
    } catch (err) {
      console.error('generateMoreSubsections failed', err);
      alert('Could not generate more ideas right now. Please try again.');
    } finally {
      setAddMoreLoading(prev => ({ ...prev, [sectionId]: false }));
    }
  };

  const handleSubmit = () => {
    setSubmitting(true);
    const selections = Object.entries(selectionState)
      .filter(([, s]) => s.included)
      .map(([subsectionId, s]) => {
        const sub = subsectionsById[subsectionId];
        return {
          subsectionId,
          sectionId: sub.sectionId,
          sectionTitle: sub.sectionTitle,
          title: sub.title,
          description: sub.description || '',
          coreConcept: sub.core_concept || '',
          depthLevel: sub.depth_level,
          prerequisiteSubsectionId: sub.prerequisite_subsection_id || null,
          chainId: sub.chainId,
          durationMinutes: sub.duration_minutes || 0,
          learningObjectives: sub.learning_objectives || [],
          blocks: sub.blocks || [],
          included: true,
          excludedBlockIds: Array.from(s.excludedBlockIds),
        };
      });
    onSubmit(selections);
  };

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '20px', color: '#111' }}>
            Phase 1.5: Course Design
          </div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#666', marginTop: '4px' }}>
            Check the subsections you want in your course. Intermediate and Advanced subsections unlock once
            their prerequisite is selected. Click the arrow on any card — checked or not — to preview its blocks
            before deciding. Nothing is generated until you click "Generate blocks".
          </div>
        </div>

        {sections.map(section => {
          const chains = chainsBySection[section.id] || [];
          const rows = allowedDepthRows(section.depthCeiling);
          const subsByDepth = {};
          rows.forEach(depth => { subsByDepth[depth] = []; });
          chains.forEach(chain => {
            chain.subsections.forEach(sub => {
              const full = subsectionsById[sub.id];
              if (subsByDepth[sub.depth_level]) subsByDepth[sub.depth_level].push(full);
            });
          });

          return (
            <div key={section.id} style={{ marginBottom: '30px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '12px' }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '15px', fontWeight: 600, color: '#111' }}>
                  {section.title}
                </div>
                {section.depthCeiling && (
                  <span style={{ fontSize: '11px', color: '#888', fontFamily: "'DM Sans', sans-serif" }}>
                    depth ceiling: {section.depthCeiling}
                  </span>
                )}
              </div>
              {chains.length === 0 ? (
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12.5px', color: '#999' }}>
                  Proposing subsections…
                </div>
              ) : (
                rows.map(depth => (
                  <DepthRow
                    key={depth}
                    depth={depth}
                    subsections={subsByDepth[depth]}
                    selectionState={selectionState}
                    isLocked={isLocked}
                    onToggleIncluded={onToggleIncluded}
                    onToggleExpanded={onToggleExpanded}
                    onToggleBlock={onToggleBlock}
                    onAddMore={() => handleAddMore(section.id)}
                    addMoreLoading={!!addMoreLoading[section.id]}
                  />
                ))
              )}
            </div>
          );
        })}
      </div>

      <SelectionSidePanel
        subsectionsById={subsectionsById}
        selectionState={selectionState}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </div>
  );
};

export default SubsectionSelectionMatrix;
