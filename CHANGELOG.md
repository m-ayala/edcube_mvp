# CHANGELOG

Append-only. Written by docs-qa-agent when a task passes verification. Don't edit past
entries.

<!-- Entries added here as tasks complete, e.g.:
## 2026-07-20 — TASK-001 — blockCategories.js live taxonomy fetch
Backend: added GET /api/taxonomy/blocks reading from knowledge_base_service.py.
Frontend: blockCategories.js now fetches on load instead of using a static array.
-->

## 2026-09-29 — TASK-006 — Firestore reorg part 1/5: backend paths
Added `backend/firebase/paths.py` as the single source of truth for the new
`EdCube` (platform) / `Users/{org}` (per-org) Firestore tree, with `resolve_org(uid)`
resolving org from the caller's email domain (never from Firestore). Threaded `org`
through `FirebaseService`'s curricula, profile, sharing and notification methods, and
updated every caller in `routes/curriculum.py`, `routes/teachers.py`,
`routes/notifications.py`, `firebase/dbServices.py` and `services/knowledge_base_service.py`
(KB getters keep their names/signatures/return shapes — only the underlying path
changed). `routes/contact.py` no longer writes to the `leads` collection. Notifications
are now delete-on-seen: `PATCH /{id}/read` is gone, replaced by
`POST /api/notifications/seen` taking `{notification_ids}`. Rewrote
`frontend/firestore.rules` for org-scoped access, owner-only curricula/folder writes,
and read-only `EdCube/knowledge_base/**`. No data migration and no deploys in this
task — see TASK-007/008/009.

## 2026-09-30 — TASK-006b — Firestore reorg part 1b: org isolation hardening
Replaced the hardcoded `DOMAIN_ORG_MAP`/icc-fallback org resolution with a single
registry: `backend/firebase/org_registry.py` reads `Users/{org}` docs
(`{name, domains, allowed_emails}`), cached in-process with a short TTL. `match_org()`
is a pure function (unit-checked against a stubbed registry: `x@unknown.com` → `None`,
`someone@gmail.com` → `None`, `manaswini.ayala@gmail.com` → `icc`, `a@indiacc.org` →
`icc`). There is no default org anymore — the new `require_org` / `require_org_for_uid`
dependencies (`routes/teachers.py`) 403 with "Your organization is not registered with
EdCube" for any unregistered email. Added `GET /api/orgs/check-email` (unauthenticated,
for signup) and registered it in `main.py`. Edo chat (`POST /api/curriculum/chat`) and
`POST /api/populate-section` now require a Firebase token; the org comes from the token,
never from the request body. Deleted every `collection_group()` query in the backend
(`_find_curriculum_ref`, synopsis camp/entry cross-lookups) in favor of direct
`Users/{org}/…` paths — `update_section`, `update_curriculum`,
`get_synopsis_entry_in_week`, etc. now take `org` as a required parameter. Deleted the
dead `backend/firebase/dbServices.py` (zero importers). Afterschool synopsis entries
moved from a flat `.../afterschool/entries` collection to nested
`.../afterschool/months/{monthId}/entries/{entryId}`, with month delete now cascading to
its entries. Added `sharedWithUids` (kept in sync by add/remove-shared-with) so "shared
with me" is an `array_contains` query instead of a full-collection scan. New course
attachment and synopsis photo uploads go under `Users/{org}/…` in Storage; existing
files/links are untouched (TASK-011). Rewrote `frontend/firestore.rules` to check org
membership via `get()`-ing `Users/{orgId}` and the same domain/allowed-emails match
rule, replacing the old hardcoded domain list. `test-org` is dropped per the person's
Round 2 decision — not migrated. No deploys, no data migration, no Firestore writes in
this task. Known gaps carried to TASK-007/008 (see `ARCHITECTURE.md`): the frontend
still has its own `DOMAIN_ORG_MAP` (including `gmail.com`) that disagrees with the new
backend/rules registry; several `routes/curriculum.py`/`routes/topics.py` endpoints
still take a raw `teacherUid` instead of a token (org is still correctly validated
server-side on each, just not via a signed token); `GET /api/synopsis/entries/{id}` now
requires `week_id`/`camp_id` and has no current frontend caller.

## 2026-09-30 — TASK-007 — Firestore reorg part 2/5: migration script
Added `backend/scripts/migrate_to_org_tree.py`, implementing the full "Old → new
mapping" table in `tasks/firestore-reorg-spec.md` plus the Round 2 additions: creates
the `Users/icc` registry doc (`name`, `domains`, `allowed_emails`) and the other
intermediate docs (`EdCube/knowledge_base`, `Users/icc/synopsis/afterschool`,
`Users/icc/synopsis/summer_camps`) with real fields; nests afterschool entries under
their month instead of a flat sibling collection; backfills `sharedWithUids` on every
migrated curriculum; normalizes the one `organization: 'ICC'` teachers doc to `'icc'`;
skips `test-org` and any doc with an unresolvable org; never copies `leads`, the legacy
`synopsis_*` collections, or `worksheet_pdfs`. Every destination path is built with a
`backend/firebase/paths.py` helper. Dry run is the default (read-only, prints a
source → destination plan); `--apply` performs the copy-only, idempotent writes;
`--delete-old --yes-really` (TASK-010 only) removes the fixed list of old top-level
collections once destination counts are verified to meet or exceed the eligible source
counts, and never touches `Users/` or `EdCube/`. Also, new profile-picture uploads
(`routes/uploads.py`) now go to `Users/{org}/profile_pictures/{uid}/…` via the
`require_org` dependency instead of a flat `profile_pictures/{uid}/…` path; existing
stored URLs are unaffected. Only dry-run mode was exercised for this task — re-run
independently by docs-qa-agent with identical counts (curricula 23→22, teacher_profiles
11→11, teachers 13→29, notifications 4→4, synopsis/ICC/weeks 8→661, afterschool months
4→4, afterschool entries 30→30, kb 5/4/3/10/8) and confirmed read-only via a listing
showing `Users`/`EdCube` still empty afterward. No deploys, no `--apply`, no
`--delete-old` run in this task — see TASK-009/010.

## 2026-10-01 — TASK-008 — Firestore reorg part 3/5: frontend
Added `frontend/src/firebase/paths.js`, the web-SDK mirror of
`backend/firebase/paths.py`; every direct Firestore call in `frontend/src` now goes
through it (verified empty `grep "collection(db\|doc(db,"` outside that file).
`firebase/dbService.js` — every exported function now takes `org` and reads/writes
`Users/{org}/...`; the dead, unused `saveCurriculum` (old flat-`curricula` writer, zero
importers) was deleted rather than migrated. `firebase/authService.js` replaces the
hardcoded `DOMAIN_ORG_MAP`/`getOrgFromEmail`/`ORGS` with `checkEmailOrg`, which calls the
new `GET /api/orgs/check-email`; signup checks the org *before* creating the Firebase
Auth user (no orphan-user risk), and both signup and login write
`Users/{org}/teachers/{uid}`; an unregistered email is rejected with "Your organization
is not registered with EdCube." `AuthContext` resolves `org`/`orgName`/`orgError` on
every auth-state change, signs out a user whose email is no longer registered, and
exposes all three via `useAuth()`; `ProtectedRoute` redirects to `/login` on `orgError`,
`Login` surfaces the message, and `Signup`'s organization dropdown is gone (the org is
now derived purely from the email). `CourseDesigner`/`CourseWorkspace` read `org` from
the auth context instead of each fetching its own teacher profile; `MyCourses`,
`AddFolderModal`, `BlockView`, `LibraryPickerModal` and `ResourceLibrary` now pass `org`
to `dbService` and gate their Firestore calls on `org` being resolved, closing the
`Users/null/...` race window. `constants/blockCategories.js` now reads
`EdCube/knowledge_base/pedagogy` instead of the old flat `kb_objectives` collection.
`utils/curriculumApi.js`'s `chatWithEdo` now sends `Authorization: Bearer <idToken>`
(`EdoChatbot` sources the token via `currentUser.getIdToken()`), matching the backend's
now-required `require_org` dependency on `POST /curriculum/chat`. Notifications move
fully to delete-on-seen on the frontend: `notificationService.js`'s `markAsRead` is
replaced by `markNotificationsSeen` (`POST /api/notifications/seen` with
`{notification_ids}`); `NotificationContext.openAndMarkSeen()` loads+displays the
current list, then marks exactly those ids seen (one call per bell-open, no `.status`
field anywhere); `unreadCount` is just the list length. Neither `populate-section` nor
`GET /synopsis/entries/{id}` has a frontend caller, so no change was needed there despite
their backend signatures changing in TASK-006b. `npm run build` and `npm run lint`
(27 errors, 6 warnings) are unchanged before and after this diff, confirmed by
docs-qa-agent via an independent `git stash`/lint/`stash pop` cycle. Remaining gap,
unchanged by this task and tracked in `ARCHITECTURE.md`: several
`routes/curriculum.py`/`topics.py` endpoints still take a raw `teacherUid` instead of a
token — not in this task's file list, safe today only because the backend ignores the
client-supplied `organizationId` and resolves org server-side.

## 2026-10-05 — TASK-001 — blockCategories.js fetches taxonomy from backend
Backend: new read-only `GET /api/knowledge-base/objectives` (`routes/knowledge_base.py`,
registered in `main.py`, behind `require_org`) returning `get_objectives()` unchanged.
Frontend: `blockCategories.js` now fetches it with the Firebase ID token instead of reading
Firestore directly; exports unchanged, hardcoded array kept as fallback, a single one-shot
auth listener covers a first call made before sign-in. Not yet deployed (404 and fallback
until then). `kbCol` in `firebase/paths.js` is now unused.

## 2026-10-05 — TASK-005 — block subtypes route
Backend: added `GET /api/knowledge-base/block-subtypes` to `routes/knowledge_base.py`
(behind `require_org`), returning the content/worksheet/activity subtype lists and the
content-to-worksheet compatibility map, built from the constants in
`outliner/block_prompts.py` (nothing retyped, nothing under `outliner/` edited, no
Firestore access). For TASK-004's format dropdown. Not yet deployed.

## 2026-10-05 — TASK-003 — Phase 1.5 day lanes with copy-on-drop
Frontend: new `DayLanesPanel.jsx`, `constants/libraryView.js` and `utils/dayLanes.js`.
The Library view's right-hand placeholder is now one drop lane per day (count from
`formData.numDays`, default 5, max 60). Dropping a subsection adds a grouped card of
fresh-id deep-copied blocks; dropping a block adds a standalone chip; each has a remove
button. `handleDragEnd` gained a library-only branch (existing branches untouched);
library source lists are `isDropDisabled`. Lane state is session-only React state, not
saved. Not browser-tested.

## 2026-10-05 — TASK-010 — Firestore reorg part 5/5: old collections deleted
Ran `migrate_to_org_tree.py --delete-old --allow-fewer-notifications --yes-really` against
`edcube-8fe7d` after a full recursive local backup (851 docs, 18 collections, kept outside
the repo). 851 docs deleted; the database's only root collections are now `EdCube` and
`Users`. Script changes: recursive delete uses `list_documents()` so phantom parents such
as `synopsis/ICC` are traversed; new opt-in `--allow-fewer-notifications` relaxes the count
guard for the notifications mapping only (delete-on-seen inbox). The 2 `leads` docs were
backed up, then deleted. Verified read-only afterwards by docs-qa-agent.

## 2026-10-05 — TASK-011 — Cloud Storage files moved under Users/icc (copy plus relink)
New `backend/scripts/migrate_storage_to_org_tree.py` (dry run by default) and a pure
`storage_path(org, *parts)` helper in `backend/firebase/paths.py`. Ran with `--apply`:
1370 blobs copied server-side to `Users/icc/{synopsis/summer_camps, synopsis/afterschool,
course_attachments, profile_pictures}/` with metadata and download token preserved, and
1188 stored links across 416 docs rewritten (before/after backup kept outside the repo).
Old blobs were deliberately left in place; deleting them is TASK-012. No route or upload
behaviour changed.

## 2026-10-06 — TASK-012 — Storage reorg: old top-level copies deleted
Deleted the 1370 old Cloud Storage blobs (about 4.3 GB) under `synopsis/`,
`afterschool_synopsis/`, `course_attachments/` and `profile_pictures/` with the migration
script's `--delete-old --yes-really`, on the person's explicit approval. Verified read-only:
old prefixes empty, new prefixes 1324 / 43 / 1 / 2, all 1188 stored links point at an existing
blob, 60 sampled links returned 206, dry run clean. Sent newsletters are unaffected (photos
are embedded as bytes in downloaded .docx files). Residual risk: addresses copied out of the
app and pasted elsewhere. Orphans (182) and `worksheet_*` prefixes left for TASK-013.

## 2026-10-07 - TASK-013 - Storage leftovers cleanup
Deleted 176 unlinked blobs (about 462 MB) from the Storage bucket on the person's explicit
approval: 166 summer-camp photos under `Users/icc/synopsis/summer_camps/` and all 10 blobs in
`worksheet_images/` and `worksheet_pdfs/`. Kept on purpose: 15 unlinked afterschool blobs and 1
profile picture. Verified read-only: bucket 1204 blobs (1158 / 43 / 1 / 2), 1188 stored links, 0
missing. Backup of the deleted files is at `~/edcube_backups/storage_leftovers_2026-10-07/`.

<!-- Course Builder entries below were written on the course-builder branch before the Firestore reorg was merged (2026-10-15). Their TASK numbers overlap the reorg's TASK-006 to TASK-013 above; they are separate tasks. -->

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

## 2026-10-15 — TASK-026 — Course Builder merged onto the Firestore reorganisation
Branch course-builder merged into main (backend_cleanup layout). Knowledge base: the Course Builder's
collections now live under EdCube/knowledge_base (kb_content_types -> content_types, kb_thinking_levels ->
thinking_levels, kb_group_sizes -> group_sizes, kb_teacher_attention_levels -> teacher_attention; the five
existing ones keep main's names); one knowledge_base route file serves /objectives, /block-subtypes and
/taxonomy behind require_org; the seeder writes only under EdCube/knowledge_base, merge-only. Courses are
saved at Users/{org}/curricula/{id}; generate-curriculum and build-course (through generate-blocks) check the
caller's org (403 "Your organization is not registered with EdCube"). Frontend uses main's org from useAuth
and addCourseToFolder(uid, org, folderId, id); firestore.rules unchanged. Verified with the model stubbed
and Firestore faked in memory (no real calls): flag off identical to main; flag on end to end; prompts
byte-identical to the course-builder branch. Not run: real sign-in, real Firestore/rules, real model, the
seeder against the real database, mouse drag in Stage 2, the afterschool admin views.
Notes for the person: (1) running the seeder also fills missing fields on existing docs in age, pedagogy,
worksheets, activities and content (never overwrites a value) and creates 5 new docs (worksheets:
multiple_choice, compare_contrast; activities: design_challenge, debate_discussion, reflection_journaling);
/objectives then returns a description on each objective. (2) A generate-curriculum 403 or other non-stream
error leaves the designer on "Starting... 0%" with no message (also in main). (3) plan-days, plan-day,
day-ideas, edit-outline and outline-to-sections have no sign-in check (same as generate-blocks); they touch
no Firestore but spend model calls. (4) frontend/.env.local sets VITE_COURSE_BUILDER=true, so a local run is
flag ON unless changed. (5) A built course is stored about 3 times (see TASK-018): about 80 blocks do not
fit the 1 MiB document limit; still needs a decision. No automated test coverage for this module.

## 2026-10-20 — TASK-027 — Block Links & Resources via Browserbase
`POST /api/curriculum/generate-block-links` now plans from the block's own content (one model call), searches
and reads pages with Browserbase (one real browser session per request for blocked pages), scores articles and
videos against the block, and checks images with the vision model. Returns up to 4 articles, 6 images, 3 videos in
the same `{"links": [...]}` shape; `type` is "article" | "image" | "video", images add `imageUrl` and `caption`
(`url` is the source page), any link may add `reason`. New: `backend/utils/browserbase_client.py`,
`backend/populator/block_resource_finder.py`, `BROWSERBASE_API_KEY` and `RESOURCE_SEARCH_PROVIDER` in `config.py`,
`playwright==1.64.0` in requirements. Old YouTube/worksheet logic moved unchanged into
`_generate_block_links_legacy`. Verified with real calls: about 30s per block; bad key or unreachable Browserbase
returns an empty list, no 500; no keys or connect URLs in logs. Deploy note: the person must add
`BROWSERBASE_API_KEY` to Cloud Run before deploying; setting `RESOURCE_SEARCH_PROVIDER=legacy` rolls back (a
missing key also falls back to legacy). Open notes: near-duplicate scans of one artwork can appear; frontend
(TASK-028) should dedupe images on `imageUrl`. No automated test coverage for this module.

## 2026-10-20 — TASK-028 — Links & Resources split into Articles, Images, Videos
Frontend: block links panel shows three groups with one Generate button; images as thumbnails with caption (click opens source page, broken images fall back to a link row); Generate and Add Link/Library merge without duplicates (images matched on imageUrl); older links grouped by type. Links stay in the block's existing links field, no schema change.

## 2026-10-20 — TASK-029 — Block-aware Links & Resources prompts and video filters
All resource prompts now live in backend/populator/block_resource_prompts.py, with a "where to look" note (block-writing prompts first, then this file). Planning differs per block type (content, worksheet, activity) with multi-subject examples and student-level wording for younger grades. Videos are filtered before scoring: missing/private, age-restricted, and longer than 15 minutes (or the block's length if shorter, minimum 3) are dropped, then videos judged inappropriate or in the wrong language. generate-block-links accepts optional blockSubtype and blockDurationMinutes (old payloads still work); the page sends both.

## 2026-10-19 — Public release PR-1 (formerly TASK-027 on branch public-release, carried forward in TASK-030) — Public release phase 0: security hardening
Every model-calling route and every route that took a raw teacherUid now requires the
signed-in user's token (`require_org`), which also rejects unverified emails (403). A
client-sent teacherUid is optional and must match the token (else 403); the visibility
toggle and course sharing are owner-only, and sharing checks recipients are teachers in the
caller's org. Frontend: new `services/authFetch.js` used for all protected calls;
generate-curriculum and generate-blocks now show the server error instead of sticking on
"Starting... 0%"; the profile page's always-true isPublic is fixed. Left open by design:
synopsis and after-school routes (including their /enhance, /parse-flyer, /parse-food model
calls), /contact and /orgs/check-email. Verified by route audit, a stubbed-verifier check
script (13/13), lint (33, unchanged) and build; not run in a browser. No automated test
coverage for this module.

## 2026-10-19 — Public release PR-2 (formerly TASK-028 on branch public-release, carried forward in TASK-030) — Public release phase 1: public space and signup
Anyone with a verified email that matches no org now lands in the reserved `Users/public`
space (never domain-matched; an org domain or allowed email always goes to its org). New
POST /api/account/bootstrap creates the teacher doc (plan free), profile and an `org` custom
claim, enforces the signup cap in a transaction (waitlist past it) and is idempotent; GET
/api/account/me returns space and plan. `require_org` accepts bootstrapped public users.
check-email reports space and waitlist, and keeps the old answer until the space doc exists.
Frontend: signup no longer writes the teacher doc, login bootstraps, AuthContext exposes
space/plan/isPublicUser, new waitlist screen, Synopsis hidden for public users. Firestore
rules: claim-based access, a stricter `Users/public` block (private courses stay private,
plan/usage/waitlist closed to clients). Person-run: `scripts/create_public_space.py`
(dry-run first), then deploy backend and rules. Verified by check scripts, lint (33,
unchanged), build and reading; not run in a browser or rules emulator. No automated test
coverage for this module.

## 2026-10-19 — Public release PR-3 (formerly TASK-029 on branch public-release, carried forward in TASK-030) — Public release phase 2: monthly quotas
New usage service keeps per-user monthly counters (courses, generates, Edo tokens; UTC month)
at `Users/{org}/usage/{uid}/months/{YYYY-MM}`, written for everyone but limited only in the
public space (limits come from the `plans` map on `Users/public`, with defaults). Charges are
transactional and refunded when a route fails. Course builds count once (at generate-curriculum
or at save-course for uploads), AI generation routes count as generates, Edo counts real
tokens per reply. Over-limit requests get HTTP 402 `quota_exceeded` (kind, limit, used,
resets_at, plan); Edo chips are throttled to 30/min (429 `rate_limited`). New GET
/api/account/usage. Org users are unlimited and fail open. Verified by check scripts, an extra
FastAPI 0.109 refund/streaming check, lint (33, unchanged), build and reading. No automated
test coverage for this module.

## 2026-10-19 — Public release PR-4 (formerly TASK-030 on branch public-release, carried forward in TASK-030) — Public release phase 3: plan and usage screens
Frontend: public-space users now see a Free/Pro badge and usage meter (sidebar, own
profile), a single "limit reached" modal on any quota 402 (fired centrally from
`services/authFetch.js`, and from `chatWithEdo`), and an "Upgrade to Pro" request form that
posts to the existing contact route. Edo shows remaining allowance and disables input at
zero. Usage comes from `GET /api/account/usage` via a new `UsageContext`; org users never
fetch usage or see any of this. Backend: `routes/contact.py` accepts `type` "pro" in
addition to "demo" (demo behaviour unchanged).

## 2026-10-19 — Public release PR-5 (formerly TASK-031 on branch public-release, carried forward in TASK-030) — Public release phase 4: discovery and collaboration
Public space only; org behaviour unchanged. GET /api/teachers/ for public users returns
`{teachers, next_cursor}` (name-prefix search, cursor paging, only teachers with a public
course, caller excluded, no email); orgs still get the bare list. `has_public_courses` on the
teacher profile is kept in step on save, delete and visibility change. /api/notifications/share
accepts `recipient_emails` for public users (unknown and org emails both land in `not_found`;
self, over-20 and rate-limit errors; 503 only on an auth outage). Public-only guards on delete
and section writes; collaborators can read shared private courses. New composite index in
`frontend/firestore.indexes.json` (wired in firebase.json). Frontend: server search with Load
more, email-chip share modal, Public/Private wording, "private or no longer available" screens,
Edo 402 shows one message, old error wording restored for ordinary failures. Person-run: export
existing indexes, then deploy `firestore.indexes.json`. Open: org members can delete other
members' public courses and overwrite org sections (not changed). Verified by check scripts,
lint (32), build and reading; no automated test coverage for this module.

## 2026-10-19 — Public release PR-6 (formerly TASK-032 on branch public-release, carried forward in TASK-030) — Docs for the public release
ARCHITECTURE.md now documents the `Users/public` pseudo-org (space doc, plans, cap, usage,
waitlist), space resolution and the bootstrap flow, auth via `require_org`, the quota
contract (route table, counting and refund rules, 402/429, `/api/account/usage`),
public visibility, discovery and invite-by-email, the Firestore rules summary, refreshed
known gaps, and a "Public launch checklist" (person-run steps and non-code items).
CLAUDE.md gained a "Public space" note and an updated known-gaps entry. Docs only.

## 2026-10-21 — TASK-030 — Public release carried forward onto current main
Branch public-release (f4bd3fd) re-applied on main after the edcubeai-fdba7 migration and the Browserbase Links & Resources work. Merge fixes only: new Firestore clients use `firebase.project.firestore_client()` (database `default`); generate-block-links (Browserbase and legacy paths) gets token auth, the "generates" charge and refunds on swallowed failures; the block-links panel handles quota 402 without a second error; firestore.indexes.json merged. Old public-release entries relabelled PR-1..PR-6 so they do not clash with main's TASK-027..029; ARCHITECTURE.md and CLAUDE.md updated (project/database note, task references). Verified by import check, five check scripts, lint (27 errors, 5 warnings, within baseline), build and diff review; not run in a browser. No automated test coverage for this module.

## 2026-10-21 — TASK-031 — Accounts, plans, entitlements, admin, deactivation (backend)
Plans trial / teacher / org with every limit, the trial length (30 days, a placeholder), collaborator caps and feature flags in one place: `EdCube/platform_config` (code defaults in `services/platform_config.py`, cached 5 min). `Accounts/{uid}` holds plan, trial dates, bonus credits, memberships and status; `AdminAudit` logs every admin change. `services/entitlements.py` `can()` decides AI, sharing, invites and co-editing: an ended trial disables AI and new sharing (402 `plan_inactive`, upgrade message pointing to a waitlist, no prices) while viewing and manual editing always work; co-editing follows the course owner's plan, computed live (`update_section` and `/update-course`). Workspaces: header `X-EdCube-Workspace` (personal or the caller's org; no header keeps org members in their org); `Users/public` renamed `Users/personal` (old names kept as aliases). Admin routes under `/api/admin` (claim `admin`): set plan, grant credits, deactivate, reactivate. Self deactivate/reactivate with a 30-day grace (410 `grace_period_over` after). `/save-course` is no longer charged; `/generate-blocks` is plan-gated. Scripts: `setup_launch_accounts.py`, `purge_deactivated.py` (both dry-run by default), `create_personal_space.py`. Signup cap now off by default. Verified by import check, six check scripts, lint (within baseline), build and diff review; Firestore rules read only. No automated test suite.

## 2026-10-21 — TASK-032 — Signup and login: Google, organization waitlist, workspace switcher
Backend: org staff get the Teacher plan free in their personal workspace (`plan_source "org_member"`, admin-set plans never overwritten). Removed the never-live signup cap and capacity waitlist (`max_users`, `user_count`, `waitlisted`, `Users/personal/waitlist`). New `POST /api/waitlist` (open, validated, throttled per IP and email, stored in `PaidWaitlist`, emailed) and `GET /api/admin/waitlist` (+CSV, formula-escaped); rules deny `PaidWaitlist`. `purge_deactivated.py` now keeps the login and org data of anyone in an org (only personal content purged); the dry run prints a PATH line. Launch backfill moves org staff to Teacher.
Frontend: signup choice (individual via Google or email, organization via the waitlist form, no account created), Google sign-in with redirect fallback, `AuthContext` built around the active workspace and memberships, `X-EdCube-Workspace` header on every token-carrying call, sidebar workspace switcher (only with more than one workspace), plan labels (Free trial / Teacher / org name), deactivated-account message. Deleted `Waitlist.jsx` and its route. No prices anywhere.

## 2026-10-21 — TASK-033 — credit counters (reserve, confirm, refund)
Backend: `usage_service.py` rewritten around three counters (`courses`, `generates`, `edo_messages`; Edo now per message).
Credits are reserved in a Firestore transaction before a route runs and confirmed or refunded after it (streaming routes settle
when the stream ends); reservations expire after `credit_reservation_ttl_minutes`. Trial is a one-time allowance that never resets;
Teacher resets monthly on the `plan_started_at` anniversary (day clamped to month end, UTC, no rollover; `reset_rule: calendar`
available); orgs draw from a shared pool (`null` = unlimited, ICC). The presser pays in the workspace they act in. Admin-granted
bonus credits are spent after the plan allowance. Generate Course counts only when a usable course is produced; partial results are
logged through a `log_usage_event` hook for TASK-034. Added `GET /api/admin/accounts/{uid}/usage`; `GET /api/account/usage` now
returns per-kind credits (legacy `limits`/`usage` keys and an `edo_tokens` alias kept). Removed `check_and_increment`,
`add_usage`, `safe_add_usage` and the `legacy_edo_tokens_per_month` config. No frontend change.

## 2026-10-21 — TASK-034 — usage and cost log
Backend: every AI action now writes one `UsageLog/{autoId}` row (user, email domain, plan, workspace, action, credit kind, charged, course id, Browserbase search / fetch / render pages / sessions / seconds, LLM calls with model and tokens, success, error code, duration, time, estimated cost). A per-request collector (`services/cost_tracker.py`) is started by `enforce_quota`, `throttle_chips` and the new `track_ai`, and records at all LLM call sites and in `browserbase_client`; it reaches worker threads because `ThreadPoolExecutor.submit` now copies the submitter's context. The write runs in a two-thread background pool and fails open. Added `GET /api/admin/usage-log` (json or csv) and `GET /api/admin/cost-summary` (per action, per user, per credit kind). Prices live only in `platform_config.cost_rates` and are all 0 placeholders until filled in. Firestore rules deny all client access to `UsageLog`. No prompt or response content is stored. No frontend change, no credit behaviour change.

## 2026-10-21 — TASK-035 — Credit counters UI, per-feature pause, waitlist upgrade path, admin page
Backend: `GET /api/admin/accounts/recent` (declared before `/accounts/{uid}`); 402 `quota_exceeded` gains
`message` and `is_trial`; `/api/account/usage` gains `is_trial` and `trial_days_left`; the duplicate
`USAGE_LOG_COLLECTION` in `cost_tracker.py` removed; `partial.error` stores only the exception class name; the Edo
cost note uses `response.model`.
Frontend: `UsageContext` reads `credits` and exposes `useAiGate(kind)`; `UsageMeter` shows one counter per credit
type in the sidebar (hidden for unlimited org pools); only the exhausted feature pauses (Edo messages, generates,
courses), an ended trial pauses all AI with a message, and editing/saving/viewing never pause. `authFetch` handles
`plan_inactive`, `plan_upgrade_required` and 403 `account_deactivated`. New `JoinWaitlistModal` replaces
`UpgradeToProModal` (no payment, no price); new `/admin` page (accounts, waitlist, costs with CSV export through
`authFetch`), admin-only link in the sidebar.

## 2026-10-21 — TASK-036 (with TASK-041) — sharing and collaboration backend
Backend: new `services/sharing_service.py` and `routes/sharing.py`. View-only links (`ShareLinks/{token}`, 256-bit, revocable; public `GET /api/share/{token}` needs no account, returns a whitelisted read-only payload, 60/min/IP, one generic 404 for every unavailable case). Invites (`Invites/{id}`, 14-day expiry, emailed through `contact.send_notification_email(to=)`; the accepting account's verified email must match). Collaborator list, remove, leave, delete-impact counts and a live `access` route; `GET /api/curricula/{id}` carries an `access` field. Co-edit rights follow the OWNER's plan, computed live; a lapse makes every collaborator view-only, cancels pending invites and blocks new ones, a re-subscribe restores them. Max 3 collaborators per course for teachers, pending invites counted, rechecked after the write. Personal `isPublic`, the public teacher directory and `has_public_courses` are retired (410 on the visibility toggle, empty directory, 404 for others' profiles). Personal `/api/notifications/share` is now an alias onto the invite flow. TASK-041: course delete is owner-only in every workspace (and uses the request's workspace), section writes need owner or collaborate access in orgs too. Rules: `ShareLinks` and `Invites` denied to clients; personal curricula readable by owner / `sharedWithUids` only and clients cannot change sharing fields or the owner. Public payload cuts uploaded-file text out of every string. New env `FRONTEND_URL` (default https://edcube.org). Frontend: no change; TASK-037 builds the UI.

## 2026-10-22 — TASK-037 — sharing and collaboration frontend
New public pages `/share/:token` (read-only course from a view-only link, no account, no app chrome) and `/invite/:token` (invite landing; signed-out visitors sign up free or log in and come back, the token is kept through email verification and Google, then accepted, workspace switched, course opened). Personal share modal (`PersonalShareModal`): create and revoke view-only links, invite by email (edit or view), pending invites and collaborators with remove, a clear message at the 3-collaborator cap, and "Join the waitlist" in place of any upgrade or payment prompt; the org share modal is unchanged. Open courses follow the owner's plan live: `GET /api/curricula/{id}/access` polled every 30s and on focus for non-owners, plus the 403 codes on save; a lapse or removal switches to the read-only view or a no-access screen without dropping unsaved edits (kept in the editor, written to a local draft, copyable), and a re-subscribe restores editing and saves them. Collaborators and viewers get "Leave course". Course delete now goes through `DELETE /api/curricula/{id}` and the dialog names the collaborators, pending invites and links affected (`deleteCurriculum` removed from dbService). Personal workspace: Public/Private labels, the visibility toggle, Search and other people's profiles are retired. `authFetch` gains `quietBlock` and no longer signs a collaborator out when the course OWNER is deactivated. No backend change.

## 2026-10-22 — TASK-038 — forking audit and wording
Audit: no fork, copy or duplicate-course feature exists in the frontend or backend (only internal helpers), so nothing was removed. Landing page no longer mentions forking or remixing and no longer says "real-time" editing; it now describes sharing a course with view or edit access. Follow-ups from TASK-037: an invite page now forgets the remembered invite token when the invite is unavailable or expired, and sign-out clears local course drafts and any pending invite token (best effort, sign-out still works if storage fails).

## 2026-10-22 — TASK-042 — landing page redesign
Frontend: `LandingPage.jsx` rewritten. New order: hero, demo video, MLA framework, four flip cards, Create / Collaborate / Discover feature rows, Edo AI preview, mission and vision, audience marquee, founder, CTA. Sora only. Copy reworded to match what is built (no fork, public publishing, comments, real-time editing or citation promises). Photos and screenshots load from `frontend/public/landing/` with placeholders until the files are added (pending from the person).
