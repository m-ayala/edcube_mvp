# CHANGELOG

Append-only. Written by docs-qa-agent when a task passes verification. Don't edit past
entries.

<!-- Entries added here as tasks complete, e.g.:
## 2026-07-20 — TASK-001 — blockCategories.js live taxonomy fetch
Backend: added GET /api/taxonomy/blocks reading from knowledge_base_service.py.
Frontend: blockCategories.js now fetches on load instead of using a static array.
-->

## 2026-10-10 — TASK-006 — Course Builder knowledge base
Added kb_seed_data.py (single source for taxonomy seed data), new fields (thinking
level, group sizes, class-size limits, teacher attention, suitable age bands, age-band
notes, objective descriptions, legacy labels), 5 new formats, kb_content_types with the
content -> worksheet -> activity pairing table. New resolved lookup functions in
knowledge_base_service.py (fall back to seed data, never raise) and read-only
GET /api/knowledge-base/taxonomy. Seeder now merges (fills blanks only), with --force and
--dry-run. Seeder not run. block_prompts.py unchanged (lists still duplicated there).

## 2026-10-10 — TASK-007 — Course Builder Stage 1 backend
New outliner/course_outline_prompts.py and course_outline_generator.py: three outlines
(or one for a one-day course) from Prompt 1, filled from the knowledge base; strict
validation with one retry; ids stamped in code; conversion to the existing sections
shape. generate-curriculum gains flow=course_builder (stops at outlines_ready; default
flow unchanged). New POST /api/course-builder/outline-to-sections and /edit-outline
(Edo revision, changed days computed in code, nothing stored). Three new SectionFields
constants. No automated test coverage for this module.

## 2026-10-12 — TASK-008 — Course Builder Stage 2 backend
New outliner/course_day_planner.py, course_day_prompts.py, course_builder_handoff.py and
routes/course_builder.py: plan a day as 15-minute blocks (topics with emoji and priority,
parts, goes_with, objective, group size, resources) from Prompt 2 and knowledge-base data;
code fills the day (essential first, partners kept together, never over the day's time) and
puts the rest in a library; every id checked against the knowledge base; POST plan-days
(SSE), plan-day, day-ideas and build-course (server-side hard cap, 422 over it; hands the
plan to the existing generate-blocks pipeline; sends one build_notes event first when it
had to tidy part numbers or links). A worksheet or activity whose format does not pair with
its content, or whose title repeats its content title, gets one repair call per day; if
that fails it stays in the library flagged needs_review with a review_note, never placed
on the day. Unusable model output returns 502, never 500. Strict format mode no longer
leaves a content type without options. Orchestrator uses block_minutes when set (legacy
15/15/30 unchanged, output verified byte-identical). New SectionFields/BlockSpecFields
constants. Also fixes the small TASK-007 findings. Known gap: needs_review is not carried
through build-course. No automated test coverage for this module.

## 2026-10-12 — TASK-009 — Course Builder Stage 1 page
New flag-gated pages /course-builder/outline and /course-builder/plan (VITE_COURSE_BUILDER=true;
default off): three outline cards, day cards, Edo editing with "Changed by Edo" badges and
undo, objective coverage from GET /api/knowledge-base/taxonomy, step indicator. One-day courses
skip to a Stage 2 placeholder. Edit history lives in GenerationContext (original outlines never
mutated). Editor palette moved to constants/editorTheme.js (values unchanged). Legacy flow
untouched with the flag off. No automated test coverage for this module.

## 2026-10-13 — TASK-010 — Course Builder Stage 2 page
Frontend: day planner page (day tabs, 15-minute timeline, library, drag and button/keyboard
moves, hard time cap in button, droppable and state update, partner lines and "goes with",
live objective coverage and materials, needs-review badge and rename dialog, back-to-outline
and build confirmations, build with notes and retry, landing in the course workspace in the
legacy shape). Accessible modal helper; shared theme constants moved to editorTheme.js
(values unchanged); Edo focus and live-region fixes; shell cleanup spares in-flight builds.
Flag still OFF by default. No backend files changed.


## 2026-10-13 — TASK-016 — Day planner follow-ups
Each planned day's library is now topped up automatically with one extra ideas call (6 ideas),
sent as a new day_library stream event after that day's day_planned (runs alongside the next day;
switch off with COURSE_BUILDER_LIBRARY_TOPUP=off; skipped when the library already has 4 usable
spare blocks; a failed top-up never fails the day). /plan-day returns the topped-up library in one
response. New teacher-facing `notices` ({code, severity, message}) on plans and day-ideas, separate
from the technical `warnings`. needs_review / review_note now carried through the build hand-off.
Behaviour change: later days are told only the topics that have a placed block as already taught.
No automated test coverage for this module.

## 2026-10-13 — TASK-017 — Library top-up fixes
A stalled library top-up is now cut off after 60 seconds (COURSE_BUILDER_LIBRARY_TOPUP_TIMEOUT, in
seconds) and that day's library is sent as unavailable, so it can no longer hold up the end of planning.
Each day's library is now sent as soon as its top-up finishes instead of at the next day boundary.
The "needs review" notice now counts every flagged idea in the day's library (a multi-part idea counts
once), the same in the stream and in plan-day; top-up warnings are no longer mixed into the plan's
own warnings. Wording fixes (plurals, "and N more"). Known gaps: the top-up's own dropped topics are not
shown when the plan already dropped some; the frontend appends rather than replaces day_library notices.
No automated test coverage for this module.

## 2026-10-13 — TASK-011 — Course workspace carries the Stage 2 design; save path keeps Course Builder fields
Frontend: courses built with the Course Builder open in a day view (blocks in the teacher's order, emoji
topic icons, "goes with" links, 15-minute rows) and save and reload without losing order, icons or any other
Course Builder field. A built course now opens correctly from My Courses, the Profile page (own and shared)
and straight after build; the Profile page fetches the full saved course for this (best effort). A save
guard refuses any save that would turn a built course back into the old shape, or that was opened without all
its blocks (the teacher sees only the "Error" save chip). Time cap for a day comes from its saved slots, else
hours per day, else the day is held full. Edo adds tray blocks to the day on screen and says when a day is full;
section/subsection chips are hidden in a built day. Planner technical warnings no longer shown to teachers.
Older courses unchanged (identical navigation state and saved payloads to the previous version). Flag still
OFF by default. No backend files changed. Known gaps: a private shared built course the owner never edited
cannot be fully loaded by a collaborator (needs a backend change); a refused save has no on-screen explanation.
No automated test coverage for this module.

## 2026-10-13 — TASK-018 — Built courses store their blocks in the sections at build
Backend: a Course Builder build now also writes each topic's generated blocks into the
saved sections (and the outline's copy of them), in the same shape the workspace's first
autosave writes, so a freshly built course is never in a "not yet autosaved" state and a
colleague opening a shared, never-edited course sees every block. Legacy generation is
unchanged. Known limit: a built course is stored roughly three times; about 60 blocks in
total fits comfortably in a 1 MiB document, about 80 does not (see TASKS.md).

## 2026-10-13 — TASK-019 — Workspace follow-ups from QA on TASK-011
Frontend only. A course that could not be fully loaded now opens read-only with a plain
message and no Edit buttons (course view page, workspace, viewer shows "content not
loaded" instead of "0 blocks"). A refused save on a built course shows a persistent
notice, locks the editor and offers "Leave without saving"; a network or server save
failure shows a "could not be saved" notice cleared by the next successful save. Profile
course cards show "Opening course..." and ignore clicks until the course is loaded.
Unknown-length message reworded (day view and Edo). Older courses unchanged. No
automated test coverage for this module.

## 2026-10-14 — TASK-014 — Edo outline edits: reply summary built from the diff
The edit reply's "what changed" sentence is now built in code from the changed days
(days numbered by position, fields compared: title, bullets, leads-to line, learning
goals), so Edo can no longer claim a change to a day without a "Changed by Edo" badge.
The model's own sentence is kept only as a short reason (max two sentences, 300
characters; sentences naming days or scope dropped). Response shape unchanged. Known
limits: a non-day claim such as "I also updated the activities" is not filtered; with
many changed days the reply gets long.

## 2026-10-14 — TASK-015 — Group sizes from the knowledge base
Group sizes, thinking levels and teacher attention levels are now labelled items in
kb_seed_data.py with three new collections (kb_thinking_levels, kb_group_sizes,
kb_teacher_attention_levels) and readers in knowledge_base_service.py (seed fallback,
never raise, inactive items dropped; default size = the flagged one). The taxonomy route
keeps every old key and adds vocabularies_detail. The day planner and fix prompt no longer
type the group-size words or the default. Output identical with current seed data.
Notes: if every group size is retired the default is still "small_groups"; two sizes
flagged default resolves to the first in order. The seeder must be run for the three new
collections to exist in Firestore (the app works from built-in data until then).

## 2026-10-14 — TASK-013 — Legacy subtype lists read from the knowledge base (partial)
block_prompts.py: content subtype list and the content -> worksheet compatibility table
are now derived from the knowledge base (lazy, once per process, no read at import; any
failure logs one warning and uses the built-in fallback, never raises). Old constant names
kept as aliases of the fallback; new getters used by subsection_selection_prompts.py.
Worksheet and activity subtype lists stay literal because the knowledge base orders them
differently from the legacy prompts. Known quirk: a KB edit to a worksheet label changes
the compatibility table but not the "subtype from" list in the same prompt until the
follow-up. Follow-up: backend-agent adds a legacy ordering field and getter; then
structure-agent switches the two lists. QA: 1554 prompts byte-identical (seed, Firestore
down, each getter raising). No automated test coverage for this module.

## 2026-10-14 — TASK-021 — Worksheet and activity lists from the knowledge base (finishes TASK-013)
kb_seed_data.py: each worksheet/activity format with legacy labels now carries legacy_order
(ints parallel to legacy_labels, today's order). knowledge_base_service.py: new
get_legacy_subtypes('worksheet'|'activity') (seed fallback, inactive dropped, unordered labels
last, deduped, [] on any problem, never raises). block_prompts.py _derive_taxonomy takes both
lists from it and trims the compatibility table to labels in the worksheet list; an empty list,
or a content type left with no worksheet label, sends the whole taxonomy to the built-in
fallback (one logged warning). Every format list in the old flow now comes from the knowledge
base, and a label rename shows in the list and the table together. Prompts identical with
current seed data. Notes: the table trim itself logs nothing; hand-reordering a multi-label
format's legacy_labels without legacy_order misorders silently. The seeder must be run for
legacy_order (and the earlier new collections) to exist in Firestore; until then the seed data
supplies it. No automated test coverage for this module.

## 2026-10-14 — TASK-022 — Classic workspace restored for Course Builder courses
Removed the Stage 2-style day view from the workspace, view page and viewer (BuilderDayView
deleted; day tabs, time cap, day schedule list, day-order tiles gone; Library pill back).
useCourseActions.js and BlockView.jsx are back to HEAD. Kept the invisible safety fixes:
field-preserving load/save, read-only view of courses opened without all blocks, save guard
(now refuses only a day that stays but loses its schedule; deleting a section is allowed),
plain save messages, Profile loading fix. Blocks load in day order and day_schedule is
recomputed from the classic order on save. Frontend only. No automated test coverage for this module.

## 2026-10-14 — TASK-023 — Stage 2 hours (backend)
Each day is planned as exactly N named one-hour lessons (title, emoji, four 15-minute blocks,
threaded, spare ideas per hour); plan, plan-days, day-ideas and build-course reject a non-whole
hours per day with a plain 422. Day plan gains `hours` (id, number, time window, capacity, block ids);
`topics` mirrors them and every block, library ones too, is homed in a real hour. More ideas attach to
an existing hour. Build accepts the teacher's `hours` arrangement and rejects (never trims) with
hour_over_capacity, too_many_hours, hour_block_missing, hour_block_duplicate, hour_unknown_block,
unknown_hour, duplicate_hour, bad_hour. Saved course: day = section, hour = subsection (hour_number,
start/end minute, 60 minutes) holding its 15-minute blocks in the teacher's order. Legacy flow unchanged.
Deviations accepted: day-ideas answers 422 for an empty current_topics; plan adds hours_per_day and
hour_minutes; extra code too_many_hours.

## 2026-10-14 — TASK-024 — Stage 2 hours (frontend)
Stage 2 shows each day as its hour cards (time window, lesson title, fill pill, four 15-minute rows); blocks move
by drag, "Move to" and "Add to Hour N" within a 60-minute hour and the day's teaching time, with caps also
enforced in the plan state; the build sends the teacher's hours (empty ones too), and a refused hour is shown
against the right day and hour. Course form takes whole hours only when the Course Builder is on. Built courses
open in the classic workspace; each hour subsection shows "Hour N · a–b" once at the start of its description
(applied on load, never stacked), blocks show 15 mins. Older and topic-shaped courses untouched. Frontend only.
No automated test coverage for this module.
