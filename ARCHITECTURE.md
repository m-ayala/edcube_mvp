# EdCube — Architecture

Read-only source of truth for all agents except `docs-qa-agent`. Reflects the actual
codebase in `m-ayala/edcube_mvp`, not an aspirational design — update this file as real
structure changes, don't let it drift from what's actually in the repo.

## Stack

- **Frontend:** React/Vite, Firebase Hosting, Firebase Auth (client SDK)
- **Backend:** FastAPI on Cloud Run, Firestore, Firebase Admin SDK. Firebase project
  `edcubeai-fdba7`; the Firestore database is the named database `default` (not the implicit
  `(default)`), so every backend Firestore client must come from
  `firebase.project.firestore_client()`, never a bare `firestore.client()`.
- **AI generation:** Gemini (content + image-prompt generation), Imagen 3 (line art),
  Claude (Edo's backbone)
- **Output rendering:** Puppeteer (HTML → PDF, worksheets and camp synopses),
  pptxgenjs (PPT decks)
- **Content discovery:** YouTube Data API v3, YouTube transcript API, Google Custom
  Search API (worksheets/activities, legacy path); block Links & Resources (articles, images, videos) uses
  Browserbase search/fetch (`RESOURCE_SEARCH_PROVIDER=legacy` restores the YouTube path)
- **Infra:** Google Cloud (Secret Manager, Cloud Run, Container Registry), Firebase

## Repo layout (top level)

```
backend/
  routes/            → curriculum, resources, topics, teachers, knowledge_base, account, orgs,
                        notifications, contact, course_builder, file_upload, uploads, synopsis
  services/           → orchestrator.py, prompt_builder.py, firebase_service.py,
                        knowledge_base_service.py (backend-agent builds/owns this)
  schemas/             → curriculum_schema.py, teacher_schema.py
  scripts/             → seed_knowledge_base.py (EdCube/knowledge_base seed script),
                        create_personal_space.py, setup_launch_accounts.py, purge_deactivated.py
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

**Firestore reorg complete (TASK-006 to TASK-010, see `tasks/firestore-reorg-spec.md`).**
The 18 flat top-level collections were collapsed into two roots, `EdCube` (platform-wide)
and `Users` (per-organization). The old collections were deleted on 2026-10-05 (TASK-010,
after a full local backup); the live database's only root collections are `EdCube` and
`Users`. Backend code (`backend/firebase/paths.py`) and frontend code
(`frontend/src/firebase/paths.js`) read and write only the new tree; there is no raw
`collection(db, ...)`/`doc(db, ...)` call outside those two files. The migration scripts
are kept for reference. `backend/scripts/migrate_to_org_tree.py` copies each mapping in
`tasks/firestore-reorg-spec.md` into the new tree (dry run by default; `--apply` copies;
`--delete-old --yes-really` deletes the old top-level collections only if destination
counts are at least the eligible source counts; `--allow-fewer-notifications` is an opt-in
exception for the notifications mapping only, because that inbox is delete-on-seen).
Recursive deletes use `list_documents()` so phantom parent docs are traversed. All of it
is no longer needed for normal operation; do not re-run `--apply` casually, as the old
sources no longer exist.

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
├── usage/{uid|_pool}/periods/{period_id|bonus}      backend-only credit counters (TASK-033); legacy months/ no longer written
└── synopsis/
    ├── afterschool (doc) → months/{monthId}/entries/{entryId}   (entries nested inside their month)
    └── summer_camps (doc) → weeks/{week}/camps/{camp}/entries/

Users/personal                                       (doc: reserved personal-workspace pseudo-org, see below)
└── curricula/, teacher_profiles/, teachers/{uid}, notifications/   (same shapes as an org)

EdCube/platform_config                               (doc: plan limits, trial length, caps; backend-written)
Accounts/{uid}                                       (plan, trial dates, credits, memberships, status; backend-written)
AdminAudit/{autoId}                                  (one doc per admin/self account change; backend-only)
PaidWaitlist/{autoId}                                (paid / enterprise interest list, TASK-032; backend-only)
```

Only `icc` is a real org today — Round 2 (TASK-006b) dropped `test-org` entirely; it was
only ever an example org shape and was never migrated.

### The personal workspace (`Users/personal`, was `Users/personal`)

`Users/personal` is a reserved pseudo-org holding every user's PERSONAL workspace (content owned
by the teacher, not an org). Everyone has one, including org members, so a user can be in a
personal and an org workspace at once. It reuses the org tree shape, is never domain-matched
(`match_org` skips it) and anything org-specific must be gated on `org != "personal"`. Constants
live in `backend/firebase/public_space.py` (kept filename; `PERSONAL_SPACE_ID = "personal"`, the
old `PUBLIC_*` names and a claim of `"public"` are still accepted as aliases).
- **Space doc fields:** `name`, `type: "personal"`, `domains: []`, `allowed_emails: []`. Signup is
  unlimited: the old signup cap (`max_users`/`user_count`) and capacity waitlist were removed in
  TASK-032. Plans/limits no longer live here.
- **`Users/personal/teachers/{uid}`:** the teachers doc created by bootstrap. Plans live on
  `Accounts/{uid}`; the old `plan` fields stay rules-protected.
- **`teacher_profiles/{uid}` (personal):** no `email` stored; `name_lower`; `has_public_courses`
  (maintained by `FirebaseService.sync_has_public_courses`, self-healing).
- **Credit counters (TASK-033), backend-only:** personal `Users/personal/usage/{uid}/periods/{period_id}`,
  org pool `Users/{org}/usage/_pool/periods/{period_id}`, lifetime bonus ledger
  `Users/personal/usage/{uid}/periods/bonus`. See "Quotas and credits". Old `months/{YYYY-MM}` docs are no longer written.
- Created by `backend/scripts/setup_launch_accounts.py` (or `create_personal_space.py`). Until
  that doc exists, `check-email` reports non-org emails as not allowed and bootstrap returns 503.

### Accounts, plans, entitlements (TASK-031)

- **Central config** (`services/platform_config.py`): the only place for plan limits, trial length
  (30 days, a PLACEHOLDER), `deactivation_grace_days` (30), collaborator caps and per-plan flags.
  Firestore `EdCube/platform_config` is merged over code defaults, cached ~5 min; nothing numeric
  is hardcoded elsewhere. Plans: `trial` (one-time allowance, no co-editing), `teacher`, `org`
  (pooled/unlimited; the pool, `collaborator_cap` and `seats` live on `Users/{orgId}`).
  Legacy `free`/`pro` map to `trial`/`teacher`.
- **`Accounts/{uid}`** (`services/accounts_service.py`): `email`, `email_domain`, `plan` (the
  PERSONAL workspace plan), `plan_started_at`, `trial_ends_at`, `plan_source`
  (`trial_default`|`admin`|`org_member`), `bonus_credits`, `is_admin`, `memberships`, `status`
  (`active`|`deactivated`), `deactivated_at`, `delete_after`. Created by bootstrap (plan trial);
  existing users are backfilled without touching plans. Org staff (TASK-032): `ensure_account`
  gives anyone with a real org membership plan `teacher` / `plan_source: org_member` in their
  personal workspace, free; an admin-set plan (`plan_source: admin`) is never overwritten, and
  leaving the org never downgrades.
- **`can(user, action, course)`** (`services/entitlements.py`) returns a Decision. Deactivated:
  everything denied. `view` and `manual_edit`: always allowed (nothing is deleted or locked when a
  trial ends). Ended personal trial: AI actions and new sharing denied with an upgrade message
  pointing to a waitlist (no prices). `coedit` follows the COURSE OWNER's plan and status,
  computed live, never stored on the course; applied in `update_section` and `/update-course`
  (`enforce_collaborator_write`). `invite_collaborator` needs the plan flag and room under the
  cap. Credits are checked after `can()` in `usage_service.enforce_quota` (reworked in TASK-033).
  An org workspace runs on the org plan, so a lapsed personal trial does not affect it.
- **Workspaces:** header `X-EdCube-Workspace: personal|<orgId>` (`require_workspace` in
  `routes/teachers.py`; `require_org` is a wrapper). The caller must be a member. No header keeps
  the old behaviour: org members stay in their org, bootstrapped others go personal.
- **Admin** (`routes/admin.py`, custom claim `admin: true`, else 403): look up by email, set plan
  (recomputes dates, `plan_source: admin`), grant credits (adds to `bonus_credits`), deactivate,
  reactivate (not bound by the grace period). Every change writes an `AdminAudit` doc.
- **Deactivation:** `POST /api/account/deactivate|reactivate`. Deactivated accounts are denied
  everywhere except `/me` and reactivate; their personal courses become unreachable to others;
  org courses are unaffected. After `delete_after`, `scripts/purge_deactivated.py --apply`
  (dry-run by default, person-run) deletes personal data and the Auth user. Anyone with an org
  membership (a non-personal entry in `memberships`, or a `Users/<org>/teachers/{uid}` doc) keeps
  their Auth user, org data and login: only personal content is purged and `Accounts/{uid}` is reset
  to active. The dry run prints a `PATH:` line per user.
- **Error codes:** 402 `plan_inactive` (trial ended), 402 `plan_upgrade_required` (reasons
  `coediting_not_in_plan`, `sharing_not_in_plan`, `collaborator_cap_reached`), 403
  `account_deactivated`, 403 `coediting_not_in_plan` (collaborator write when the owner's plan
  lacks co-editing), 410 `grace_period_over`. `GET /api/account/me` adds memberships, account
  summary and entitlements; bootstrap/check-email now say `space: "personal"` (was `"public"`).

### Space resolution (Round 2 org registry + public release PR-2)

The space (an org id, or `public`) for a request is resolved in this order, never from a
client-sent value:
1. **Org match wins.** `backend/firebase/org_registry.py` reads every `Users/{org}` doc's
   `{ name, domains, allowed_emails, type }` and caches them in-process (5 min TTL).
   `match_org(email, registry)` is pure: a lowercased domain in `domains`, or the full
   email in `allowed_emails`, matches; the `public` doc is skipped. No default org.
2. **Verified + not an org email → `public`.** `resolve_space(email, email_verified)`
   returns the org id, else `"public"` for a verified email, else `None`.
3. **Membership proof for later requests.** After bootstrap the user carries the custom
   claim `org: "<orgId>|personal"`. `require_org` accepts the claim, and falls back to the
   existence of `Users/personal/teachers/{uid}` (`is_personal_member` in `paths.py`, 60 s
   cache) for tokens issued before the claim refreshed. An org email match is always checked first.

Helpers: `get_org_from_email(email)` (re-exported from `schemas/teacher_schema.py`),
`resolve_org(uid)` in `paths.py` (uid → email via Admin SDK → registry, then the public
fallback; org matches cached 5 min, `None` never cached), `invalidate_uid_caches(uid)`.

**Bootstrap flow** (the client never writes `teachers/{uid}` itself):
signup → verification email → user verifies and logs in (login refuses unverified
accounts) → `POST /api/account/bootstrap` → `user.getIdToken(true)` to pick up the new
claim (`bootstrapAccount` in `frontend/src/firebase/authService.js`).
`AuthContext.jsx` also bootstraps once if `GET /api/account/me` says the user is not
registered (e.g. verified through the email link into a live session) and exposes
`space`, `plan`, `isPublicUser`. Bootstrap uses `verify_firebase_token` plus its own
`email_verified` check (not `require_org`, since a new public user has no space yet):
- org email: creates the teachers doc and profile, sets the claim, `plan: null`;
- public: one Firestore transaction on `Users/personal`. If the teachers doc exists it
  does nothing; otherwise it creates the teachers doc (no cap, no waitlist: signup is
  unlimited and no email domain is blocked). Then it ensures the profile, sets the claim (merged with existing
  claims) and returns `{space, org_id, org_name, plan, created}`.

Other routes:
- **`GET /api/account/me`** (`require_org`): `{space: "org"|"public", org_id, org_name, plan}`.
- **`GET /api/orgs/check-email?email=`** (`routes/orgs.py`, no auth, since there is no
  token before signup): org email → `{allowed: true, space: "org", org_id, org_name}`;
  otherwise, if `Users/personal` exists → `{allowed: true, space: "personal", org_id: "personal",
  org_name}` (no `waitlisted` field any more); otherwise `{allowed: false}`. The frontend's
  `checkEmailOrg` calls it at signup and login.
- **`require_org_for_uid(uid)`**: legacy non-token variant, unused by routes (kept for compatibility).
- Sharing and public courses never cross spaces: once the space is resolved, every
  Firestore read/write is a direct path under `Users/{space}/…`.

### Auth

`verify_firebase_token` (`routes/teachers.py`) checks the Bearer ID token (401 on a
missing/invalid header). `require_org` builds on it: 403 "Please verify your email address
before using EdCube" unless `email_verified is True`, then resolves the space as above
(403 "Your organization is not registered with EdCube" if none) and returns the decoded
token plus `org`. **Every AI route and every route that used to take a raw `teacherUid`
uses `require_org`** (curriculum, resources, topics, course_builder, file_upload,
uploads, notifications, knowledge_base, teachers, account). The token uid is
authoritative: `resolve_caller_uid(current_user, claimed_uid)` returns the token uid and
403s ("teacherUid does not match the authenticated user") if a client-sent
`teacherUid`/`teacher_uid` differs; a stale `organizationId` is ignored or rejected (403)
in favour of the resolved space. The frontend attaches the token through
`frontend/src/services/authFetch.js`. The only unauthenticated routes are `/contact`,
`/orgs/check-email`, `POST /api/waitlist` and the synopsis routes (see Known gaps).

### Signup, login, workspaces, waitlist (TASK-032)

- **Signup** (`/signup`, `SignupChoice.jsx`): two cards. Individual: "Continue with Google"
  (`GoogleButton.jsx`) or email + password; any email domain is accepted. Organization:
  `OrgWaitlistForm.jsx` ("Join the waitlist for when we open paid and enterprise versions"); it
  calls `POST /api/waitlist` and creates NO Firebase account. Existing org staff just log in.
  There are no prices anywhere. One login page serves everyone; the account's memberships decide
  the workspace.
- **Google** (`signInWithGoogle` in `firebase/authService.js`): `signInWithPopup`, falling back to
  `signInWithRedirect` when the popup is blocked. Login and signup are the same action. Google
  tokens are `email_verified`, so no verification step; the backend bootstrap is provider-agnostic.
  After a redirect return, the `AuthContext` auth-state listener resolves the account (`me`, then
  bootstrap if not registered). Email/password users who have not verified are still refused.
  A deactivated account is signed out with a message showing the restore-until date.
- **Workspaces on the client** (`AuthContext.jsx`): `memberships`, `activeWorkspace`,
  `setActiveWorkspace`, `isAdmin`, `isPersonalWorkspace` (`isPublicUser` kept as an alias).
  `org` is the Firestore path id of the ACTIVE workspace (an org id, or `personal`), so direct
  Firestore reads (`dbService`, folders, lastLogin) follow the switcher. Default workspace: the
  stored per-uid choice (`localStorage`), else the backend's `default_workspace` (the org for org
  staff, so nothing changes for them until they switch). `services/authFetch.js` holds the active
  workspace and sends `X-EdCube-Workspace` on every token-carrying call (the plain-`fetch` services
  add `workspaceHeader()` too); bootstrap and the first `me` go out without it. The sidebar shows a
  workspace switcher only with more than one membership (org staff have org + personal);
  `Layout` keys the page outlet by workspace so a switch refetches. `ProtectedRoute` and
  `NotificationContext` wait for the account to resolve. Plan names: `utils/planLabel.js`
  (Free trial / Teacher / the org's name).
- **Waitlist** (`routes/waitlist.py`): `POST /api/waitlist` is open (a valid token only attaches
  the uid): validated fields, throttles per IP (10 per 10 min) and per email (3 per hour; 429
  `{code: "rate_limited"}`), stored in `PaidWaitlist/{autoId}` (rules deny all client access),
  emailed via `contact.send_notification_email`. `GET /api/admin/waitlist` (`require_admin`) lists
  newest first, filter `?interest=`, `?format=csv` with a formula-injection guard.

### Quotas and credits (TASK-033, replaces the TASK-029 token counters)

`backend/services/usage_service.py`. Every number (limits, TTL, reset rule) comes from `platform_config`
or the org doc, never code. `entitlements.can()` runs first (ended trial gives 402 `plan_inactive`), then credits.

Counters: `courses`, `generates`, `edo_messages` (Edo is one credit per MESSAGE; tokens are only logged).

| Route(s) | Kind |
|---|---|
| `POST /generate-curriculum` | `courses` |
| `generate-more-subsections`, `curriculum/generate`, `curriculum/generate-block-links`, `curriculum/generate-description`, `curriculum/generate-synopsis`, `course-builder/{plan-days,plan-day,day-ideas,edit-outline}`, `populate-section`, `generate-videos`, `generate-resource`, `worksheet-prompts`, `activity-prompts`, `generate-worksheets`, `generate-activities`, `upload-course-file` | `generates` |
| `POST /curriculum/chat` (Edo) | `edo_messages` |
| `POST /curriculum/chips` | uncounted; `throttle_chips`, 30/min/uid |

`generate-blocks`, `build-course`, `update-course` and `save-course` are not charged (a build counts once, at `generate-curriculum`).
`plan-days` is one `generates` per run, charged only if at least one day was planned.

**Who pays and which period.** The person pressing the button pays, in the workspace named by `X-EdCube-Workspace`:
an org workspace the caller belongs to charges the org POOL (shared by all members; `Users/{org}.pool`, `null`/absent
= unlimited, as for ICC, still counted with a per-user breakdown `by_user`); otherwise the caller's own personal plan.
The course owner is never charged for a collaborator's click.
- Trial: a ONE-TIME allowance (doc id `trial`), never resets; `resets_at` is null and `trial_ends_at` is given.
- Teacher: monthly on the anniversary of `Accounts.plan_started_at`, 00:00 UTC, doc id = period start date; days 29-31
  clamp to the month's last day (31 Jan, 28/29 Feb, 31 Mar). No rollover (each period is a fresh doc). Changing plan
  changes `plan_started_at`, so a new period starts with no trial credits carried.
- Org pool: monthly on `Users/{org}.plan_started_at`. Config `reset_rule: "calendar"` (or no anchor) uses calendar months.
- Bonus credits (`Accounts.bonus_credits`, admin grant) are personal only, spent after the plan allowance, never reset;
  consumption is tracked in the `bonus` ledger doc (`remaining = granted - used`).

**Doc shapes.** Period doc: `{period_id, period_start, period_end, plan, used: {kind: n}, reservations: {rid: {kind, amount,
expires_at, created_at}}, by_user (pool only), updated_at}`. Bonus doc: `{used, reservations, updated_at}`.

**Lifecycle.** `enforce_quota(kind)` reserves one credit in a single Firestore transaction (reads the period, account and
bonus docs, then writes; reserved units count against what is left, so concurrent requests cannot overspend), the route runs,
then it confirms (reservation becomes `used`) or refunds (any HTTP error, crash, or unusable result), exactly once per request.
Streaming routes call `defer_settlement()` and settle with `settle_charge(success)` in the stream's `finally`
(FastAPI 0.109 runs the dependency's exit code before a StreamingResponse starts). An unsettled reservation expires after
`credit_reservation_ttl_minutes` (15) and is pruned lazily; a late confirm is still counted, a late refund is a no-op.
Fail open: an infrastructure error in reserve lets the request through uncharged (logged). Manual editing never goes
through credits, so it never pauses; only the exhausted kind pauses.

**Usable course.** `generate-curriculum` confirms its credit only if an outline with at least one titled section was
produced and delivered (Course Builder flow: at least one usable candidate outline; legacy flow: also the candidate phase
finished with at least one chain). Anything else is refunded, and the partial result (stage, section counts, error) is
passed to `log_usage_event`, which (TASK-034) writes the `UsageLog` row; see "Usage and cost log" below.

Contracts:
- **402** `{"detail": {"code": "quota_exceeded", "kind": "courses"|"generates"|"edo_messages", "limit", "used",
  "remaining", "resets_at" (ISO UTC, null for a trial), "plan", "pool", "workspace", "trial_ends_at"}}`
  (`QuotaExceeded` handler in `main.py`; streaming routes return it as JSON before the stream starts).
- **429** `{"detail": {"code": "rate_limited"}}` with `Retry-After` (Edo chips throttle, invite-by-email lookups).
- **`GET /api/account/usage`**: `{plan, space, workspace, pool, period_start, period_end, resets_at, trial_ends_at,
  credits: {kind: {limit, used, reserved, remaining, bonus_remaining, resets_at}}, limits, usage, is_trial,
  trial_days_left}`; `null` limit/remaining = unlimited. `limits`/`usage` are the old flat keys plus an `edo_tokens`
  alias of `edo_messages` (no longer read by the frontend). The 402 `quota_exceeded` body also carries `message` and `is_trial`.
- **`GET /api/admin/accounts/{uid}/usage`** (admin): personal counters plus each org pool the account belongs to.
- **`GET /api/admin/accounts/recent?limit=`** (admin): newest accounts first (1-200); declared before `/accounts/{uid}`.

**Usage UI and pause rules (TASK-035, frontend).** `contexts/UsageContext.jsx` fetches `/api/account/usage` for the
active workspace (personal plan or org pool), refreshes on workspace switch and after AI calls (`authFetch` events), and
exposes `gate(kind)` / `useAiGate(kind)` -> `{blocked, reason, message}`. A kind is blocked when its `remaining` is 0
(limit not null), when the server just answered 402 for it, or for every kind when the trial has ended (`plan_inactive`).
Only AI triggers use the gate: Generate Course (`courses`); Edo generate chips, block-link Generate, description and
synopsis, Course Builder outline chat, plan-day/ideas, course upload (`generates`); Edo text input (`edo_messages`).
Saving, editing, typing in course fields and viewing are never gated. `UsageMeter` (sidebar) shows one counter per kind
and is hidden for an org pool with no limits (ICC sees no change). `authFetch` turns `quota_exceeded`, `plan_inactive`
and `plan_upgrade_required` 402s into `QuotaExceededModal`, and a 403 `account_deactivated` into a sign-out.
**No payments:** every Upgrade / enterprise button opens `JoinWaitlistModal` ("Join the waitlist for when we open paid
and enterprise versions"; `POST /api/waitlist`, source `upgrade`); no prices, no checkout.

**Admin page (`/admin`, `components/admin/*`, `services/adminApi.js`).** Visible in the sidebar and routable only when
`isAdmin`; every call goes through `authFetch` to `/api/admin/*`, where `require_admin` is the real gate. Tabs: Accounts
(recent list, email search, set plan, grant credits, deactivate/reactivate with confirmation), Waitlist (filter, CSV),
Costs (`cost-summary`, usage-log CSV).

### Usage and cost log (TASK-034)

One `UsageLog/{autoId}` document (top level, backend-only) per AI action, charged or not: `uid`, `email_domain`, `plan`,
`workspace`, `pool`, `action` (stable route name, e.g. `generate_course`, `edo_message`, `edo_chips`, `generate_block_links`),
`credit_kind`, `charged`, `course_id` (sniffed from the request), `browserbase {search, fetch, render_pages, sessions,
session_seconds}`, `used_browserbase`, `llm {calls, by_model{model: {prompt, completion, total}}, total_tokens}`, `success`,
`error_code`, `partial`, `duration_ms`, `at`, `est_cost_usd {llm, browserbase, total}`, `est_cost_is_placeholder`. No prompt or
response content is stored (only counts and ids; `partial.error` is an exception message cut to 300 characters).

**Collector.** `services/cost_tracker.py` holds a mutable `CostTracker` in a `ContextVar`, started by `enforce_quota(kind, action)`,
`throttle_chips` (chips, no credit) and `track_ai(action)` (generate-blocks, build-course: no credit hold), and also kept at
`current_user["_cost"]` for stream generators. `record_llm(response)` runs after every `chat.completions.create` (10 sites);
`browserbase_client` counts search, fetch, rendered pages, sessions and session seconds. Worker threads inherit the tracker
because the module wraps `ThreadPoolExecutor.submit` at import so each job runs in a copy of the submitter's context
(what `asyncio.to_thread` and anyio already do); the browser pool also holds an explicit reference. The synopsis portal
(ICC admin, no tracker) is knowingly not logged. Hook: `usage_service.settle_charge` builds the event for credit-held routes
(TASK-033 hook `log_usage_event`); `finish_untracked` / `finish_stream` log uncharged routes, once per request
(`claim_log`). A 4xx rejection that did no work writes no row.

**Writing.** `log_usage_event` enqueues the write on a two-thread background pool (`write_async`); failures are logged and
never reach the request. `flush()` waits for pending writes (tests, shutdown).

**Admin routes** (`require_admin`): `GET /api/admin/usage-log` (`from`, `to`, `uid`, `action`, `limit` default 1000 / max 5000,
`format=json|csv`; default window 30 days; CSV cells guarded against spreadsheet formulas) and `GET /api/admin/cost-summary`
(by_action, by_user, by_credit_kind; count, success rate, tokens, Browserbase calls, estimated cost). Both scan at most the
newest 5000 rows of the window and report `truncated`; move to a scheduled rollup before the log outgrows that.

**Cost rates (person must fill in).** `EdCube/platform_config.cost_rates` (defaults in `platform_config.py`, all 0 with
`is_placeholder: true`): `llm_per_1m_tokens {default, gpt-4o, gpt-4o-mini: {input, output}}` in USD per million tokens (dated
model names use the longest matching prefix) and `browserbase {per_search, per_fetch, per_session, per_session_minute,
per_render_page}`. Until set, every `est_cost_usd` is 0 and the summary reports `rates_are_placeholder: true`. No prices live
anywhere else in code.

### Sharing and collaboration (TASK-036, supersedes the old Private/Public model)

Code: `backend/services/sharing_service.py` (logic), `backend/routes/sharing.py` (HTTP). Rule of thumb: the course
OWNER's plan decides; a collaborator's own plan never matters and collaborators join on any plan at no cost.

- **Separate worlds.** An org user only sees their own org's tree; no cross-space sharing. Org semantics are unchanged:
  `isPublic` makes a course readable by every org member, and the org visibility toggle, org library and org `/share`
  (uid recipients, same-org only) work as before.
- **Personal workspace.** A course is readable by its owner and the uids in `sharedWithUids` only. `isPublic`
  ("visible to all EdCube users"), the public teacher directory (`GET /api/teachers/` returns `{teachers: [], next_cursor: null}`),
  `has_public_courses` (`sync_has_public_courses` is a no-op), other people's profiles (404) and the visibility toggle (410
  `personal_visibility_retired`) are retired.
- **View-only links.** `ShareLinks/{token}`: token = `secrets.token_urlsafe(32)` and the doc id; fields course_id, workspace,
  owner_uid, created_at, revoked_at, last_viewed_at, view_count. Any user may create one (trial active or any paid plan; max 20 active
  per course; an org can opt out with `allow_public_links: false`). `GET /api/share/{token}` needs no auth, is rate limited 60/min per
  IP (last X-Forwarded-For entry, correct for Cloud Run directly; in-memory per instance) and answers one identical 404 for revoked,
  deleted, owner-deactivated, org-opt-out, ownership-changed and unknown tokens. Payload = top-level field whitelist
  (`PUBLIC_COURSE_FIELDS`) + recursive removal of keys matching email / uid / shared / organizationId / storage path / extractedText /
  interpret / requirement / leading underscore + every string cut at "ATTACHED MATERIALS:" and "--- File:" (course creation appends
  uploaded-file text to `objectives` and the outline). Attachments are exposed as name, type, description only. Residual: AI-written
  text derived from uploads is not stripped. Responses are `no-store`, `noindex`.
- **Invites.** `Invites/{id}`: course_id, workspace, owner_uid, email, access_type (`collaborate`|`view`), status
  (pending|accepted|cancelled|expired), 256-bit `token`, expires_at (14 days). An existing account in the workspace is added
  directly and notified; otherwise a pending invite is created and emailed (`FRONTEND_URL/invite/{token}`; names stripped of control
  characters). Accept (`POST /api/invites/{token}/accept`) needs a verified account whose token email equals the invited email
  (403 `invite_email_mismatch`), 410 when cancelled/expired/used; accepting a view invite never downgrades existing collaborate
  access. Invites are rate limited 30/hour per owner (in-memory per instance). Org workspaces can only invite their own domain.
- **Cap.** Teachers: max 3 collaborators per course, pending collaborate invites count, checked before and again after the write
  (rollback on race, 402 `plan_upgrade_required` / `collaborator_cap_reached` with counts); orgs use their own `collaborator_cap`.
- **Lapse rules.** Co-edit permission is computed live from the owner's plan on every write (`access_info`,
  `entitlements.enforce_collaborator_write`) and never stored. Owner lapses or deactivates: nothing is deleted, the owner keeps editing,
  every collaborator becomes view-only (403 `coediting_not_in_plan` / `account_deactivated`, unsaved edits stay on their screen), pending
  collaborate invites are cancelled (eagerly in admin set_plan / deactivate / self-deactivate, lazily on every invite read or accept) and no
  new invites can be sent. Re-subscribe restores everyone. A collaborator's own trial expiring changes nothing but their AI credits.
- **Removal / leave / delete.** Owner removal and leave change `sharedWith` and `sharedWithUids` in one write; every read and write
  re-checks, so open sessions lose access on the next request (404). Delete is owner-only in every workspace: collaborators lose access,
  links stop, pending invites are cancelled; `GET /api/curricula/{id}/delete-impact` gives the counts for the warning.
  Contributions belong to the owner (everything lands on the one document, `teacherUid`).
- **Outlier cases** (1 the presser pays credits - existing quota path; 2 zero-credit/expired collaborator edits manually - writes are
  not credit gated; 3 owner lapse; 4 re-subscribe; 5 collaborator's trial; 6 immediate effect, unsaved edits kept client-side; 7 removal
  immediate; 8 owner owns contributions; 9 delete; 10 4th collaborator blocked with a clear message; 11 unlimited courses as a collaborator).
- **TASK-041 (org ownership).** Owner-only delete (`FirebaseService.delete_curriculum(..., org=)` uses the request's workspace), and
  section writes (`section_write_denied`, also checked before AI in populate-section) need owner or collaborate access in orgs too.
  An org view-only share entry now gets 403 `access_view_only` (was 404) on update-course.
- **Routes.** Owner: `POST/GET /api/curricula/{id}/links`, `DELETE .../links/{token}`, `POST .../invites`, `DELETE .../invites/{id}`,
  `GET .../collaborators`, `DELETE .../collaborators/{uid}`, `GET .../delete-impact`. Member: `POST .../leave`, `GET .../access`.
  Public/invitee: `GET /api/share/{token}`, `GET /api/invites/{token}`, `POST /api/invites/{token}/accept`. Personal
  `POST /api/notifications/share` is an alias onto the invite flow (old response keys kept, plus `invited` and `results`).
- **Frontend (TASK-037).** API client `frontend/src/services/sharingApi.js` (errors carry `.status`/`.code`/`.reason`; calls go through
  `authFetch` with `quietBlock` so a 402 shows inline, only the two public reads are plain fetches).
  - Routes: `/share/:token` (`share/PublicSharePage`, read-only `CourseViewer` over the sanitized payload, no auth call, `noindex`) and
    `/invite/:token` (`share/InvitePage`) sit outside `ProtectedRoute`. Signed out, the invite token is kept in localStorage
    (`utils/pendingInvite.js`, 14 days); `PendingInviteRedirect` (mounted in the router) sends a signed-in user back to the invite, which accepts it
    (403 `invite_email_mismatch` offers sign-out, 410/404 says it expired), then `setActiveWorkspace(r.workspace)` and opens the course. Unverified
    accounts count as signed out, so the token survives signup, verification and login or Google.
  - Share modal: `ShareCourseModal` picks `OrgShareModal` (original, unchanged) or `PersonalShareModal` (links, invites, collaborators, cap
    message, "Join the waitlist" for every upgrade prompt, no payments).
  - Live access: `courses/courseAccess.js` `useCourseAccess` polls `GET /api/curricula/{id}/access` (30s + focus) for non-owners in `CourseWorkspace`
    and `CourseViewPage`; a refused save (`coediting_not_in_plan`, `access_view_only`, `account_deactivated`, 404) locks the same way. A lock keeps the editor
    state mounted, writes a draft to localStorage `edcube.draft.{id}`, switches to the read-only `CourseViewer` with `AccessBanner` ("Copy my unsaved
    changes"), and a restore (owner resubscribes) re-enables autosave, which saves the kept edits and clears the draft. 'removed' is final. A missing or
    non-boolean `can_edit` never locks; owners are never locked. `authFetch` no longer signs a collaborator out for `account_deactivated` with reason `owner_deactivated`.
  - Delete: `MyCourses` calls `GET .../delete-impact` then `DELETE /api/curricula/{id}`; `DeleteConfirmModal` names collaborators, pending
    invites and links. No client-SDK delete of curricula remains.
  - Personal retirements in the UI (guarded by `isPublicUser`): Public/Private labels and toggle, Public/Published rows in My Courses, Search (route
    behind `OrgOnly`, hidden in the sidebar), other people's profiles, profile public-course count and list. Collaborators and viewers get `LeaveCourseButton`.

### Firestore rules summary (`frontend/firestore.rules`)

- `isOrgMember(orgId)`: caller's email domain / full email is in the org doc's `domains` /
  `allowed_emails` (no hardcoded list).
- `inSpace(orgId)`: verified email and the `org` custom claim equals `orgId`.
- `orgAccess(orgId)`: `orgId != 'public'` and (`isOrgMember` or `inSpace`). The generic
  `Users/{orgId}` block uses it, so the generic rules can never apply to `public`
  (Firestore ORs overlapping matches).
- `inPersonal()`: `inSpace('personal')` or a `Users/personal/teachers/{uid}` doc (org members).
- `match /Accounts/{uid}`: read by self only; `Accounts`, `AdminAudit`, `UsageLog` and `EdCube/platform_config` are never client-writable.
- `match /Users/personal` (stricter): space doc readable by personal members, never
  client-writable. Curricula: read if owner or in `sharedWithUids` (no `isPublic` read); create needs empty sharing fields; update/delete owner only and
  `sharedWith` / `sharedWithUids` / `teacherUid` cannot be changed by clients. `ShareLinks/{token}` and `Invites/{id}`: no client access. `teacher_profiles`: read by members, write by self. `teachers/{uid}`: self only;
  `plan` / `plan_updated_at` cannot be written by clients; no client delete. `notifications`:
  read/delete own. `usage/**`: no client access. `PaidWaitlist/{entry}` and `UsageLog/{entry}`: no client access at all.
- The org block: members read curricula, profiles, teachers, synopsis; owner-only writes;
  folders owner-only; notifications read/delete own.
- Hosting/deploy config: `frontend/firebase.json` points Firestore at `firestore.rules` and
  `firestore.indexes.json`; hosting target `edcubeai`.

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
`subjects_taught[]`, `grades_taught[]`, `bio`, `profile_picture_url`, `org_id`. In the
public space `email` is never stored or returned, and `name_lower` / `has_public_courses`
are added (see above).

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
the Firestore synopsis paths). Existing files were copied under the org prefix by TASK-011 and the old copies deleted by TASK-012 (see below). As of TASK-007, new profile-picture uploads also go
under `Users/{org}/profile_pictures/{uid}/…` (`routes/uploads.py`, via the `require_org`
dependency); old `profile_pictures/{uid}/…` download URLs already stored on teacher
profiles are unaffected since they're already-issued absolute Storage URLs, not
reconstructed paths.

**Storage migration (TASK-011, done 2026-10-05):** `backend/scripts/migrate_storage_to_org_tree.py`
(dry run by default) copied 1370 existing blobs server-side to `Users/icc/synopsis/summer_camps/`
(from `synopsis/`), `Users/icc/synopsis/afterschool/` (from `afterschool_synopsis/`),
`Users/icc/course_attachments/` and `Users/icc/profile_pictures/`, preserving metadata and the
download token, and rewrote the 1188 stored links (only the object path in the URL changes).
This was a copy, not a move; the old top-level blobs were then deleted on 2026-10-06 (TASK-012,
approved by the person; no backup of them exists). Sent newsletters are not affected: they are
.docx files with photos embedded as bytes, not Storage links. The 166 unlinked camp photos and the out-of-scope
`worksheet_images/` / `worksheet_pdfs/` blobs were deleted on 2026-10-07 (TASK-013, approved by the person; local backup
outside the repo). 16 unlinked blobs (15 afterschool, 1 profile picture) are deliberately kept. Storage URLs are parsed back into object
paths by `routes/curriculum.py` (attachment delete) and `routes/synopsis.py` (photo fetch) by
splitting on `/o/`, so they work unchanged on the new links.

**`EdCube/knowledge_base/{pedagogy,age,content,worksheets,activities}`** (and future
`curriculum`, `impact_partners`) — the taxonomy knowledge base, was
`kb_age_bands`/`kb_objectives`/`kb_worksheet_formats`/`kb_activity_formats`/
`kb_content_formats`. Owned exclusively by `backend-agent`; see the KB ownership rule in
`CLAUDE.md`. `knowledge_base_service.py`'s public functions (`get_age_bands()`,
`get_objectives()`, etc.) kept their names, signatures and return shapes across this
move — only the underlying Firestore path changed, so `prompt_builder.py`, the outliner
and generation callers needed no edits. These replace pedagogy that used to be
hardcoded across prompt files and `blockCategories.js`.

As of TASK-001, `frontend/src/constants/blockCategories.js` gets the taxonomy from
`GET /api/knowledge-base/objectives` (`routes/knowledge_base.py`, read-only, behind
`require_org`; returns `{"objectives": [{id, label, allowed_types, clusters}]}` straight
from `knowledge_base_service.get_objectives()`). The frontend sends the Firebase ID token,
maps `allowed_types` to `allowedTypes`, adds the local presentation colour, and caches the
result in memory; the hardcoded array is only a fallback (shown until the fetch resolves,
and kept if it fails). The frontend no longer reads the knowledge base from Firestore;
`kbCol` in `firebase/paths.js` is now unused.

As of TASK-005, `GET /api/knowledge-base/block-subtypes` (same router, same `require_org`
guard) returns `{"subtypes": {"content": [...], "worksheet": [...], "activity": [...]},
"worksheet_compatibility": {content subtype: [worksheet subtypes]}}`. Unlike `/objectives`
this is NOT Firestore KB data: it is served straight from the Python constants in
`backend/outliner/block_prompts.py` (`CONTENT_SUBTYPES`, `WORKSHEET_SUBTYPES`,
`ACTIVITY_SUBTYPES`, `WORKSHEET_SUBTYPE_COMPATIBILITY`), which remain the single source of
truth (structure-agent owns that file; the route only imports and copies them into fresh
lists). It lives on the knowledge-base router because that is where the frontend already
looks for taxonomy; if these subtypes are ever moved into the Firestore KB, only the route
body changes.

### Phase 1.5 library + day lanes view (frontend, TASK-002/003)

Behind a local "Library" toggle in `CourseWorkspace.jsx` (off by default; the existing
outline view is unchanged when off). `ContentLibraryPanel.jsx` lists every subsection and
its block chips as drag sources (`@hello-pangea/dnd`, types `LIBRARY_SUBSECTION` /
`LIBRARY_BLOCK`, both source droppables `isDropDisabled`); `DayLanesPanel.jsx` renders one
lane per day (day count from `formData.numDays`, default 5, max 60). Drops are copies:
`handleDragEnd` has a library branch that adds a fresh-id deep copy (grouped card for a
subsection, standalone chip for a block) to the `dayLanes` React state. `dayLanes` is
session-only: it is not saved, not part of the saved course shape, not in undo history, and
resets on reload. Nothing triggers generation. Shared constants live in
`frontend/src/constants/libraryView.js`, pure helpers in `frontend/src/utils/dayLanes.js`.
The Edo suggestion tray (`edo-tray-*`, a cut) is untouched.

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

- `GET /api/knowledge-base/objectives` (TASK-001) is verified but depends on the backend
  being deployed; until then the frontend gets a 404 and keeps its hardcoded fallback.
  `kbCol` in `frontend/src/firebase/paths.js` has no users and could be removed.
- `GET /api/knowledge-base/block-subtypes` (TASK-005) is verified but not deployed. The
  Phase 1.5 day lanes (TASK-003) are not persisted and have not been exercised in a browser.
- `backend/scripts/migrate_synopsis.py` is an obsolete one-off that reads the deleted
  `synopsis_*` collections and writes to the deleted top-level `synopsis/ICC`; do not run it
  (it would recreate an old root collection). Candidate for deletion.
- No automated test suite exists yet (no pytest, no jest/vitest — only eslint on the
  frontend). `docs-qa-agent` verifies by other means until this is built out.
- The knowledge base collections (`kb_*`, now `EdCube/knowledge_base/*` in the backend
  code — see "Data model — Firestore" above) are being built out but not yet wired into
  generation prompts — `prompt_builder.py` may still contain some hardcoded pedagogy
  that should eventually pull from `knowledge_base_service.py` instead.
- **Synopsis / after-school LLM routes are unauthenticated.** `routes/synopsis.py` and
  `routes/afterschool_synopsis.py` (including the model-calling `/enhance`, `/parse-flyer`,
  `/parse-food`) use a shared camp-staff portal password, not EdCube accounts, as do
  `/contact` and `/orgs/check-email`. Anyone can spend model calls through them until they
  get their own protection. They are also not quota-counted.
- **Org ownership gap (no task yet, needs the person's OK).** In orgs, any member can delete
  another member's public course and overwrite sections of any org course
  (`delete_curriculum` / `update_section` have no owner check there). Fixed only for the
  public space.
- **Throttles are in-memory and per Cloud Run instance** (Edo chips 30/min, invite-by-email
  lookups 30/min); the effective limit grows with instance count.
- **Org rules are broad.** At the rules level any org member can read any `teacher_profiles`
  doc and any curriculum in their org, including private ones (unchanged; the public space
  is stricter). Public clients can also write their own `has_public_courses` flag
  (harmless, self-heals).
- Credit reserve/confirm/refund is synchronous Firestore I/O inside async code. A deferred
  reservation whose stream never starts is released only by the TTL.
- The collection-group query that used to back `_find_curriculum_ref()` is gone — Round
  2 (TASK-006b) deleted it along with every other `collection_group()` call in the
  backend (synopsis camp/entry lookups included). No collection-group index is needed
  anywhere in the backend anymore; ignore any pre-TASK-006b note that said otherwise.

## Public launch checklist

Everything below is run or decided by the person; nothing here is automatic. Run from
`backend/` for the script (Application Default Credentials) and `frontend/` for Firebase CLI.

**Steps, in order**
1. `python scripts/setup_launch_accounts.py --admin-email <you>` (dry run), then `--apply`: creates
   `EdCube/platform_config`, `Users/personal`, puts `icc` on the org plan, makes you admin + Teacher
   and backfills `Accounts`. Idempotent; never overwrites existing plans or limits.
2. Deploy the backend to Cloud Run (`deploy.sh`; `BROWSERBASE_API_KEY` must be set on the service; also set `FRONTEND_URL`,
   the public site URL used in invite and share links, default `https://edcube.org`; it is not in `deploy.sh` yet).
3. Deploy `firestore.rules` (`firebase deploy --only firestore:rules`).
4. Export the existing indexes first (`firebase firestore:indexes`), merge anything
   missing into `firestore.indexes.json`, then deploy it (`firebase deploy --only
   firestore:indexes`). If prompted to delete console-only indexes, answer no.
5. Deploy the frontend (hosting target `edcubeai`).
6. Smoke test: an org login; ICC staff switching to the personal workspace; a gmail signup,
   verify, login; Google sign-in (popup and redirect); hit a trial limit (402 modal); submit the
   org waitlist form and check the `PaidWaitlist` doc and the notification email.

**Non-code items**
- Terms of Service and Privacy Policy pages.
- A delete-account path (manual at first).
- An OpenAI spend alert / budget cap.
- The Firebase Auth verification email template and sender domain.
- `GMAIL_USER` / `GMAIL_APP_PASSWORD` set on the backend, or Pro requests (`POST /contact`
  with `type: "pro"`) are accepted but no email is sent.
- Change a plan or grant credits: `PATCH /api/admin/accounts/{uid}/plan`, `POST .../credits` (audited).
- Change limits or trial length: edit `EdCube/platform_config` (takes effect within ~5 min; `null` = unlimited).

## Agentic dev system (meta — how this repo is built)

This repo is developed using a task-queue-driven multi-agent Claude Code setup. See
`CLAUDE.md` for the full explanation, `TASKS.md` for the active queue, and
`.claude/agents/*.md` for each agent's exact ownership and rules. This section exists so
that anyone (including a future agent) reading `ARCHITECTURE.md` understands that the
codebase itself is built this way, not just documented this way.