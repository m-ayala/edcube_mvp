// frontend/src/components/courseBuilder/dayView.jsx
// Presentational pieces of the Stage 2 day timeline, used by the planner (PlanStage). Pure
// display: no plan state lives here. Markup and styles were lifted unchanged from PlanStage.
// (Hooks, styles and other helpers are in dayLook.js.)
import { useMemo } from 'react';
import { T, BLOCK_TAG } from '../../constants/editorTheme';
import { CHIP_COLORS } from './builderTheme';
import { clock, clockMin, resourceTotals } from './dayPlan';
import { EMPTY, joinList } from './dayLook';

// ── Small pieces ──────────────────────────────────────────────────────────────────────
export const BlockTag = ({ type }) => {
  const tag = BLOCK_TAG[type] || BLOCK_TAG.content;
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6, background: tag.bg, color: tag.fg }}>{tag.label}</span>;
};

export const CategoryChip = ({ cat, small }) => (
  <span style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 600, padding: small ? '2px 8px' : '3px 9px', borderRadius: 6, background: cat.color.bg, color: cat.color.fg, border: `1px solid ${cat.color.bd}` }}>{cat.label}</span>
);

export const NeedsReviewBadge = () => (
  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: '#fff3dc', color: '#8a5a00', border: '1px solid #F5C98A' }}>Needs review</span>
);

export const ReviewNote = ({ block, fallback = 'The title may not match the format. Check it before building.', children }) => (block.needs_review ? (
  <div style={{ background: '#fff3dc', border: '1px solid #F5C98A', borderRadius: 8, padding: '8px 10px', fontSize: 12, lineHeight: 1.5, color: '#6b4500' }}>
    <span>{block.review_note || fallback}</span>
    {children}
  </div>
) : null);

export const FitNote = ({ block }) => (block.fit === 'limited' && block.fit_note ? (
  <div style={{ fontSize: 12, fontWeight: 500, fontStyle: 'italic', color: T.desc, lineHeight: 1.5 }}>{block.fit_note}</div>
) : null);

export const TopicEmoji = ({ emoji, tint, size, font }) => (
  <span aria-hidden="true" style={{ width: size, height: size, borderRadius: size > 26 ? 8 : 7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: font, background: tint.tint, flexShrink: 0 }}>{emoji}</span>
);

// ── Timeline row frame: clock, emoji gutter with partner line, card ───────────────────
// `rowProps` carries the Draggable's innerRef/draggableProps/hover handlers; children are the
// card's contents (the caller decides what the card says and which part is the drag handle).
export const TimelineRow = ({ rowRef, rowProps, style, clockText, emoji, tint, join, dragging, lit, needsReview, children }) => (
  <div ref={rowRef} {...rowProps} style={{ ...style, position: 'relative', display: 'flex', gap: 10, alignItems: 'stretch', marginBottom: 8 }}>
    <div style={{ width: 40, flex: 'none', fontSize: 13, fontWeight: 600, color: T.desc, paddingTop: 16 }}>{clockText}</div>
    <div style={{ width: 30, flex: 'none', position: 'relative' }}>
      <span aria-hidden="true" style={{ position: 'absolute', top: 10, left: 0, width: 30, height: 30, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, background: tint.tint }}>{emoji}</span>
      {join && !dragging && <span aria-hidden="true" data-testid="partner-line" style={{ position: 'absolute', top: 40, left: 13, width: 4, bottom: -18, borderRadius: 2, background: tint.line }} />}
    </div>
    <div style={{ flex: '1 1 auto', minWidth: 0, borderRadius: 12, padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: '6px 12px', alignItems: 'center', boxSizing: 'border-box', border: `1.5px solid ${lit ? T.crumbActive : needsReview ? '#F5C98A' : T.cardBorder}`, background: lit ? '#f2f5ff' : '#FFFFFF', boxShadow: dragging ? '0 10px 26px rgba(0,0,0,0.14)' : 'none' }}>
      {children}
    </div>
  </div>
);

// `clockText`: the row's time when the caller knows it (the hour planner); otherwise from `index`.
export const FreeRow = ({ index, blockMinutes, clockText, label = 'Free · drop a block here', children }) => (
  <div style={{ display: 'flex', gap: 10, alignItems: 'stretch', marginBottom: 8 }}>
    <div style={{ width: 40, flex: 'none', fontSize: 13, fontWeight: 600, color: T.desc, paddingTop: 16 }}>{clockText ?? clock(index, blockMinutes)}</div>
    <div style={{ width: 30, flex: 'none' }} />
    <div style={{ flex: '1 1 auto', minWidth: 0, border: `1.5px dashed ${T.dashed}`, borderRadius: 12, padding: '16px 14px', fontSize: 14, fontWeight: 500, color: T.desc, boxSizing: 'border-box' }}>{children || label}</div>
  </div>
);

// ── One hour of a day: a lesson with its emoji, time window and how full it is ────────
// `children` are the hour's rows (the caller supplies the droppable list). `problem`: plain
// words about why the build refused this hour, shown inside the card.
export const HourCard = ({ hour, tint, blocks, blockMinutes, capacity, problem, children }) => {
  const mins = blocks * blockMinutes;
  const total = capacity * blockMinutes;
  const full = blocks >= capacity;
  return (
    <section aria-label={`Hour ${hour.number}: ${hour.title}`} data-testid={`hour-${hour.number}`} style={{ border: `${problem ? 1.5 : 1}px solid ${problem ? '#feb2b2' : '#d7e1fb'}`, background: problem ? '#fffafa' : '#FFFFFF', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <TopicEmoji emoji={hour.icon || '📌'} tint={tint} size={34} font={19} />
        <div style={{ flex: '1 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.crumbActive }}>Hour {hour.number} · {clockMin(hour.start_minute)}–{clockMin(hour.end_minute)}</div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.cardTitle, overflowWrap: 'anywhere' }}>{hour.title}</h3>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: full ? '#e7f7ee' : '#f1f1f1', color: full ? '#17693a' : '#5f5f5f' }}>
          {full ? `Full · ${mins} of ${total} min` : `${mins} of ${total} min`}
        </span>
      </div>
      {problem && <div role="alert" style={{ fontSize: 13, fontWeight: 600, color: '#c53030', lineHeight: 1.5 }}>{problem}</div>}
      {children}
    </section>
  );
};

// ── Teaching time + learning objectives panel ─────────────────────────────────────────
export const TeachingTimePanel = ({ used, total, full, free, categories, catIndex, covered, taxonomyError, libraryObjectives, hasLibrary = true }) => {
  const missing = categories.filter((c) => !covered.has(c.id));
  const missingInLibrary = hasLibrary ? missing.filter((c) => libraryObjectives.has(c.id)) : EMPTY;
  const missingNowhere = hasLibrary ? missing.filter((c) => !libraryObjectives.has(c.id)) : EMPTY;
  return (
    <div style={{ border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
      <div style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 15 }}>
          <strong style={{ fontWeight: 600, color: T.cardTitle }}>Teaching time</strong>
          <span style={{ fontWeight: 600, color: T.cardTitle }}>{used} of {total} min</span>
        </div>
        <div role="progressbar" aria-label="Teaching time used" aria-valuemin={0} aria-valuemax={total} aria-valuenow={used} style={{ height: 12, background: T.numBg, borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: 12, borderRadius: 999, width: `${total ? Math.round((used / total) * 100) : 0}%`, background: full ? T.primary : T.crumbActive }} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: full ? '#ad004b' : T.desc }}>
          {full ? 'Day is full. To add a block, remove one first.' : `${free} min free`}
        </div>
      </div>
      <div style={{ flex: '2 1 420px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T.cardTitle }}>Learning objectives today</div>
        {taxonomyError && <div style={{ fontSize: 13, color: T.desc }}>The objective category names could not be loaded, so the raw category ids are shown.</div>}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
          {categories.map((c) => {
            const on = covered.has(c.id);
            const col = CHIP_COLORS[(catIndex[c.id]) % CHIP_COLORS.length];
            return (
              <li key={c.id} title={c.description || undefined} style={{ padding: '6px 10px', borderRadius: 6, fontWeight: 600, background: on ? col.bg : '#F3F4F6', color: on ? col.fg : '#4B5563', border: `1px solid ${on ? col.bd : '#D1D5DB'}` }}>
                {c.label} · {on ? 'covered' : 'not covered'}
              </li>
            );
          })}
        </ul>
        {missing.length > 0 && (
          <div style={{ fontSize: 13, fontWeight: 500, color: T.desc, lineHeight: 1.5 }}>
            Not covered today: {joinList(missing.map((c) => c.label))}.
            {hasLibrary && missingInLibrary.length > 0 && ` Look for blocks tagged ${joinList(missingInLibrary.map((c) => c.label))} in the library.`}
            {hasLibrary && missingNowhere.length > 0 && ` Nothing in the library is tagged ${joinList(missingNowhere.map((c) => c.label))}; "More ideas" may help.`}
          </div>
        )}
      </div>
    </div>
  );
};

export const MaterialsLine = ({ dayNumber, placed }) => {
  const materials = useMemo(() => resourceTotals(placed), [placed]);
  return (
    <div style={{ borderTop: '1px solid #efefef', marginTop: 8, paddingTop: 12, fontSize: 14, fontWeight: 500, lineHeight: 1.5, color: '#4a4a4a', overflowWrap: 'anywhere' }}>
      <strong style={{ color: T.cardTitle }}>Materials for Day {dayNumber}:</strong>{' '}
      {materials.length ? materials.map((m) => `${m.quantity} ${m.name}`).join(' · ') : 'Nothing needed yet'}
    </div>
  );
};
