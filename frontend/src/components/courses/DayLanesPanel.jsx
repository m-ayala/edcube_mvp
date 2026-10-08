// src/components/courses/DayLanesPanel.jsx
//
// Phase 1.5 redesign, part 2/3 (TASK-003): the day lanes panel (drop target).
// One lane per day. Library drags are COPIES; the drop handling itself lives in
// CourseWorkspace.handleDragEnd (single top-level DragDropContext), which writes
// into the `dayLanes` state this component renders.
//
// One obvious drop place per day: @hello-pangea/dnd only lets a Droppable accept
// Draggables of its own `type`, so each lane is two NESTED droppables that fill
// the same box — an outer LIBRARY_SUBSECTION one wrapping an inner LIBRARY_BLOCK
// one. During any given drag only the droppables matching the dragged type are
// active, so to the teacher it is a single lane that accepts either.
//
// Items inside a lane are plain (non-draggable) elements for now; the only
// management is the remove button.
import { Droppable } from '@hello-pangea/dnd';
import { CalendarDays, X } from 'lucide-react';
import { BLOCK_TYPE_STYLE, LIBRARY_DND_TYPES, dayDropId } from '../../constants/libraryView';

const BlockChip = ({ block, onRemove }) => {
  const style = BLOCK_TYPE_STYLE[block.type] || BLOCK_TYPE_STYLE.content;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '6px 9px', borderRadius: '7px',
      background: style.bg, border: `1px solid ${style.border}`,
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, background: style.dot }} />
      <span style={{
        fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px',
        color: style.dot, flexShrink: 0, fontFamily: "'DM Sans', sans-serif",
      }}>
        {style.label}
      </span>
      <span style={{
        flex: 1, minWidth: 0, fontSize: '12.5px', fontWeight: '500', color: '#333',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {block.title || 'Untitled block'}
      </span>
      {onRemove && (
        <button
          onClick={onRemove}
          title="Remove from this day"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0', display: 'flex', color: '#999' }}
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
};

const GroupCard = ({ item, onRemove }) => (
  <div style={{
    borderRadius: '10px', border: '1px solid rgba(0,0,0,0.08)', background: '#FFFFFF',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden',
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px',
      borderBottom: item.blocks.length > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none',
    }}>
      <div style={{ width: '3px', height: '22px', borderRadius: '2px', flexShrink: 0, background: 'linear-gradient(180deg,#B2E8C8,#ACD8F0)' }} />
      <div style={{
        flex: 1, minWidth: 0, fontSize: '13.5px', fontWeight: '600', color: '#111',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {item.title}
      </div>
      <span style={{
        fontSize: '10.5px', color: '#999', background: '#F5F5F4', padding: '2px 6px',
        borderRadius: '6px', fontFamily: "'DM Sans', sans-serif",
      }}>
        {item.blocks.length}
      </span>
      <button
        onClick={onRemove}
        title="Remove this subsection from the day"
        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0', display: 'flex', color: '#999' }}
      >
        <X size={14} />
      </button>
    </div>
    {item.blocks.length > 0 && (
      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {item.blocks.map(b => <BlockChip key={b.id} block={b} />)}
      </div>
    )}
  </div>
);

const DayLanesPanel = ({ numDays, dayLanes, onRemoveItem }) => {
  const days = Array.from({ length: numDays }, (_, i) => i + 1);

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid rgba(0,0,0,0.06)', flexShrink: 0, background: '#FFFFFF' }}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '18px', color: '#111' }}>
          Day Lanes
        </div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12.5px', color: '#777', marginTop: '3px', lineHeight: 1.4 }}>
          Drop a subsection or block into a day to plan it. Copies only, and nothing is generated.
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {days.map(day => {
          const items = dayLanes[day] || [];
          return (
            <div key={day}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px',
                fontSize: '12px', fontWeight: '700', color: '#555', textTransform: 'uppercase',
                letterSpacing: '0.5px', fontFamily: "'DM Sans', sans-serif",
              }}>
                <CalendarDays size={13} /> Day {day}
              </div>
              <Droppable droppableId={dayDropId(day, 'sub')} type={LIBRARY_DND_TYPES.SUBSECTION}>
                {(subProvided, subSnapshot) => (
                  <div ref={subProvided.innerRef} {...subProvided.droppableProps}>
                    <Droppable droppableId={dayDropId(day, 'block')} type={LIBRARY_DND_TYPES.BLOCK}>
                      {(blockProvided, blockSnapshot) => {
                        const active = subSnapshot.isDraggingOver || blockSnapshot.isDraggingOver;
                        return (
                          <div
                            ref={blockProvided.innerRef}
                            {...blockProvided.droppableProps}
                            style={{
                              minHeight: '64px', padding: '8px', borderRadius: '10px',
                              display: 'flex', flexDirection: 'column', gap: '8px',
                              border: active ? '1.5px dashed #5B9BC8' : '1.5px dashed rgba(0,0,0,0.12)',
                              background: active ? 'rgba(172,216,240,0.18)' : '#FFFFFF',
                              transition: 'background 0.15s, border-color 0.15s',
                            }}
                          >
                            {items.length === 0 && !active && (
                              <div style={{
                                margin: 'auto', fontSize: '12px', color: '#BBB', fontStyle: 'italic',
                                fontFamily: "'DM Sans', sans-serif",
                              }}>
                                Drop here
                              </div>
                            )}
                            {items.map(item => (
                              item.kind === 'group'
                                ? <GroupCard key={item.id} item={item} onRemove={() => onRemoveItem(day, item.id)} />
                                : <BlockChip key={item.id} block={item.block} onRemove={() => onRemoveItem(day, item.id)} />
                            ))}
                            {/* Placeholders are rendered but unused: lane items aren't Draggables. */}
                            <div style={{ display: 'none' }}>{blockProvided.placeholder}</div>
                            <div style={{ display: 'none' }}>{subProvided.placeholder}</div>
                          </div>
                        );
                      }}
                    </Droppable>
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DayLanesPanel;
