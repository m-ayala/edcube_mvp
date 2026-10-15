// frontend/src/components/courseBuilder/dayLook.js
// Non-component helpers for the Stage 2 planner (PlanStage): styles, the objective-category hook
// and the per-day look hook.
import { useEffect, useMemo, useState } from 'react';
import { FONT, T } from '../../constants/editorTheme';
import { fetchTaxonomy } from '../../services/courseBuilderApi';
import { CHIP_COLORS, TOPIC_TINTS } from './builderTheme';
import { coveredIds, familiesOf, goesWithText, humanize, needsText } from './dayPlan';

export const EMPTY = [];
export const SR_ONLY = { position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 };

export const plural = (n, word) => `${n} ${word}${Number(n) === 1 ? '' : 's'}`;
export const joinList = (items) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items[0] || '');

export const buttonBase = { fontFamily: FONT, fontWeight: 600, minHeight: 44, borderRadius: 8, cursor: 'pointer' };
export const secondaryBtn = { ...buttonBase, fontSize: 14, padding: '12px 18px', border: `1px solid ${T.cardBorder}`, background: '#FFFFFF', color: T.crumbActive };

// ── Objective categories (from the backend taxonomy; never a hardcoded list) ──────────
// `fallbackIds`: if the taxonomy request fails, only the category ids the day itself uses
// are shown (as raw ids).
export const useObjectiveCategories = (currentUser, fallbackIds) => {
  const [taxonomy, setTaxonomy] = useState(null);
  const [taxonomyError, setTaxonomyError] = useState(false);
  useEffect(() => {
    if (!currentUser) return undefined;
    let live = true;
    fetchTaxonomy(currentUser).then((t) => { if (live) setTaxonomy(t); }).catch(() => { if (live) setTaxonomyError(true); });
    return () => { live = false; };
  }, [currentUser]);

  const key = [...fallbackIds].join('|');
  const categories = useMemo(() => {
    if (taxonomy && Array.isArray(taxonomy.objective_categories)) return taxonomy.objective_categories;
    return fallbackIds.map((id) => ({ id, label: id, description: '' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxonomy, key]);
  const catIndex = useMemo(() => Object.fromEntries(categories.map((c, i) => [c.id, i])), [categories]);
  const catFor = (id) => {
    const i = catIndex[id];
    const c = categories[i];
    return { label: c?.label || id || 'Untagged', color: CHIP_COLORS[(i >= 0 ? i : CHIP_COLORS.length - 1) % CHIP_COLORS.length] };
  };
  return { categories, catIndex, catFor, taxonomyError };
};

// ── Per-day look: tints, emoji, partner families and hover highlighting ───────────────
// `hours`: the day's hours; when given, "Goes with" names the hour and clock time.
export const useDayLook = ({ topics, placed, library = EMPTY, blockMinutes, hours }) => {
  const [hoverFamily, setHoverFamily] = useState(null);
  const families = useMemo(() => familiesOf([...placed, ...library]), [placed, library]);
  const topicIndex = useMemo(() => Object.fromEntries((topics || []).map((t, i) => [t.id, i])), [topics]);
  const topicById = useMemo(() => Object.fromEntries((topics || []).map((t) => [t.id, t])), [topics]);

  const tintFor = (b) => TOPIC_TINTS[(topicIndex[b.topic_id] ?? 0) % TOPIC_TINTS.length];
  const emojiFor = (b) => b.icon || topicById[b.topic_id]?.icon || '📌';
  // `extra`: optional leading parts (the workspace adds its generation state here).
  // `lesson`: for a block sitting in an hour that is not its own, the title of its home lesson.
  const metaFor = (b, extra = [], lesson = '') => {
    const parts = [...extra];
    const gw = goesWithText(b, placed, library, blockMinutes, hours);
    if (gw) parts.push(gw);
    if (lesson) parts.push(`From the lesson "${lesson}"`);
    if (b.description && b.description !== b.title) parts.push(b.description);
    const fmt = [b.format_label, b.type === 'activity' && b.group_size ? humanize(b.group_size) : ''].filter(Boolean).join(' · ');
    if (fmt) parts.push(fmt);
    const needs = needsText(b);
    if (needs) parts.push(needs);
    return parts.join(' · ');
  };
  const lit = (b) => hoverFamily && families[b.id] === hoverFamily;
  const hoverProps = (b) => ({
    onMouseEnter: () => setHoverFamily(families[b.id]),
    onMouseLeave: () => setHoverFamily(null),
    onFocus: () => setHoverFamily(families[b.id]),
    onBlur: () => setHoverFamily(null),
  });
  return { families, topicIndex, topicById, tintFor, emojiFor, metaFor, lit, hoverProps, hoverFamily, setHoverFamily };
};

export const metaStyle = { fontSize: 12, fontWeight: 500, color: T.desc, lineHeight: 1.5, overflowWrap: 'anywhere' };

// Tab chrome for the day switcher. `bad`: the day needs attention; `planned`: green.
export const dayTabStyle = ({ active, planned, bad }) => ({
  ...buttonBase, fontSize: 14, padding: '10px 16px',
  border: `1px solid ${active ? T.crumbActive : bad ? '#feb2b2' : planned ? '#b9e3c9' : T.cardBorder}`,
  background: active ? T.crumbActive : planned ? '#e7f7ee' : '#f1f1f1',
  color: active ? '#FFFFFF' : planned ? '#17693a' : bad ? '#c53030' : '#5f5f5f',
});

export { coveredIds };
