# TASKS

Add new tasks under `## Backlog` in plain language. Run `/next-task` to process the top
eligible item. Don't edit `## In Progress` or `## Done` by hand — `docs-qa-agent` and the
coordinator manage those sections.

Format: `- [ ] TASK-XXX: description (suggested agent, optional)`

## Backlog


- [ ] TASK-010: [NEEDS EXPLICIT APPROVAL, skip in /next-task] Firestore reorg, part
      5/5: delete old collections (including leads, legacy synopsis_*, and
      worksheet_pdfs) via --delete-old. Review the 2 leads docs first. Depends on:
      TASK-009 done and verified.
- [ ] TASK-011: [LATER, skip in /next-task until TASK-010 is done] Move existing Cloud
      Storage files (course attachments, synopsis photos) under Users/{org}/ and
      rewrite the download links stored in the docs. See
      tasks/firestore-reorg-spec.md, "Round 2" E. (backend-agent)
- [ ] TASK-001: Wire blockCategories.js to fetch live taxonomy from a backend endpoint
      instead of using a hardcoded array (backend-agent for the endpoint, then
      frontend-agent for the fetch)
- [ ] TASK-003: Phase 1.5 redesign, part 2/3 — day lanes panel with copy-on-drop
      (fresh unique id per copy, subsection drop renders grouped card, single block
      drop renders standalone chip). See tasks/phase-1.5-redesign-spec.md section 3.
      Depends on: TASK-002 done. (frontend-agent)
- [ ] TASK-005: Expose CONTENT_SUBTYPES/WORKSHEET_SUBTYPES/ACTIVITY_SUBTYPES
      (currently hardcoded in backend/outliner/block_prompts.py:15-43) to the
      frontend via a new FastAPI route, same pattern as TASK-001's endpoint — no
      shared backend/frontend constants file currently exists to reuse instead
      (confirmed: curriculumSchema.js only references the field name, not the
      values). Needed so TASK-004's format dropdown uses the real taxonomy instead
      of blockCategories.js (a different, pedagogical-objective taxonomy — confirmed
      not a match). See tasks/phase-1.5-redesign-spec.md "Resolved after TASK-002
      investigation," point 3. Depends on: nothing. (backend-agent)


## Needs Input


## In Progress


## Done

- [x] TASK-009: [PERSON-RUN] Firestore reorg, part 4/5: cutover. Run the migration
      with --apply, deploy backend, frontend and rules, re-run --apply, then smoke
      test. See tasks/firestore-reorg-spec.md, "TASK-009".
      Result: DONE (person-run with coordinator, 2026-10-03 to 2026-10-05) —
      backend and frontend were deployed first (2026-10-03), then the migration
      ran with --apply (all counts match the dry run; the one test-org course
      skipped as planned) and firestore.rules were deployed. The second --apply
      was deliberately skipped: no writes had landed in the old collections
      since 2026-10-01, and re-copying after the new code went live would
      overwrite newer data in the new tree. Fixes made during cutover:
      (1) migrate_to_org_tree.py now materializes each `.stream()` into a list
      before nested work, because the open stream hit a 504 deadline;
      (2) the Cloud Run service account
      (890930502654-compute@developer.gserviceaccount.com) was granted
      roles/firebaseauth.viewer, because `resolve_org` calls
      `auth.get_user(uid)` and was refused, which 500'd every
      `require_org_for_uid` route (course creation first);
      (3) two composite indexes created on `curricula`: (teacherUid,
      createdAt desc) and (organizationId, isPublic, lastModified desc) —
      neither existed before the reorg either. Smoke test by the person:
      opening courses and workspaces, course creation, sharing with
      delete-on-seen notifications, synopsis pages with photo upload, and the
      contact form all confirmed working. The cross-org rules check (an icc
      user cannot read another org's folder) was not run, since no second org
      exists. Old collections untouched (TASK-010).

- [x] TASK-008: Firestore reorg, part 3/5: frontend. Add frontend/src/firebase/paths.js;
      update dbService.js, authService.js and blockCategories.js to the new paths
      (org from getOrgFromEmail); NotificationBell deletes notifications on open
      instead of marking them read. See tasks/firestore-reorg-spec.md, "TASK-008"
      and "Round 2" G (signup via /api/orgs/check-email, auth token on Edo chat
      and populate-section, synopsis week/camp ids). Depends on: TASK-006b done.
      (frontend-agent)
      Result: PASS (docs-qa-agent, 2026-10-01) — `grep "collection(db\|doc(db,"`
      outside `frontend/src/firebase/paths.js` returns nothing, confirmed by
      independent re-run; every helper in `paths.js` mirrors
      `backend/firebase/paths.py`'s shape. `authService.js` has no
      `DOMAIN_ORG_MAP`/`getOrgFromEmail`; `checkEmailOrg` calls
      `GET /api/orgs/check-email` and the signup/login writes land at
      `Users/{org}/teachers/{uid}`; signup calls `checkEmailOrg` *before*
      `createUserWithEmailAndPassword`, so an unregistered email can't orphan
      an auth user. `AuthContext` resolves `org`/`orgName`/`orgError` on every
      auth-state change and signs out + nulls `currentUser` on an unregistered
      email, with no loop (the resulting `onAuthStateChanged(null)` just
      resets state, it doesn't re-check); `ProtectedRoute` redirects to
      `/login` on `orgError`, `Login` surfaces it, `Signup`'s org dropdown is
      gone. Every `dbService.js` export's new `org` parameter traced to every
      caller by grep (`MyCourses`, `AddFolderModal`, `BlockView`,
      `LibraryPickerModal`, `ResourceLibrary`, `CourseWorkspace`) — all pass
      `org` in the correct position, no missed caller found. Checked the
      org-null timing window specifically: `CourseWorkspace`'s autosave and
      save button, `MyCourses`, `BlockView`, `LibraryPickerModal` and
      `ResourceLibrary` all gate their Firestore calls on `org` being
      truthy, so no `Users/null/...` read/write is reachable; the one ungated
      effect in `CourseWorkspace` (fetch course info) only calls a backend
      API, not Firestore directly. `saveCurriculum` confirmed dead (zero
      importers) before removal. `blockCategories.js` reads
      `EdCube/knowledge_base/pedagogy`. `chatWithEdo` sends
      `Authorization: Bearer <idToken>`, `EdoChatbot` sources it from
      `currentUser.getIdToken()` (the Firebase Auth user object from
      `useAuth()`, confirmed it has that method). Notifications:
      `markNotificationsSeen` posts `{notification_ids}` to `POST
      /api/notifications/seen`, matching the backend body key exactly;
      `openAndMarkSeen` loads+displays the list, then marks only those ids
      seen — single call per bell-open, no double `/seen` call, and the list
      stays visible locally until the next refresh since state isn't cleared
      on delete; `unreadCount` is `notifications.length`; `NotificationBell`
      no longer reads `.status` anywhere. Grepped for frontend callers of
      `populate-section` and `GET /synopsis/entries/{id}` — neither exists,
      matching the claim (the existing summer-camps synopsis service only
      calls the list/save entry routes). Lint/build: re-ran
      `npm run build` (succeeds, pre-existing large-chunk warning only) and
      `npm run lint` after the change (27 errors, 6 warnings), then
      `git stash push -u` / `git stash pop` to re-run lint on the
      unmodified tree and got the identical 27/6 — confirmed none of this
      diff's errors are new, including the one error inside a file this task
      touched (`NotificationContext.jsx`'s pre-existing
      `set-state-in-effect` on an unrelated, untouched `useEffect`). `import
      main` succeeds on the backend side (unaffected, but checked since
      `curriculum.py`/`topics.py`/`notifications.py` request shapes needed to
      be cross-checked against this diff). Ownership: diff confined to
      `frontend/src/**` (new `firebase/paths.js` plus the exact files listed
      in the task and spec) — no backend or doc files touched by the
      implementer. Two items intentionally left out of scope, both already
      called out in `ARCHITECTURE.md`'s "Known architectural debt" and not
      required by this task's file list: `routes/curriculum.py`
      (`save-course`, `update-course`, `my-courses`, etc.) and
      `topics.py`'s `get_section` still take a raw `teacherUid` instead of a
      token — safe today only because the backend resolves `org` server-side
      via `require_org_for_uid` and ignores the client-supplied
      `organizationId`, but a real TASK-009-adjacent follow-up if ever made
      token-based. See `ARCHITECTURE.md`'s "Data model — Firestore" and
      "Org resolution" sections for the updated detail.

- [x] TASK-007: Firestore reorg, part 2/5: migration script
      backend/scripts/migrate_to_org_tree.py. Copy-only, dry run by default,
      --apply, idempotent, plus a --delete-old flag guarded by count checks. Run it
      only in dry-run mode here. See tasks/firestore-reorg-spec.md, "TASK-007"
      and "Round 2" F (org registry doc, afterschool entries under months,
      sharedWithUids backfill, skip test-org). Depends on: TASK-006b done.
      (backend-agent)
      Also (added 2026-09-30, person approved): new profile-picture uploads go under
      Users/{org}/ too.
      Result: PASS (docs-qa-agent, 2026-09-30) — dry run re-run independently, all
      counts match the implementer's summary exactly (curricula 23→22 with the
      one test-org doc skipped, teacher_profiles 11→11, teachers 13→29 including
      courseFolders/libraryFolders, notifications 4→4, synopsis/ICC/weeks 8→661
      including camps/entries, afterschool months 4→4, afterschool entries 30→30,
      kb 5/4/3/10/8); confirmed read-only via a direct listing showing `Users` and
      `EdCube` roots still empty after the run. Read the script line-by-line: every
      `.set()`/`.delete()` call is gated behind `apply`/`--delete-old --yes-really`
      respectively, so dry run truly never writes; `--apply` and `--delete-old`
      refuse to run together; `--delete-old` never references `Users`/`EdCube`
      (fixed `OLD_TOP_LEVEL_FOR_DELETE` list only); its count guard compares
      eligible vs. actual destination counts using the *same* recursive
      subcollection-counting logic on both sides for `teachers` and `synopsis`
      (`copy_doc_recursive` and `count_docs_recursive` are structurally
      identical traversals), so the guard can't be fooled by a shallow count on
      either side. Mapping correctness spot-checked against live data: all 30
      afterschool entries have a `month_id` field and land under their month;
      `sharedWithUids` backfilled from `sharedWith`; `'ICC'` teachers doc
      normalized to `'icc'`; `Users/icc`'s registry fields match the spec
      exactly; all 4 intermediate docs get real fields; `leads`/`synopsis_weeks`/
      `synopsis_camps`/`synopsis_entries`/`synopsis_food`/`worksheet_pdfs` are
      never referenced by any copy step; every destination path is built with a
      `backend/firebase/paths.py` helper, no re-typed strings. `uploads.py`:
      `import main` succeeds, the profile-picture route now depends on
      `require_org`, and old profile-picture URLs are untouched (they're
      already-issued absolute Storage URLs, not reconstructed from the path
      prefix). Ownership: the diff is confined to the new
      `backend/scripts/migrate_to_org_tree.py` and an 11-line change to
      `backend/routes/uploads.py` — both inside backend-agent's allowlist. See
      `ARCHITECTURE.md`'s "Data model — Firestore" for the migration script
      usage note and the updated profile-picture storage path.

- [x] TASK-006: Firestore reorg, part 1/5: backend. Add backend/firebase/paths.py and
      move all backend Firestore access to the new `EdCube` / `Users/{org}` tree:
      org-scoped curricula, profiles, teachers and notifications via
      resolve_org(uid); synopsis under synopsis/{afterschool,summer_camps}; KB
      categories renamed (pedagogy, age, content, worksheets, activities); drop the
      leads write in contact.py; delete-on-seen notification endpoints. Also rewrite
      frontend/firestore.rules for the new tree. No deploys. See
      tasks/firestore-reorg-spec.md, "TASK-006". Depends on: nothing. (backend-agent)
      Result: PASS (docs-qa-agent, 2026-09-29) — `import main` succeeds, no raw
      top-level `.collection()` calls outside paths.py, KB function contract
      unchanged, every caller of the now org-scoped FirebaseService methods
      updated and verified by grep, firestore.rules enforces org-scoped +
      owner-only access and read-only KB. Two pre-existing gaps noted (not
      caused by this task, not blocking): frontend-written curricula lack a
      `courseId` field (chat/collection-group lookups degrade gracefully); the
      `_find_curriculum_ref` collection-group query needs a Firestore index
      before TASK-009. See ARCHITECTURE.md "Data model — Firestore" and "Known
      architectural debt" for detail.

- [x] TASK-006b: Firestore reorg, part 1b: org isolation hardening (backend). Single
      org registry on the Users/{org} doc (domains plus allowed_emails; no default
      org, so unregistered emails get a 403); remove every cross-org lookup (Edo
      chat requires auth and reads only the caller's org; no collection_group
      anywhere; delete the dead dbServices.py); afterschool entries nested inside
      their month, with cascade delete; "Shared with me" via a sharedWithUids
      array; new uploads stored under the org; firestore.rules read the org
      registry. See tasks/firestore-reorg-spec.md, "Round 2" sections A–E.
      Depends on: TASK-006 done. (backend-agent)
      Result: PASS (docs-qa-agent, 2026-09-30) — `import main` succeeds; grep for
      `collection_group`/`DOMAIN_ORG_MAP`/`_find_curriculum_ref` in `backend` returns
      nothing live (comments only); `match_org` unit-checked against the exact stubbed
      cases in the task brief, all 4 correct; `dbServices.py` deleted with zero
      importers; every caller of `update_section`, `update_curriculum`,
      `get_afterschool_entry` (all 8 call sites pass `month_id`),
      `upsert_afterschool_entry`, `delete_month` (cascades to
      `months/{id}/entries`), and `get_shared_courses` (now `array_contains` on
      `sharedWithUids`) checked by grep and verified correct; Edo chat and
      populate-section now require a token via `require_org`, confirmed 401 with no
      header and 403 for an unregistered email via direct dependency calls;
      `firestore.rules` v2 syntax checked by hand (`get()`-the-org-doc pattern is
      valid, short-circuited so `callerEmail()` is never called pre-auth, email
      lowercased on both sides, `EdCube/knowledge_base` still read-only, no
      org-doc write rule). One pre-existing duplicate `list_teacher_curricula`
      method definition in `firebase_service.py` predates this task (already on
      `main`) and the second definition wins — not introduced here, not blocking,
      flagged for a future cleanup task. See `ARCHITECTURE.md`'s "Data model —
      Firestore" and "Known architectural debt" for the Round 2 detail and the
      gaps handed to TASK-007/008 (frontend `DOMAIN_ORG_MAP` still disagrees with
      the backend registry; several `curriculum.py`/`topics.py` routes still take
      a raw `teacherUid`; `GET /api/synopsis/entries/{id}` now requires
      `week_id`/`camp_id` with no current frontend caller).

## Blocked

(diagnosis-agent moves tasks here with a pointer to their DIAGNOSIS.md entry)