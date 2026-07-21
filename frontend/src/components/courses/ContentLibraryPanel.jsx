// src/components/courses/ContentLibraryPanel.jsx
//
// Phase 1.5 redesign, part 1/3 (TASK-002): the content library panel.
// Shows every subsection in the course as a card you can drag a COPY of — the
// whole subsection via the card's grip handle, or a single block via its chip.
// Nothing is ever removed from here; this is a drag SOURCE only.
//
// IMPORTANT — drag/drop wiring is intentionally independent of the existing
// Edo suggestion tray (see CourseWorkspace.jsx `handleDragEnd`'s `edo-tray-*`
// branch, which is a CUT and must keep working as-is). This panel's Draggables
// use their own type strings (LIBRARY_SUBSECTION / LIBRARY_BLOCK) and droppable
// ids so they can never collide with the tray's or CourseEditor's SECTION /
// SUBSECTION / BLOCK types. They share the single top-level DragDropContext
// already provided by CourseWorkspace (nesting a second DragDropContext isn't
// supported by @hello-pangea/dnd), but `handleDragEnd` has no branch that
// matches these new type strings, so a drop is currently a safe no-op — real
// drop handling (day lanes) lands in TASK-003.
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Sparkles, CalendarDays } from 'lucide-react';

// Matches the pastel palette already used for section accents in CourseEditor.jsx
const SECTION_GRADIENTS = [
  'linear-gradient(180deg,#B2E8C8,#ACD8F0)',
  'linear-gradient(180deg,#F2C0D4,#F7E4A0)',
  'linear-gradient(180deg,#ACD8F0,#B2E8C8)',
  'linear-gradient(180deg,#F7E4A0,#F2C0D4)',
];

// Matches the block-type color coding already used for chips in CourseEditor.jsx
const BLOCK_TYPE_STYLE = {
  content:   { bg: 'rgba(59,95,187,0.10)',  border: 'rgba(59,95,187,0.28)', dot: '#3B5FBB', label: 'Content' },
  worksheet: { bg: 'rgba(176,90,26,0.10)',  border: 'rgba(176,90,26,0.28)', dot: '#B05A1A', label: 'Worksheet' },
  activity:  { bg: 'rgba(26,122,64,0.10)',  border: 'rgba(26,122,64,0.28)', dot: '#1A7A40', label: 'Activity' },
};

// Not exported (keeps this a components-only file for React Fast Refresh) —
// TASK-003 can reuse these same literal strings ('LIBRARY_SUBSECTION' /
// 'LIBRARY_BLOCK') for its day-lane Droppables, they just need to match.
const LIBRARY_DND_TYPES = {
  SUBSECTION: 'LIBRARY_SUBSECTION',
  BLOCK: 'LIBRARY_BLOCK',
};

const ContentLibraryPanel = ({ sections = [], handsOnResources = {} }) => {
  // Flatten every subsection across every non-break section, in outline order,
  // for the single vertical Droppable this panel exposes.
  const flatSubsections = [];
  sections.forEach((section, sectionIndex) => {
    if (section.type === 'break') return;
    (section.subsections || []).forEach((sub, subIndex) => {
      flatSubsections.push({ section, sectionIndex, sub, subIndex });
    });
  });

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: '#FAFAF9' }}>
      {/* ── Library panel (drag source) ── */}
      <div style={{
        width: '380px', flexShrink: 0, display: 'flex', flexDirection: 'column',
        borderRight: '1px solid rgba(0,0,0,0.08)', background: '#FFFFFF', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid rgba(0,0,0,0.06)', flexShrink: 0 }}>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '18px', color: '#111' }}>
            Content Library
          </div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12.5px', color: '#777', marginTop: '3px', lineHeight: 1.4 }}>
            Drag a subsection or a block chip to copy it — nothing here ever gets removed.
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {flatSubsections.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: '#999', fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}>
              No subsections yet — add some from the outline to see them here.
            </div>
          )}

          <Droppable droppableId="lib-subsections" type={LIBRARY_DND_TYPES.SUBSECTION}>
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {flatSubsections.map(({ section, sectionIndex, sub, subIndex }, flatIndex) => {
                  const blocks = handsOnResources[sub.id] || [];
                  const isSuggested = sub.source === 'edo-suggested';

                  return (
                    <Draggable key={sub.id} draggableId={`lib-sub-${sub.id}`} index={flatIndex}>
                      {(subProvided, subSnapshot) => (
                        <div
                          ref={subProvided.innerRef}
                          {...subProvided.draggableProps}
                          style={{
                            ...subProvided.draggableProps.style,
                            marginBottom: '10px',
                            borderRadius: '10px',
                            border: '1px solid rgba(0,0,0,0.08)',
                            background: '#FFFFFF',
                            boxShadow: subSnapshot.isDragging ? '0 6px 16px rgba(0,0,0,0.18)' : '0 1px 3px rgba(0,0,0,0.05)',
                            opacity: subSnapshot.isDragging ? 0.92 : 1,
                            overflow: 'hidden',
                          }}
                        >
                          {/* Card header — the grip handle drags the WHOLE subsection (all its blocks) */}
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                            borderBottom: blocks.length > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                          }}>
                            <div style={{ width: '3px', height: '26px', borderRadius: '2px', flexShrink: 0, background: SECTION_GRADIENTS[sectionIndex % 4] }} />
                            <div
                              {...subProvided.dragHandleProps}
                              title="Drag to copy this whole subsection"
                              style={{ cursor: 'grab', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                            >
                              <GripVertical size={14} style={{ color: '#999' }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontSize: '10.5px', fontWeight: '600', color: '#999',
                                textTransform: 'uppercase', letterSpacing: '0.5px',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                fontFamily: "'DM Sans', sans-serif",
                              }}>
                                {section.title || `Section ${sectionIndex + 1}`} · {subIndex + 1}
                              </div>
                              <div style={{
                                fontSize: '13.8px', fontWeight: '600', color: '#111', lineHeight: 1.3,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                fontFamily: "'DM Sans', sans-serif",
                              }}>
                                {sub.title || 'Untitled subsection'}
                              </div>
                            </div>
                            {isSuggested && (
                              <span style={{
                                display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0,
                                padding: '2px 7px', borderRadius: '20px',
                                background: 'rgba(247,228,160,0.65)', border: '1px solid rgba(180,150,30,0.3)',
                                color: '#5C460A', fontSize: '10px', fontWeight: '700',
                                fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap',
                              }}
                                title="This subsection came from an Edo suggestion, not your original outline"
                              >
                                <Sparkles size={9} /> Suggested
                              </span>
                            )}
                            <span style={{
                              fontSize: '10.5px', color: '#999', flexShrink: 0,
                              background: '#F5F5F4', padding: '2px 6px', borderRadius: '6px',
                              fontFamily: "'DM Sans', sans-serif",
                            }}>
                              {blocks.length}
                            </span>
                          </div>

                          {/* Block chips — each independently draggable, copies ONLY that block */}
                          <Droppable droppableId={`lib-blocks-${sub.id}`} type={LIBRARY_DND_TYPES.BLOCK}>
                            {(blockProvided, blockSnapshot) => (
                              <div
                                ref={blockProvided.innerRef}
                                {...blockProvided.droppableProps}
                                style={{
                                  padding: blocks.length > 0 ? '8px 12px' : '0',
                                  display: 'flex', flexDirection: 'column', gap: '5px',
                                  background: blockSnapshot.isDraggingOver ? 'rgba(172,216,240,0.13)' : 'transparent',
                                  minHeight: blockSnapshot.isDraggingOver ? '30px' : '0',
                                  transition: 'background 0.15s',
                                }}
                              >
                                {blocks.map((block, blockIndex) => {
                                  const style = BLOCK_TYPE_STYLE[block.type] || BLOCK_TYPE_STYLE.content;
                                  return (
                                    <Draggable key={block.id} draggableId={`lib-block-${block.id}`} index={blockIndex}>
                                      {(chipProvided, chipSnapshot) => (
                                        <div
                                          ref={chipProvided.innerRef}
                                          {...chipProvided.draggableProps}
                                          {...chipProvided.dragHandleProps}
                                          title="Drag to copy just this block"
                                          style={{
                                            ...chipProvided.draggableProps.style,
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            padding: '6px 9px', borderRadius: '7px',
                                            background: chipSnapshot.isDragging ? style.dot : style.bg,
                                            border: `1px solid ${style.border}`,
                                            cursor: 'grab', userSelect: 'none',
                                          }}
                                        >
                                          <GripVertical size={11} style={{ color: chipSnapshot.isDragging ? 'rgba(255,255,255,0.85)' : '#999', flexShrink: 0 }} />
                                          <span style={{
                                            width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                                            background: chipSnapshot.isDragging ? '#FFFFFF' : style.dot,
                                          }} />
                                          <span style={{
                                            fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px',
                                            color: chipSnapshot.isDragging ? '#FFFFFF' : style.dot, flexShrink: 0,
                                            fontFamily: "'DM Sans', sans-serif",
                                          }}>
                                            {style.label}
                                          </span>
                                          <span style={{
                                            fontSize: '12.5px', fontWeight: '500',
                                            color: chipSnapshot.isDragging ? '#FFFFFF' : '#333',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            fontFamily: "'DM Sans', sans-serif",
                                          }}>
                                            {block.title || 'Untitled block'}
                                          </span>
                                        </div>
                                      )}
                                    </Draggable>
                                  );
                                })}
                                {blockProvided.placeholder}
                                {blocks.length === 0 && !blockSnapshot.isDraggingOver && (
                                  <div style={{ padding: '8px 12px', fontSize: '11.5px', color: '#CCC', fontStyle: 'italic', fontFamily: "'DM Sans', sans-serif" }}>
                                    No blocks yet
                                  </div>
                                )}
                              </div>
                            )}
                          </Droppable>
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
      </div>

      {/* ── Day lanes placeholder — TASK-003 builds the real drop target here ── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px', color: '#AAA', textAlign: 'center',
      }}>
        <div>
          <CalendarDays size={28} style={{ marginBottom: '8px', opacity: 0.5 }} />
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13.5px', lineHeight: 1.5 }}>
            Day lanes are coming in the next update.<br />
            For now, this view just shows your content library.
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentLibraryPanel;
