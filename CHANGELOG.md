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
