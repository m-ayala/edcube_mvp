I want to redesign the Phase 1.5 subsection ideation UI in the course workspace. 
Right now, blocks are generated per-day with no way to rearrange them or swap out 
a rigid worksheet/activity/content block. I want to replace that with a two-panel 
"library + day lanes" view.

Find wherever Phase 1.5's block/subsection UI currently lives (likely in or near 
CourseWorkspace, alongside where subsections/topicBoxes are rendered) and add a new 
view alongside it — don't delete the existing one yet, gate the new view behind a 
toggle or feature flag so we can compare and roll back easily.

BEHAVIOR TO IMPLEMENT:

1. Content library panel (left): shows every subsection as a card. Each card has:
   - A drag handle on the header (grip icon) that, when dragged, copies the WHOLE 
     subsection (all its blocks) into wherever it's dropped.
   - Individual block chips (content/worksheet/activity) inside the card, each 
     independently draggable — dragging a chip copies ONLY that block, not the 
     whole subsection.
   - Every drag is a COPY, never a cut. The library never loses items when 
     something is dragged out of it.
   - Subsections that Edo suggested (as opposed to ones from the original teacher 
     input) get a visually distinct "suggested" badge so teachers can tell 
     system-proposed content from their own outline at a glance.

2. Each block chip (in the library AND once copied into a day) has two independent 
   dropdowns:
   - Format/type dropdown: options depend on block type — e.g. content gets 
     text passage / image walkthrough / video / diagram; worksheet gets matching / 
     fill-in-blank / word problem set / short answer; activity gets hands-on / 
     modeling / discussion / reflection journal / debate. Use whatever taxonomy 
     values already exist in our block category constants if we have them — check 
     for something like blockCategories.js before inventing a new list.
   - Topic dropdown: lets the teacher reassign which subtopic this block is about, 
     independent of its format. Populate this from the full set of subsection/topic 
     titles across the course (not just the current section), so a teacher can drag 
     a worksheet into a different day and reassign it to a completely different 
     topic for revision purposes.
   - Changing either dropdown on a block is a LOCAL, per-copy edit only. It must 
     never mutate the original block in the library, and must never propagate to 
     other copies of the same block sitting in other days. This just means: when a 
     block is copied, give it a brand new unique id and a full independent copy of 
     its data (format, topic, etc). Any edit updates only that specific id — nothing 
     else. No need to track where a copy originated from; once it's copied, it's 
     just its own independent block.

3. Day lanes panel (right): one drop zone per day. Dropping a subsection renders it 
   as a grouped card containing all its copied blocks (each still individually 
   editable via the two dropdowns). Dropping a single block renders it as a 
   standalone chip. Both cases give the copy a fresh unique id so it doesn't 
   collide with the source or with other copies.

IMPLEMENTATION NOTES:
- This is a UI/state layer only — nothing here should trigger content generation. 
  Phase 1.5 is purely about defining the shape of the course (which blocks, what 
  format, what topic, which day); actual content generation stays a Phase 2 
  concern and should read the finalized day-by-day structure once we wire that up 
  later. Don't touch the generation pipeline in this pass.
- Use plain HTML5 drag-and-drop events (draggable, onDragStart, onDragOver, onDrop) 
  rather than pulling in a new drag-and-drop library, unless there's already one 
  in the project.
- Keep this additive and backward-compatible — existing courses, the current 
  Phase 1.5 flow, and existing component props/signatures must keep working 
  unaffected if the new view is toggled off.
- Build this incrementally: first the library panel with subsection/block drag 
  sources and the suggested badge, pause for me to test, then the day lanes with 
  copy-on-drop, pause again, then the two dropdowns with local-only edit scoping. 
  Don't do it all in one shot.
- I don't have file paths for you — find the right components yourself by tracing 
  how subsections and topicBoxes currently flow through CourseWorkspace.

Let me know what you find for existing file structure before you start making 
changes, so I can confirm you're extending the right place.

---

## Resolved after TASK-002 investigation (2026-07-19)

The investigation into how subsections/topicBoxes flow through CourseWorkspace
surfaced three things that change this spec's implementation notes. Decisions below
are final — recorded here so any agent picking up TASK-002/003/004 doesn't need to
re-derive them.

1. **Drag-and-drop library:** `@hello-pangea/dnd` is already used throughout
   `CourseWorkspace.jsx` (SECTION/SUBSECTION/BLOCK draggable types, `handleDragEnd`).
   Per this spec's own fallback rule ("...unless there's already one in the
   project"), TASK-002/003 use `@hello-pangea/dnd`, not raw HTML5 drag events.

2. **Don't touch the existing Edo suggestion tray.** `CourseWorkspace.jsx` already
   has a similar-looking pattern — an `edo-tray-*` droppable that teachers drag
   Edo-suggested subsections/blocks out of into the course. That drag is a **cut**
   (the item is removed from the tray on drop). This spec's library panel needs a
   **copy**. Build the library panel's drag source as its own component — it may
   share styling/visual patterns with the tray, but its drop handler is separate
   code. Do not modify `handleDragEnd`'s existing `edo-tray-*` branch or change how
   the tray behaves elsewhere in the app.

3. **Format/type dropdown taxonomy (affects TASK-004):** `blockCategories.js` is
   the wrong source — it holds pedagogical-objective clusters (e.g. "Critical
   Thinking"), not format subtypes. The taxonomy this spec actually describes
   ("Fill-in-the-blank," "text passage," etc.) already exists as `CONTENT_SUBTYPES`
   / `WORKSHEET_SUBTYPES` / `ACTIVITY_SUBTYPES` in
   `backend/outliner/block_prompts.py:15-43`, but isn't exposed to the frontend yet
   — no route, no shared constants file (confirmed: `curriculumSchema.js` only
   references the field name `SUBTYPE`, not the actual values). TASK-005 (new,
   backend-agent) exposes these via a new FastAPI route, matching the pattern
   already planned for TASK-001 — chosen over a shared constants file since no such
   shared file currently exists between backend and frontend. TASK-004 is blocked
   on TASK-005 landing first, not on `blockCategories.js`.
