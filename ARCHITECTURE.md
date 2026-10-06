# EdCube — Architecture

Read-only source of truth for all agents except `docs-qa-agent`. Reflects the actual
codebase in `m-ayala/edcube_mvp`, not an aspirational design — update this file as real
structure changes, don't let it drift from what's actually in the repo.

## Stack

- **Frontend:** React/Vite, Firebase Hosting, Firebase Auth (client SDK)
- **Backend:** FastAPI on Cloud Run, Firestore, Firebase Admin SDK
- **AI generation:** Gemini (content + image-prompt generation), Imagen 3 (line art),
  Claude (Edo's backbone)
- **Output rendering:** Puppeteer (HTML → PDF, worksheets and camp synopses),
  pptxgenjs (PPT decks)
- **Content discovery:** YouTube Data API v3, YouTube transcript API, Google Custom
  Search API (worksheets/activities)
- **Infra:** Google Cloud (Secret Manager, Cloud Run, Container Registry), Firebase

## Repo layout (top level)

```
backend/
  routes/            → curriculum, resources, topics, teachers
  services/           → orchestrator.py, prompt_builder.py, firebase_service.py,
                        knowledge_base_service.py (backend-agent builds/owns this)
  schemas/             → curriculum_schema.py, teacher_schema.py
  scripts/             → seed_knowledge_base.py (kb_* seed script)
  outliner/            → Phase 1 — outline_generator.py, outline_prompts.py, main.py
  populator/           → Phase 2 — youtube_handler.py, transcript_handler.py,
                          content_analyzer.py, video_filter.py, channel_database.py
  requirements.txt
frontend/
  src/
    constants/          → curriculumSchema.js (mirrors backend/schemas/curriculum_schema.py)
    components/
  package.json
```

## The three-phase pipeline

1. **Outliner (Phase 1)** — teacher input → generated course structure (sections,
   subsections, blocks/"boxes"). Owned by `structure-agent`.
2. **Populator (Phase 2)** — for each section, generates search queries, searches
   YouTube, pulls transcripts, filters by channel tier/coverage/WPM/redundancy, dedupes
   globally. Owned by `generation-agent`.
3. **Worksheets & Activities (Phase 3)** — generates worksheet and activity options per
   section via Gemini + Imagen 3, rendered through Puppeteer/pptxgenjs. Owned by
   `generation-agent`.

A fourth layer, **Phase 1.5 (subsection ideation)**, sits between Outliner and full
content generation: a matrix UI lets teachers select subsection chains and override
individual blocks before generation begins. This is `structure-agent` territory since
it operates on the Course→Section→Subsection→Block hierarchy before Phase 2/3 content
exists.

## Data model — Firestore

**Firestore reorg in progress (TASK-006 to TASK-010, see
`tasks/firestore-reorg-spec.md`).** The tree is being collapsed from 18 flat top-level
collections down to two roots, `EdCube` (platform-wide) and `Users` (per-organization).
As of TASK-006b, the *backend code* (`backend/firebase/paths.py` and every service/route
that touches Firestore) reads and writes the new tree shape below. As of TASK-008, the
*frontend code* (`frontend/src/firebase/paths.js` and every component that touches
Firestore) does too — there is no raw `collection(db, ...)`/`doc(db, ...)` call left
outside `paths.js`. As of TASK-007,
`backend/scripts/migrate_to_org_tree.py` exists and copies every mapping in
`tasks/firestore-reorg-spec.md`'s "Old → new mapping" table (plus the Round 2 additions —
the `Users/icc` registry doc, afterschool entries nested under their month, and the
`sharedWithUids` backfill) into the new tree; it is copy-only (never deletes the old
collections) and idempotent (`.set()` on the same doc ids). Run from `backend/`:
`.venv/bin/python scripts/migrate_to_org_tree.py` for a read-only dry run (the default —
prints a source → destination plan, writes nothing), add `--apply` to perform the copy,
and `--delete-old --yes-really` (TASK-010 only) to remove the old top-level collections
once the destination counts have been verified to match. But the *data itself has not
been migrated for real yet* — only a dry run has been run (that happens in TASK-009's
cutover) — and nothing has been deployed. Until TASK-009 runs, the new-tree backend code
is inert on `main`/production, which still runs the old code against the old flat
collections. Don't deploy `backend_cleanup` on its own.

### Target tree

```
EdCube/knowledge_base                                (doc)
├── pedagogy/            ← was kb_objectives
├── age/                 ← was kb_age_bands
├── content/             ← was kb_content_formats
├── worksheets/          ← was kb_worksheet_formats
└── activities/          ← was kb_activity_formats

Users/{org}                                          (doc: { name, domains: [...], allowed_emails: [...] })
├── curricula/                                       sharedWithUids[] kept in sync for fast "shared with me"
├── teacher_profiles/
├── teachers/{uid}/courseFolders/, libraryFolders/
├── notifications/                                   delete-on-seen inbox
└── synopsis/
    ├── afterschool (doc) → months/{monthId}/entries/{entryId}   (entries nested inside their month)
    └── summer_camps (doc) → weeks/{week}/camps/{camp}/entries/
```

Only `icc` is a real org today — Round 2 (TASK-006b) dropped `test-org` entirely; it was
only ever an example org shape and was never migrated.

All backend Firestore access goes through `backend/firebase/paths.py` (`org_doc`,
`org_col`, `kb_col`, `afterschool_entries_col`, `resolve_org`, etc.) — no module outside
that file should hold a raw `.collection('some_name')` string for org- or KB-scoped
data, and there is no `collection_group()` query anywhere in the backend (Round 2
removed the last ones — see "Org resolution" and the curricula note below).

### Org resolution (Round 2 — no default org, ever)

The org for a request is resolved via a registry, not a hardcoded map:
- **Registry:** `backend/firebase/org_registry.py` reads every `Users/{org}` doc's
  `{ name, domains: [...], allowed_emails: [...] }` fields and caches them in-process
  with a short TTL (5 min). `match_org(email, registry)` is a pure function (no
  Firestore access) so the matching rule itself is unit-testable against a stubbed
  registry: an email matches an org if its lowercased domain is in that org's `domains`,
  OR the full lowercased email is in `allowed_emails`. No match → `None`. There is no
  default/fallback org — callers must treat `None` as "not allowed."
- **`get_org_from_email(email)`** (re-exported from `backend/schemas/teacher_schema.py`
  for existing callers) and **`resolve_org(uid)`** (in `backend/firebase/paths.py`,
  looks the uid's email up via the Admin SDK first) both wrap the registry.
- **`require_org`** (FastAPI dependency in `routes/teachers.py`): verifies the Firebase
  ID token, resolves `org` from the token's email, and 403s with "Your organization is
  not registered with EdCube" if it's `None`. Returns the decoded token plus an `org`
  key. Token-based routes (Edo chat, populate-section, notifications, shared-with,
  profile/discovery) use this.
- **`require_org_for_uid(uid)`**: the same 403 contract for routes that still take a raw
  `teacherUid` query/body param instead of a bearer token (most of `routes/curriculum.py`'s
  older endpoints — `get-curriculum`, `list-curricula`, `delete-curriculum`,
  `save-course`, `my-courses`, `update-course`, course-attachment routes,
  `topics.py`'s `get_section`). TASK-008 (the frontend half of this reorg) didn't need to
  touch these — no current frontend caller of them changed signature — so they're still
  open for a future move to token-based auth; until then they resolve org server-side
  from the uid and never trust a client-supplied `organizationId` for the actual
  Firestore path.
- **`GET /api/orgs/check-email?email=`** (`routes/orgs.py`, no auth — mirrors
  `POST /contact`'s unauthenticated posture since there's no token before signup):
  returns `{allowed, org_id, org_name}`. As of TASK-008, the frontend's
  `firebase/authService.js` (`checkEmailOrg`) calls this for signup *and* login, and
  `contexts/AuthContext.jsx` calls it on every auth-state change to resolve
  `org`/`orgName`/`orgError` for the whole app via `useAuth()` — there is no frontend
  `DOMAIN_ORG_MAP` any more, so the frontend and backend/rules now agree on the same
  registry-backed answer.
- Sharing and public courses are same-org only, so once a request's org is resolved,
  every Firestore read/write for it is a direct path under `Users/{org}/…` — never a
  cross-org lookup.

Field names for a curriculum document are defined once in
`backend/schemas/curriculum_schema.py` (`CurriculumFields`, `SectionFields`,
`TopicFields`) and mirrored in `frontend/src/constants/curriculumSchema.js`. **These two
files must be kept in sync — this is the same hardcoded-mirror problem
`blockCategories.js` had; any agent editing one must check the other.** Ownership:
`backend-agent` owns the Python source of truth, `frontend-agent` owns the JS mirror,
and a schema change is always a two-file task across both agents in the same task, not
something either does alone.

**`Users/{org}/curricula/{id}`** — key fields:
- `courseId`, `teacherUid`, `teacherEmail`, `organizationId`
- `courseName`, `class` (grade), `subject`, `topic`, `timeDuration`, `objectives`
- `outline.sections[]` — each section has `id`, `title`, `description`,
  `duration_minutes`, `topics[]`, `pla_pillars[]`, `learning_objectives[]`,
  `content_keywords[]`, plus Phase 2 fields (`video_resources`,
  `search_queries_used`, `content_coverage_status`) and Phase 3 fields
  (`worksheet_options`, `activity_options`, `needs_worksheets`, `needs_activities`)
- `isPublic`, `sharedWith[]`
- `createdAt`, `lastModified`

Note: curricula documents created via the backend (`FirebaseService.save_curriculum`)
always set `courseId`. The frontend's own `firebase/dbService.js` used to have a
separate, direct-Firestore `saveCurriculum` writer targeting the old flat `curricula`
collection; TASK-008 deleted it as dead code (zero importers — curriculum
creation/update already went exclusively through the backend's `/api/save-course` and
`/api/update-course`), so this `courseId` gap no longer has a live write path that could
reproduce it. Round 2 (TASK-006b) deleted the `_find_curriculum_ref()`
collection-group helper entirely (`collection_group('curricula').where('courseId', ...)`)
— every curriculum method now takes `org` as a required parameter and reads/writes a
direct `Users/{org}/curricula/{document_id}` path instead. The Edo chat endpoint looks
up `request.context.courseId` as a **document ID** under the caller's own org
(`firebase.curricula_col(org).document(course_id).get()`), not via the `courseId`
*field*, so the old courseId-field gap no longer affects it; that lookup is still
best-effort (wrapped in try/except) since it's supplementary chat context, not a hard
requirement. No collection-group index is needed anywhere in the backend anymore.

**`Users/{org}/teacher_profiles/{uid}`** — `teacher_uid`, `display_name`, `email`,
`subjects_taught[]`, `grades_taught[]`, `bio`, `profile_picture_url`, `org_id`

**`Users/{org}/teachers/{uid}/courseFolders/`, `libraryFolders/`** — organizational
grouping for a teacher's courses and library resources.

**`Users/{org}/notifications/{id}`** — delete-on-seen inbox: the bell loads the list,
then the frontend calls `POST /api/notifications/seen` with the ids just shown, which
deletes them server-side. There's no `status` field and no `/read` endpoint.

**Afterschool synopsis (Round 2 — TASK-006b, section C):** entries live nested inside
their month — `Users/{org}/synopsis/afterschool/months/{monthId}/entries/{entryId}` —
not in a flat sibling `entries` collection. Deleting a month cascades to delete every
entry under it (`FirebaseService.delete_month`). Entry IDs are still the deterministic
`{grade_slug}__{type_slug}__{month_id}` composite key.

**"Shared with me" (Round 2 — TASK-006b, section D):** courses keep a `sharedWithUids`
array (flat list of uids) alongside the existing `sharedWith` list of `{uid,
accessType}` objects. `GET /api/curricula/shared-with-me` queries
`sharedWithUids array_contains uid` directly instead of streaming every course in the
org and filtering in Python. `sharedWith` stays the source of truth for `accessType`;
`sharedWithUids` is kept in sync by `add_shared_with`/`remove_from_shared_with`.

**Storage (Round 2 — TASK-006b, section E):** new uploads for course attachments and
synopsis (camp + afterschool) photos go under `Users/{org}/course_attachments/…`,
`Users/{org}/synopsis/summer_camps/…` and `Users/{org}/synopsis/afterschool/…`.
Synopsis routes have no auth and are ICC-only today, so they use a
`DEFAULT_SYNOPSIS_ORG = "icc"` constant for the storage prefix (same constant used for
the Firestore synopsis paths). Existing files and their stored download URLs are
untouched — moving them is TASK-011. As of TASK-007, new profile-picture uploads also go
under `Users/{org}/profile_pictures/{uid}/…` (`routes/uploads.py`, via the `require_org`
dependency); old `profile_pictures/{uid}/…` download URLs already stored on teacher
profiles are unaffected since they're already-issued absolute Storage URLs, not
reconstructed paths.

**`EdCube/knowledge_base/{pedagogy,age,content,worksheets,activities}`** (and future
`curriculum`, `impact_partners`) — the taxonomy knowledge base, was
`kb_age_bands`/`kb_objectives`/`kb_worksheet_formats`/`kb_activity_formats`/
`kb_content_formats`. Owned exclusively by `backend-agent`; see the KB ownership rule in
`CLAUDE.md`. `knowledge_base_service.py`'s public functions (`get_age_bands()`,
`get_objectives()`, etc.) kept their names, signatures and return shapes across this
move — only the underlying Firestore path changed, so `prompt_builder.py`, the outliner
and generation callers needed no edits. These replace pedagogy that used to be
hardcoded across prompt files and `blockCategories.js`.

As of TASK-008, `frontend/src/constants/blockCategories.js` reads
`EdCube/knowledge_base/pedagogy` (via `firebase/paths.js`'s `kbCol`) instead of the old
flat `kb_objectives` collection. It's still a direct Firestore read from the frontend,
not a backend endpoint — see "Known architectural debt" below — but the path itself now
matches the backend's tree.

## Agent-to-code ownership map

| Code area | Owning agent |
|---|---|
| `backend/services/orchestrator.py`, `curriculum_schema.py`, `prompt_builder.py`, FastAPI routes, Firestore/auth setup, Cloud Run config | `backend-agent` |
| `backend/services/knowledge_base_service.py` (all `kb_*` collections) | `backend-agent` (sole writer) |
| `backend/outliner/**`, Phase 1.5 subsection ideation, Edo | `structure-agent` |
| `backend/populator/**`, worksheet/activity/PPT generation | `generation-agent` |
| `frontend/src/**` (including `blockCategories.js`, `curriculumSchema.js`) | `frontend-agent` |
| `tests/`, `*.md` | `docs-qa-agent` |

`structure-agent` and `generation-agent` read KB taxonomy by importing functions from
`backend/services/knowledge_base_service.py` — they never query Firestore's `kb_*` collections
directly, and never edit `knowledge_base_service.py`.

## Known architectural debt (update as these close)

- `frontend/src/.../blockCategories.js` reads `EdCube/knowledge_base/pedagogy` directly
  from Firestore in the browser (as of TASK-008 — the path is current, not stale) rather
  than fetching from a backend endpoint. That's the open item: see `TASKS.md`'s TASK-001
  for the plan to expose `knowledge_base_service.get_objectives()` via a FastAPI route
  and move this read server-side.
- No automated test suite exists yet (no pytest, no jest/vitest — only eslint on the
  frontend). `docs-qa-agent` verifies by other means until this is built out.
- The knowledge base collections (`kb_*`, now `EdCube/knowledge_base/*` in the backend
  code — see "Data model — Firestore" above) are being built out but not yet wired into
  generation prompts — `prompt_builder.py` may still contain some hardcoded pedagogy
  that should eventually pull from `knowledge_base_service.py` instead.
- Several `routes/curriculum.py` and `routes/topics.py` endpoints still take a raw
  `teacherUid` query/body param instead of a bearer token (see "Org resolution" above
  for the list) — each one calls `require_org_for_uid(teacherUid)` so unregistered
  emails still 403 correctly, but a client could still pass someone else's uid as a
  parameter value (no signature/token proves the caller *is* that uid on these specific
  routes). These were out of TASK-008's file list (no current caller needed a signature
  change to send a token) and remain open for whenever that's prioritized.
- The collection-group query that used to back `_find_curriculum_ref()` is gone — Round
  2 (TASK-006b) deleted it along with every other `collection_group()` call in the
  backend (synopsis camp/entry lookups included). No collection-group index is needed
  anywhere in the backend anymore; ignore any pre-TASK-006b note that said otherwise.

## Agentic dev system (meta — how this repo is built)

This repo is developed using a task-queue-driven multi-agent Claude Code setup. See
`CLAUDE.md` for the full explanation, `TASKS.md` for the active queue, and
`.claude/agents/*.md` for each agent's exact ownership and rules. This section exists so
that anyone (including a future agent) reading `ARCHITECTURE.md` understands that the
codebase itself is built this way, not just documented this way.