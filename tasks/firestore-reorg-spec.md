# Firestore reorganization spec: `EdCube` + `Users/{org}`

Covers TASK-006 to TASK-010 in `TASKS.md`. Decisions in this file were agreed with the
person on 2026-09-29. Don't re-litigate them. If the code contradicts something here,
file it under `## Needs Input`.

## Goal

Firestore currently has 18 top-level collections, mixing platform data, per-org data
and dead legacy data. After this work it has exactly two roots:

- `EdCube` — platform-wide data (the knowledge base).
- `Users` — one document per organization. Each org's data lives in subcollections
  under that document.

## Target tree

```
EdCube/                                  (collection)
└── knowledge_base                       (document)
    ├── curriculum/                      new, empty for now
    ├── pedagogy/                        ← kb_objectives
    ├── impact_partners/                 new, empty for now
    ├── content/                         ← kb_content_formats
    ├── worksheets/                      ← kb_worksheet_formats
    ├── activities/                      ← kb_activity_formats
    └── age/                             ← kb_age_bands

Users/                                   (collection)
├── icc                                  (document: { name, domains })
│   ├── curricula/
│   ├── teacher_profiles/
│   ├── teachers/
│   │   └── {uid}/ courseFolders/, libraryFolders/
│   ├── notifications/                   short-lived inbox (see below)
│   └── synopsis/                        (collection with exactly 2 documents)
│       ├── afterschool                  (document)
│       │   ├── months/                  ← afterschool_synopsis_months
│       │   └── entries/                 ← afterschool_synopsis
│       └── summer_camps                 (document)
│           └── weeks/{week}/camps/{camp}/entries/   ← synopsis/ICC/weeks/...
└── test-org                             (document: same subcollection set as icc)
```

Firestore paths alternate collection → document → collection. Every intermediate
document (`EdCube/knowledge_base`, `Users/icc`, `Users/test-org`,
`Users/{org}/synopsis/afterschool`, `Users/{org}/synopsis/summer_camps`) must be a real
document with at least one field. That keeps it visible in the console and stops it
being a "phantom" doc.

## Old → new mapping (live counts as of 2026-09-29)

| Old path | Docs | New path |
|---|---|---|
| `curricula` | 23 (22 `icc`, 1 `test-org`, by `organizationId`) | `Users/{organizationId}/curricula` |
| `teacher_profiles` | 11 (all `icc`, by `org_id`) | `Users/{org_id}/teacher_profiles` |
| `teachers` (+ `courseFolders`, `libraryFolders`) | 13 (12 `icc`, 1 `ICC`, by `organization`) | `Users/{organization lowercased}/teachers`, with subcollections |
| `notifications` | 4 | `Users/{recipient org}/notifications` |
| `synopsis/ICC/weeks/**` | — | `Users/icc/synopsis/summer_camps/weeks/**` (same nesting) |
| `afterschool_synopsis_months` | 4 | `Users/icc/synopsis/afterschool/months` |
| `afterschool_synopsis` | 30 | `Users/icc/synopsis/afterschool/entries` |
| `kb_objectives` | 5 | `EdCube/knowledge_base/pedagogy` |
| `kb_age_bands` | 4 | `EdCube/knowledge_base/age` (doc IDs unchanged) |
| `kb_content_formats` | 3 | `EdCube/knowledge_base/content` |
| `kb_worksheet_formats` | 10 | `EdCube/knowledge_base/worksheets` |
| `kb_activity_formats` | 8 | `EdCube/knowledge_base/activities` |
| `leads` | 2 | **Dropped.** Not migrated; deleted in TASK-010. |
| `synopsis_weeks`, `synopsis_camps`, `synopsis_entries`, `synopsis_food` | 2/40/10/1 | **Dropped.** Legacy, already migrated by `scripts/migrate_synopsis.py`, unreferenced. |
| `worksheet_pdfs` | 2 empty phantom docs | **Dropped.** Unreferenced. |

Worksheet PDFs aren't stored separately. Worksheets live inside curriculum docs and
PDFs are rendered on demand, so no extra move is needed.

## Agreed decisions

1. **Naming:** the roots are `EdCube` and `Users`, exactly as cased here. The name
   "synopsis" stays in the database and the UI.
2. **Org IDs** are the existing `org_id` values (`icc`, `test-org`). Normalize the one
   `teachers` doc with `organization: 'ICC'` to `'icc'`.
3. **Resolving the org in the backend:** add `resolve_org(uid)` =
   `get_org_from_email(auth.get_user(uid).email)` (Admin SDK, cached in-process). It
   reuses `DOMAIN_ORG_MAP` / `get_org_from_email` in `backend/schemas/teacher_schema.py`.
   Don't look the org up in Firestore. Sharing and public courses are same-org only
   today, so the caller's org is always the course's org.
4. **Synopsis routes** (`routes/synopsis.py`, `routes/afterschool_synopsis.py`) have no
   auth and are ICC-specific. Use a single constant `DEFAULT_SYNOPSIS_ORG = "icc"`,
   which replaces the hardcoded `'ICC'` in `FirebaseService._weeks_col()`. Multi-org
   synopsis is out of scope.
5. **Leads removed:** `routes/contact.py` stops writing to Firestore. The email to the
   team stays exactly as it is.
6. **Notifications are delete-on-seen:** the collection stays, as an inbox until the
   teacher sees them. When the teacher opens the bell, the list loads and displays, and
   then those notifications are deleted server-side. This replaces today's `markAllRead`
   in `frontend/src/components/notifications/NotificationBell.jsx`. The `/read`
   endpoints and the `status` field are removed. It's safe because sharing is already
   applied through the course's `sharedWith` list, so "Shared with me" is unaffected.
7. **The knowledge base keeps its function signatures:** `knowledge_base_service.py`
   getters (e.g. `get_objectives()`) keep their names, signatures and return shapes.
   Only the paths change. Callers in prompt_builder, outliner and generation must not
   need edits.
8. **Cloud Storage paths** (`course_attachments/`, `synopsis/`, `afterschool_synopsis/`)
   are out of scope. Existing download URLs keep working.
9. **Composite indexes** are keyed by collection ID, so the existing `curricula` indexes
   should apply to the nested subcollections. Confirm this during TASK-009.

## Path helpers — no raw collection strings anywhere else

- `backend/firebase/paths.py`: `ORGS_ROOT = "Users"`, `PLATFORM_ROOT = "EdCube"`,
  `org_doc(db, org)`, `org_col(db, org, name)`, `kb_col(db, category)`, plus synopsis
  helpers (`afterschool_doc(db, org)`, `summer_camps_doc(db, org)`).
- `frontend/src/firebase/paths.js`: the same shape for the web SDK.

## Per-task scope

### TASK-006 — backend (backend-agent)
- Add `backend/firebase/paths.py`.
- `services/firebase_service.py`:
  - Replace `self.curricula_collection` with an org-scoped accessor.
  - Thread `org` / `resolve_org(uid)` through the curriculum, profile and notification
    methods.
  - Point the synopsis helpers (`_weeks_col`, `_afterschool_months_col`,
    `_afterschool_entries_col`) at the new paths.
  - Replace `mark_notification_read` with a delete-seen method.
- Other files to update:
  - `routes/teachers.py`
  - `routes/curriculum.py` (~502, ~532)
  - `routes/notifications.py`
  - `routes/contact.py` (drop the leads write)
  - `firebase/dbServices.py`
  - `services/knowledge_base_service.py`
  - `scripts/seed_knowledge_base.py` (new category names; also creates the
    `EdCube/knowledge_base` doc)
- `schemas/teacher_schema.py`: the `*_COLLECTION` constants become subcollection names.
- Rewrite `frontend/firestore.rules` for the new tree:
  - `Users/{orgId}/**` is readable and writable only by users whose token email domain
    maps to `orgId`.
  - Keep the per-teacher owner rules for folders.
  - `EdCube/knowledge_base/**` is read-only for authenticated users.
- Don't deploy anything.

### TASK-007 — migration script (backend-agent)
- Write `backend/scripts/migrate_to_org_tree.py` implementing the mapping table above.
- Behaviour:
  - It recursively copies each document and its subcollections, and never deletes.
  - Dry run is the default and prints source → destination with per-collection counts.
  - `--apply` performs the writes.
  - It is idempotent (`set` with the same doc IDs).
  - It creates all intermediate documents.
- Add a `--delete-old` flag for TASK-010. It must refuse to run unless the destination
  counts match the source counts.
- Run it only in dry-run mode as part of this task.

### TASK-008 — frontend (frontend-agent)
- Add `frontend/src/firebase/paths.js`.
- Update `firebase/dbService.js`, `firebase/authService.js` and
  `constants/blockCategories.js` (now `EdCube/knowledge_base/pedagogy`). Pass the org
  from `getOrgFromEmail(currentUser.email)`.
- Update the callers only where signatures change: `MyCourses.jsx`,
  `AddFolderModal.jsx`, `LibraryPickerModal.jsx`, `BlockView.jsx`, `CourseWorkspace.jsx`.
- `NotificationBell.jsx` / `useNotifications`: delete-on-open per decision 6, and drop
  the unread/read state that relied on `status`.
- Overlap with TASK-001: that task routes blockCategories through the backend. This task
  only changes the Firestore path.

### TASK-009 — cutover (person-run)
1. Run the migration with `--apply`.
2. Deploy the backend (Cloud Run), the frontend (hosting) and the rules
   (`firebase deploy --only firestore:rules`).
3. Re-run the migration with `--apply` to catch writes made in between.
4. Run the smoke test below and check the indexes.

### TASK-010 — cleanup (explicit approval required)
- Look at the 2 `leads` docs first.
- Then run the migration with `--delete-old`. This removes the old top-level
  collections, `leads`, the `synopsis_*` legacy collections and `worksheet_pdfs`.

## Verification
- **Dry run:** every live doc maps to exactly one destination, and the counts match the
  table above.
- **After `--apply`:** source and destination counts match per collection,
  subcollections included.
- **App smoke test:**
  - Log in, and see courses listed in My Courses.
  - Open, edit, save and delete a course.
  - Create a course folder and a library folder.
  - Public courses and the teacher directory show only the org's teachers.
  - Share a course. The recipient sees the notification; after they open the bell the
    doc is gone from `Users/icc/notifications`, and the course still shows under
    "Shared with me".
  - The camp and afterschool synopsis admin and teacher views load, and a photo upload
    works.
  - The contact form still sends its email and writes nothing to Firestore.
  - Block categories load from `EdCube/knowledge_base/pedagogy`.
- **Rules:** an `icc` user can read `Users/icc/curricula/*` but not
  `Users/test-org/*`.
- **Docs:** `docs-qa-agent` updates the Firestore section of `ARCHITECTURE.md`,
  `CLAUDE.md` where it lists collections, and `CHANGELOG.md`.

---

## Round 2 — org isolation hardening (agreed 2026-09-30)

These rules override Round 1 wherever they conflict. In particular they replace decision 3
(`resolve_org` via a hardcoded `DOMAIN_ORG_MAP` with an 'icc' fallback), decision 8
(Storage out of scope), the afterschool layout, and the `test-org` migration.

### Rules from the person
1. **No cross-org lookups, ever.** Every request knows its org, and every read/write is a
   direct path under `Users/{org}/…`. That means no `collection_group` queries anywhere in
   the backend.
2. **Unregistered emails get nothing.** There is no default org. Backend, rules and
   frontend all agree.
3. **Searching within an org must be efficient.** No "stream the whole collection and
   filter in Python."
4. **The folder location is the org tag.** Don't add org fields to every item. Course docs
   keep `organizationId` only as a harmless leftover, and nothing relies on it.
5. `test-org` is dropped. It was only an example of a new org's shape and is not migrated.

### A. Org registry: a single source of truth
- `Users/{org}` doc: `{ name, domains: [...], allowed_emails: [...] }`.
  - ICC: `name: "India Community Center"`, `domains: ["indiacc.org"]`,
    `allowed_emails: ["manaswini.ayala@gmail.com"]`. That address is the founder's test
    account, the only existing non-indiacc account, and it's grandfathered in.
  - `gmail.com` is no longer a domain.
- Match rule: an email belongs to an org if its domain (lowercased) is in `domains`, OR
  the full lowercased email is in `allowed_emails`. If nothing matches, the result is
  `None`, and the backend never falls back to a default.
- Backend:
  - `get_org_from_email` reads the org docs, cached in-process with a short TTL (a few
    minutes is fine).
  - Remove `DOMAIN_ORG_MAP` and the 'icc' default.
  - Add one shared FastAPI dependency, e.g. `require_org`: it verifies the token, maps
    email → org, and otherwise returns 403 "Your organization is not registered with
    EdCube". Every org-scoped route uses it.
  - Routes that receive a raw `teacherUid` without a token: prefer switching them to
    the token. If a route can't be switched without a frontend change, list it for
    TASK-008.
- New public endpoint `GET /api/orgs/check-email?email=` → `{allowed, org_id, org_name}`,
  used by frontend signup.
- `firestore.rules`: org membership is checked by `get()`-ing `Users/{orgId}` and applying
  the same match rule. Remove the hardcoded domain list.

### B. Remove every cross-org lookup
- Edo chat (`POST /api/curriculum/chat`):
  - Require auth; it's currently unauthenticated.
  - The org comes from the token, and the course is read only from
    `Users/{org}/curricula/{courseId}`.
  - Edo's scope stays the single course being chatted about. No new context.
- Populate-section (`routes/topics.py`): org from the token, passed to `update_section`.
- Delete `_find_curriculum_ref`. `org` is required on every curriculum method.
- Synopsis (summer camps):
  - Delete the `collection_group('camps'/'entries')` methods and use the existing
    direct-path methods.
  - `GET /synopsis/entries/{id}` requires `week_id` and `camp_id`. Check
    `frontend/src/services/synopsisService.js` and report any caller that doesn't send
    them, for TASK-008.
- Delete the dead `backend/firebase/dbServices.py` (zero importers).

### C. Afterschool synopsis: entries inside their month
- Path: `Users/{org}/synopsis/afterschool/months/{monthId}/entries/{entryId}`. The flat
  `afterschool/entries` collection goes away.
- Entry IDs stay `{grade_slug}__{type_slug}__{month_id}`.
- Deleting a month deletes its entries. This was confirmed by the person and replaces the
  old "no cascade" behaviour.

### D. Efficient in-org search
- "Shared with me":
  - Add a `sharedWithUids` array kept in sync by add/remove-shared-with.
  - Query with `array_contains` instead of streaming every course.
  - The migration backfills it.
- My Courses and public courses are already direct queries inside one org. Keep them that
  way.

### E. Storage under the org
- New uploads go under `Users/{org}/…`:
  - `Users/{org}/course_attachments/…`
  - `Users/{org}/synopsis/summer_camps/…`
  - `Users/{org}/synopsis/afterschool/…`
- Existing files and their links stay put. Moving them is TASK-011.

### F. Migration additions (TASK-007)
- Create `Users/icc` with `name`, `domains` and `allowed_emails`.
- Copy old `afterschool_synopsis` docs under their month (using their `month_id`).
- Backfill `sharedWithUids`.
- Skip `test-org`.

### G. Frontend additions (TASK-008)
- Signup uses `/api/orgs/check-email`. Delete the frontend `DOMAIN_ORG_MAP`.
- The org for Firestore paths comes from the teacher profile or the check-email response.
- Send the auth token on Edo chat, populate-section, and any route TASK-006b moved to
  token-based auth.
- Synopsis callers send `week_id`/`camp_id` where TASK-006b requires them.

### Round 2 verification
- `grep -rn "collection_group\|DOMAIN_ORG_MAP\|_find_curriculum_ref" backend frontend/src`
  (excluding `.venv`, `node_modules`) returns nothing.
- `import main` succeeds.
- Match rule, unit-checked with a stubbed org registry:
  - `x@unknown.com` → None
  - `someone@gmail.com` → None
  - `manaswini.ayala@gmail.com` → icc
  - `a@indiacc.org` → icc
- Edo chat without a token → 401. An org-scoped route with an unregistered email → 403.
