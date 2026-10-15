// frontend/src/components/courseBuilder/dayPlan.js
// Pure helpers for the Stage 2 day planner: everything that is derived from the blocks
// currently in a day (clock times, partner links, resource totals, objective coverage).
// None of it is stored: it is recomputed from the arrangement after every move.

// "0:00", "0:15", ... for the row at `index`.
export const clock = (index, blockMinutes = 15) => {
  const m = index * blockMinutes;
  const mm = m % 60;
  return `${Math.floor(m / 60)}:${mm < 10 ? `0${mm}` : mm}`;
};

// A readable form of a vocabulary id from the taxonomy ("small_groups" -> "Small groups").
// The taxonomy route exposes group sizes as bare ids with no labels, so this is the
// label until the backend adds some (see TASK-015).
export const humanize = (id) => {
  const text = String(id || '').replace(/[_-]+/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
};

export const displayTitle = (b) => (b.part_count > 1 ? `${b.title}, part ${b.part} of ${b.part_count}` : b.title);

// Families of blocks that go together: blocks in one part group, plus any block joined to
// another by goes_with, transitively. Returns { [blockId]: familyKey }.
export const familiesOf = (blocks) => {
  const parent = {};
  const find = (x) => {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  };
  const union = (a, b) => {
    if (!(a in parent) || !(b in parent)) return;
    parent[find(a)] = find(b);
  };
  blocks.forEach(b => { parent[b.id] = b.id; });
  const firstOfGroup = {};
  blocks.forEach(b => {
    if (b.part_group_id) {
      if (firstOfGroup[b.part_group_id]) union(b.id, firstOfGroup[b.part_group_id]);
      else firstOfGroup[b.part_group_id] = b.id;
    }
    if (b.goes_with) union(b.id, b.goes_with);
  });
  const out = {};
  blocks.forEach(b => { out[b.id] = find(b.id); });
  return out;
};

// "0:00", "1:15" for a number of minutes into the day.
export const clockMin = (minutes) => clock(minutes, 1);

// ── Hours (the lessons of a day) ──────────────────────────────────────────────────────
// A day is a list of hours: [{ id, number, title, icon, start_minute, end_minute,
// capacity_blocks, block_ids }]. An hour holds at most one hour of blocks, and the day at most
// `slots` blocks in all. These rules live here so the UI and the plan state apply the same ones.
export const HOUR_MINUTES = 60;
export const hourCapacity = (blockMinutes = 15) => Math.max(1, Math.floor(HOUR_MINUTES / (blockMinutes || 15)));

// Where a block is: { hourIndex, row, minute } for a placed block (minute = into the day), else null.
export const positionsOf = (hours, blockMinutes = 15) => {
  const pos = {};
  (hours || []).forEach((h, k) => {
    const start = Number.isFinite(h.start_minute) ? h.start_minute : k * HOUR_MINUTES;
    h.block_ids.forEach((id, i) => { pos[id] = { hourIndex: k, row: i, minute: start + i * blockMinutes }; });
  });
  return pos;
};

// Why `blockId` cannot go into hour `hourId` right now: '' when it can, else 'hour_full',
// 'day_full' or 'unknown'. Moving a block inside its own hour is always fine.
export const placeBlocker = (day, blockId, hourId) => {
  const hours = day?.hours || [];
  const target = hours.find((h) => h.id === hourId);
  const known = [...(day?.placed || []), ...(day?.library || [])].some((b) => b.id === blockId);
  if (!target || !known) return 'unknown';
  if (target.block_ids.includes(blockId)) return '';
  const inDay = hours.some((h) => h.block_ids.includes(blockId));
  if (target.block_ids.length >= hourCapacity(day.blockMinutes)) return 'hour_full';
  if (!inDay && (day.placed || []).length >= day.slots) return 'day_full';
  return '';
};

export const blockerText = (reason, hour) => {
  if (reason === 'hour_full') return `${hour ? `Hour ${hour.number}` : 'That hour'} is full. An hour holds 60 minutes of blocks, so move one out first.`;
  if (reason === 'day_full') return 'Day is full. To add a block, remove one first.';
  return 'That block could not be moved.';
};

// The hour "Add to Hour N" would use: the block's home hour (its topic) if it has room,
// otherwise the first hour with room; null when the day is full or no hour has room.
export const targetHourFor = (day, block) => {
  const hours = day?.hours || [];
  if (!block || (day.placed || []).length >= day.slots) return null;
  const cap = hourCapacity(day.blockMinutes);
  const home = hours.find((h) => h.id === block.topic_id);
  if (home && home.block_ids.length < cap) return home;
  return hours.find((h) => h.block_ids.length < cap) || null;
};

// "Goes with: <partner> (Hour 2, 1:15)" / "(in the library)", or '' when there is no partner.
// With `hours` the place is the hour and clock time in the day; without, the old "at 0:15".
export const goesWithText = (block, placed, library, blockMinutes, hours) => {
  if (!block.goes_with) return '';
  const idx = placed.findIndex(x => x.id === block.goes_with);
  const partner = idx >= 0 ? placed[idx] : library.find(x => x.id === block.goes_with);
  if (!partner) return '';
  let where = idx >= 0 ? `at ${clock(idx, blockMinutes)}` : 'in the library';
  if (hours) {
    const at = positionsOf(hours, blockMinutes)[partner.id];
    where = at ? `Hour ${hours[at.hourIndex].number ?? at.hourIndex + 1}, ${clockMin(at.minute)}` : 'in the library';
  }
  return `Goes with: ${displayTitle(partner)} (${where})`;
};

export const needsText = (block) => {
  const res = (block.resources || []).filter(r => r && r.name);
  return res.length ? `Needs: ${res.map(r => `${r.quantity} ${r.name}`).join(', ')}` : '';
};

// Materials for the blocks in the day. Mirrors the backend's resource_totals rule: parts of
// one block (same part_group_id) reuse the same items, so take the largest quantity across
// the parts; separate blocks each need their own, so those add up. Returns
// [{ name, quantity, used_in_blocks }] sorted by use then name.
export const resourceTotals = (placed) => {
  const perGroup = {};
  placed.forEach(b => {
    const key = b.part_group_id || b.id;
    const g = (perGroup[key] = perGroup[key] || {});
    (b.resources || []).forEach(r => {
      if (!r || typeof r.name !== 'string' || !r.name.trim()) return;
      const k = r.name.trim().toLowerCase();
      const e = (g[k] = g[k] || { name: r.name, quantity: 0, blocks: 0 });
      e.quantity = Math.max(e.quantity, Number(r.quantity) || 0);
      e.blocks += 1;
    });
  });
  const total = {};
  Object.values(perGroup).forEach(g => {
    Object.entries(g).forEach(([k, e]) => {
      const t = (total[k] = total[k] || { name: e.name, quantity: 0, used_in_blocks: 0 });
      t.quantity += e.quantity;
      t.used_in_blocks += e.blocks;
    });
  });
  return Object.values(total).sort((a, b) => (b.used_in_blocks - a.used_in_blocks) || a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
};

// Objective category ids present among the placed blocks.
export const coveredIds = (placed) => new Set(placed.map(b => b.objective_id).filter(Boolean));
