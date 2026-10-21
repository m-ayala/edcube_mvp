# TASKS

Add new tasks under `## Backlog` in plain language. Run `/next-task` to process the top
eligible item. Don't edit `## In Progress` or `## Done` by hand — `docs-qa-agent` and the
coordinator manage those sections.

Format: `- [ ] TASK-XXX: description (suggested agent, optional)`

## Backlog

Public launch (plan: ~/.claude/plans/pasted-content-id-bccb-all-right-structured-pnueli.md).
One branch per task (task/TASK-XXX-slug). Stop for the person's review at the end of each phase
and before every commit. Target project edcubeai-fdba7 (Firestore DB "default").

- [ ] TASK-031: Phase 1 — accounts, plans (trial 30-day placeholder / teacher / org), one central
      config doc, the can() entitlement check, admin claim + override routes, personal workspace and
      memberships (a user can be in personal + org), account deactivation with 30-day grace; dry-run
      setup script: ICC = Org (unlimited), the person = admin + Teacher. Replaces public-release's
      free/pro and signup cap/waitlist (removals paused for OK). (backend-agent)
- [ ] TASK-032: Phase 1 — signup/login: individual via Google or email+password (no domain blocked),
      organizations via the enterprise waitlist (see TASK-035 note), one login for all, workspace switcher, email domain recorded
      at signup. (frontend-agent, small backend route)
- [ ] TASK-033: Phase 2 — credit counters: reserve → confirm/refund in transactions; trial one-time
      allowance, paid monthly on plan-start anniversary, no rollover; org pool; every AI route;
      Generate Course counts only when a usable course is produced; Edo counted per message. (backend-agent)
- [ ] TASK-034: Phase 3 — usage and cost log per AI action (user, plan, action, course, Browserbase
      search/fetch counts, model, tokens, success, time) + admin export. (backend-agent)
- [ ] TASK-035: Phase 4 — credit counters in the UI, per-feature pause, upgrade messages, admin page
      (plans, credits, cost export). NO PAYMENTS (person, 2026-10-21): every Upgrade / enterprise
      button opens "Join the waitlist for when we open paid and enterprise versions" — saves name,
      email, interest (Teacher / School-Org), school name + staff size for orgs, note; backend-only
      collection + email to the person; admin page lists it. Replaces public-release's Upgrade-to-Pro
      contact form. No price shown, nothing that implies payment. Stripe comes later as its own task.
      (frontend-agent, small backend route)
- [ ] TASK-036: Phase 5 — sharing/collaboration backend: view-only links (no account, revocable),
      owner's plan governs co-editing, 3 collaborators incl. pending invites, invites to non-users,
      lapse/resubscribe, removal, delete warning count, rules. Outlier cases 1–14. (backend-agent)
- [ ] TASK-037: Phase 5 — sharing/collaboration frontend: link viewer, invite + collaborator UI,
      live access loss in open sessions, delete confirmation. (frontend-agent)
- [ ] TASK-038: Phase 6 — forking audit: no fork/copy feature exists; only the landing-page
      testimonial mentions "fork" — reword if the person wants. (frontend-agent)
- [ ] TASK-039: Phase 7 — email domain tagging (edu/k12, excluding personal providers), admin domain
      list (user counts, newest first), data model for later org domain verification. (backend-agent, frontend-agent)
- [ ] TASK-040: Phase 8 — test suite: pytest + Firestore emulator, one test per outlier case. (docs-qa-agent)

- [ ] TASK-025 (attempt 2): Small follow-ups from QA on TASK-023/024 — build rejects a day whose
      hours list is shorter than its teaching hours (hour_missing) instead of silently
      shortening it; "1 one-hour lesson" wording; Stage 2 shows a note when a drag into
      a full hour is refused; keyboard hint mentions "Move to…" for moving between hours.
      Assigned: structure-agent (backend) and frontend-agent (page) — started 2026-10-14.
      QA FAIL (page half only) 2026-10-14: backend half passed; Stage 2 move/cap harness
      passed in full (no regression); mouse refused-drag note, hint text and hour_missing
      display passed. FAILED: the keyboard refused-drag note in PlanStage.jsx
      `refusedDragNote` (keyboard branch, ~lines 208-224) is wrong in two cases, reproduced
      in headless Chromium: (1) it picks the nearest FULL hour in the arrow direction,
      skipping a neighbour that has room: hour 2 has room, hour 1 full, ArrowUp on hour 3's
      first block moves nothing and the note says "Hour 1 is full." (misleading, names a
      non-adjacent hour); (2) ArrowDown on the last block of an hour above a full hour shows
      no note at all (ArrowUp on the first block shows it). Fix: only name the hour directly
      next to the block in the arrow direction (and only if it refuses), and make Up and Down
      behave the same. Hint text is also fine as is.
- [ ] TASK-020 (attempt 2): Edo outline reply follow-ups from QA on TASK-014 — drop model
      sentences that claim changes even without naming a day; compare against the
      cleaned original so field details are right; shorten the summary when 3 or
      more days change ("I changed Days 1–5: new titles and bullets").
      Assigned: structure-agent — started 2026-10-14.
      QA FAIL 2026-10-14: summary for 3+ days names only fields common to EVERY changed
      day (course_outline_generator.py build_change_summary, ~line 389-392), so "I changed
      Days 1–5: learning goals." hides title/bullet changes on some days (reproduced with
      stubbed output). Fix: name the union of changed fields (e.g. "I changed Days 1–5
      (new titles, bullets and learning goals).") or omit field detail. Everything else
      (filter, normalised compare, ranges, caps, dedupe, no-change, TASK-014 guarantees) passed.
- [ ] TASK-012: Update ARCHITECTURE.md and CLAUDE.md for the Course Builder and the
      knowledge-base changes. Depends on: TASK-011 done. (docs-qa-agent)

## Needs Input

- [ ] TASK-041: Org ownership gap (found during public-release work) — any org member can delete
      another member's public course and overwrite sections of any org course (delete via
      get_curriculum; populate-section / update_section lack an owner check). Already fixed for the
      public space. Fix for orgs: owner-only delete; owner or collaborate-access for section writes.
      NEEDS YOUR OK: changes org behaviour. Likely folds into TASK-036. (backend-agent)


## In Progress

## Done

- [x] TASK-030: Phase 0 — bring branch public-release (commit f4bd3fd: token auth on every route,
      public space, free/pro quotas, waitlist, usage meter, sharing by email) forward onto current main,
      resolving conflicts with the edcubeai-fdba7 migration and the Browserbase Links & Resources work.
      Carry everything over unchanged in behaviour; nothing deleted. Browserbase generate-block-links
      gets token auth and its Generate charge. Old public-release task entries renumbered so they don't
      clash with main's TASK-027..029. (backend-agent, then frontend-agent)
      Assigned: backend-agent, then frontend-agent — started 2026-10-21. Branch task/TASK-030-public-release-forward.
      QA PASS 2026-10-21: merged code imports; auth/public/usage/discovery/block-links check scripts all pass; lint 27 errors/5 warnings
      (main baseline 27/6); build passes; no conflict markers; no edcube-8fe7d outside migration scripts. Docs reconciled (old TASK-027..032 relabelled).
      Public-release history: commit f4bd3fd / CHANGELOG "Public release PR-1..PR-6". Not browser-tested; no automated test coverage.

- [x] TASK-029: Make "Links & Resources" generation follow each block's type and content, and filter
      videos. (1) Move every resource prompt into one prompts file with a "where to look" note:
      first the prompt that writes the block (outliner/block_prompts.py), then the resource
      prompts. (2) Separate planning instructions per block type: worksheet = articles on each
      item the worksheet tests, images of the actual items (both sides for matching), videos
      optional; activity and content get their own versions. Examples from several subjects
      (robotics, biology, history, chemistry, geography, art), never art-only wording. Send
      the block's subtype and minutes from the page. (3) Video filters: length cap (15 min or
      the block's length), drop YouTube age-restricted videos, age-appropriateness for the
      grade, language, relevance judged with the video description. Requested by the person
      2026-10-20 after testing TASK-027/028.
      Assigned: coordinator (built directly at the person's request for speed) — started 2026-10-20.
      QA PASS 2026-10-20: prompts moved to block_resource_prompts.py ("where to look" header, multi-subject examples marked as illustrations); video filters verified with stubs (age-restricted, too long, private/missing, not appropriate, wrong language all dropped; YouTube API failure falls back to oEmbed); real route calls with and without the new fields returned links, no 500, no keys in logs; compile ok, lint 33, build ok. Note: on the oEmbed fallback, age restriction cannot be detected (judge still checks appropriateness). No automated test coverage for this module.

- [x] TASK-028: Split the block "Links & Resources" panel into three groups: Articles, Images,
      Videos, with ONE Generate button for all three (calls the same route, now Browserbase
      per TASK-027). Depends on TASK-027's response contract (above), can be built against it.
      Images show as thumbnails (from `imageUrl`) with the caption, and clicking one opens the page it came
      from (`url`). Articles and Videos stay as link rows (rename/remove still work). Keep links in
      the block's existing `links` field, so there's no schema change. Group older saved links by type:
      "video" goes to Videos, "image" to Images, anything else (incl. old "worksheet" or no type) to
      Articles. "Add Link" and Library links: pick the group from the URL (YouTube/Vimeo is
      video, direct image file is image, else article). Generate merges with existing links
      without duplicates (same url/imageUrl) — this fixes today's repeated links. While generating,
      say it can take up to a minute; show an empty state per group. (frontend-agent)
      Note from TASK-027 QA: dedupe images on `imageUrl`, not `url` (two images can share one source page).
      Assigned: frontend-agent — started 2026-10-20.
      QA PASS 2026-10-20 (docs-qa-agent): diff limited to BlockView.jsx, CourseWorkspace.jsx, new blockLinks.js; no schema/save-path
      change (blocks are saved whole, so imageUrl/caption/type round-trip; backend has no links filter). Real TASK-027 backend run
      (10 links: 3 article, 4 image, 3 video): all landed in the right group, images all had imageUrl, re-merging added 0 duplicates.
      Lint 33 (same as main), build passes. Minor: adding a link that already exists is silently ignored (no message). No automated test coverage.

- [x] TASK-027: Switch the block "Links & Resources" Generate button (content, worksheet and
      activity blocks; route POST /curriculum/generate-block-links) from YouTube/Google Custom
      Search to Browserbase. Google Custom Search now returns 403 for every call, and the
      current queries ignore the block's own content, so different blocks get the same videos.
      Approved by the person 2026-10-19 after a test; the working prototype is
      /private/tmp/claude-501/-Users-manaswiniayala-Desktop-edcube-mvp/58a153c9-3a30-4358-b46a-b1f8d27ffc2e/scratchpad/bb_block_resources.py
      (results and HTML previews in the same folder). Port it properly; don't import from there.
      What one Generate click does:
      1. Plan: one LLM call reads the block (title + full content + subsection title,
         subject/topic, grade) and plans three groups. ARTICLES: role-specific queries
         (e.g. a student explainer, a teacher guide, a lesson plan), not generic "overview" queries.
         IMAGES: one entry per concrete thing the block names (e.g. "Louis Comfort Tiffany
         stained glass" because the block mentions it), max 3 subjects. VIDEOS: queries that
         explain/demonstrate what this block covers. A group may be empty if it doesn't fit.
      2. Search each group with Browserbase Search (POST https://api.browserbase.com/v1/search).
         Video queries need "youtube video"/site:youtube.com added or no videos come back.
      3. Read pages with Browserbase Fetch (POST /v1/fetch); for pages that come back blocked or
         thin, use ONE real Browserbase browser session per request (Playwright connect_over_cdp,
         no local browser download), because the account allows only 3 concurrent sessions. If a session
         can't be created, continue with fetch-only results instead of failing.
      4. Score articles and videos against the block (LLM, 0-10, calibrated so general topic
         background scores low). Images: take real image URLs from result pages, download each,
         and have the vision model confirm it shows the subject. Prefer museum, Wikimedia, and
         other clearly reusable sources over store listings and Pinterest. Remove the same
         picture appearing at different sizes or under two subjects.
      5. Return up to 4 articles, up to 6 images, up to 3 videos. Target under ~60 seconds
         (the prototype took 98-174s; cut candidate counts and run groups in parallel).
      Response contract (frontend TASK-028 builds against this): keep `{"links": [...]}`; each
      link has `url`, `label`, `type` where type is now "article" | "image" | "video". Image
      links also have `imageUrl` (the direct picture) and `caption`; `url` is the page it came
      from. Optional `reason` on any link. Request shape unchanged (optional extra fields are fine).
      Keep it reversible: env RESOURCE_SEARCH_PROVIDER, default "browserbase"; "legacy" runs the
      existing YouTube/worksheet path unchanged. Don't edit the old generators. Never log API
      keys (the old Google handler writes its key into error logs; don't copy that). Add any new
      dependency to requirements.txt. Note in the report that the person must add
      BROWSERBASE_API_KEY to Cloud Run before deploying (it's in backend/.env locally).
      Agents: generation-agent writes the Browserbase discovery module; then backend-agent wires
      the route and the provider switch.
      Assigned: generation-agent (discovery module), then backend-agent (route + provider switch) — started 2026-10-19.
      QA PASS 2026-10-20 (docs-qa-agent): legacy path body identical to main (only the docstring changed); request model,
      old generators, KB files untouched; py_compile passes. Real runs (Browserbase, OpenAI): Art content block 28s
      (4 articles, 4 images, 3 videos), Art poster activity block 29s (2/5/3), grade-4 water cycle block 29s (4/3/3), run
      together. Contract exact: types article|image|video, images carry imageUrl + caption, url = source page. All image
      files load as real images (200-1280px), all source pages return 200, videos are YouTube, results differ between
      the two Art blocks (one shared article), water cycle results fit the block (not Art-specific). Switch: legacy runs
      old path (YouTube only), unknown value warns and uses browserbase, missing key warns and uses legacy. Bad key or
      unreachable Browserbase returns {"links": []} in 3-4s, never a 500. INFO and DEBUG logs contain no key values,
      connect URLs or key headers; browser session started fine. Notes (none blocking): (1) near-duplicate pictures can
      still appear (Mucha "Job" and Lautrec "La Goulue" each twice as different scans in the poster block) and two
      image links can share one source page url (Guimard, components block): TASK-028's merge should dedupe on imageUrl
      for images, not on url alone. (2) One video was Spanish-language. (3) Planning prompt uses "poster activity" as an
      example only; no taxonomy from the KB is hardcoded. (4) No automated test coverage for this module.

- [x] TASK-026: Integrate the Course Builder (branch course-builder) onto the
      Firestore reorganisation (main = backend_cleanup): resolve the merge, move the
      knowledge-base additions to EdCube/knowledge_base, use org-scoped course paths.
      Assigned: backend-agent and frontend-agent — started 2026-10-15.
      QA PASS 2026-10-15 (docs-qa-agent): flag OFF is identical to a clean `git archive main`
      (backend: legacy generate-curriculum/generate-blocks/save/update/profiles/sharing/KB routes, same
      prompts, saved documents and Firestore paths with the knowledge base seeded, empty and down;
      frontend in headless Chromium: My Courses, folders, classic course, library toggle, autosave,
      Profile own and shared, designer legacy flow to generate-blocks, same requests and screen text;
      lint 33 messages identical; build passes flag off and on). Flag ON, real merged backend (model
      stubbed, Firestore faked): form, Stage 1 (Edo edit and undo), Stage 2 (library, move, more ideas),
      build, saved at Users/icc/curricula/{id}, folder add, classic workspace with "Hour 1" time once,
      autosave keeps every field and makes no second document, reload, Profile, view page. Course
      Builder prompts byte-identical to branch course-builder. Org checks 403 as designed; firestore.rules
      unchanged. Open notes (none blocking): generate-curriculum 403 leaves the designer on "Starting... 0%"
      (same in main); Course Builder planning routes have no sign-in check; the seeder also fills
      fields on existing docs and adds 5 format docs; see CHANGELOG.

(Cleared 2026-10-07 after TASK-001, 003, 005 and 006–013 were committed and deployed.
Their results are recorded in CHANGELOG.md and in this file's git history.)

Course Builder tasks, done on the course-builder branch before the reorg was merged.
NOTE: their numbers TASK-006 to TASK-025 overlap the reorg's TASK-006 to TASK-013
above; they are separate tasks. The next free task number is TASK-042.

- [x] TASK-024: Stage 2 hours — frontend. Show each day as its hour subsections, move
      blocks between hours within the per-hour and per-day caps, whole hours only on
      the course form when the Course Builder is on. Runs alongside TASK-023 against the contract in the spec. (frontend-agent)
      Started 2026-10-14. Includes keeping time visible in the workspace (see spec).
      QA pass 2026-10-14: run end to end against the real TASK-023 backend (model and save stubbed): form, Stage 1, hour cards, moves by drag, Move to, Add to Hour, ideas, review, re-plan; caps held on every route and in direct reducer calls (also plans without hours, a day at its cap, multi-part items); build saved day = section, hour = subsection in the teacher's order, 15-minute blocks, no emojis, time shown once on subsection, view and viewer pages, Info "5 days x 3h"; autosave and reload keep fields and order. All five backend deviations handled. Older courses byte-identical to HEAD (My Courses, Profile own and shared, view page, workspace, flag off and on); flag-off form identical to HEAD. Lint 33 = HEAD 33 (same messages), build passes flag off and on. Notes: dragging or arrowing into a full hour is silently refused (no note; Move to marks the hour full); arrow keys move blocks within an hour and to/from the library, but between hours only Move to works; a teacher who hand-edits the "Hour N · a–b" label (e.g. hyphen instead of en dash) gets the correct label added in front on the next load; removing it entirely makes it come back; no automated test coverage for this module.
- [x] TASK-023: Stage 2 hours — backend. Plan each day as named one-hour lessons
      (subsections) of four 15-minute blocks, threaded within the day; per-hour cap;
      build maps day = section, hour = subsection; whole hours only. Mockup approved 2026-10-14. (structure-agent)
      Started 2026-10-14. Includes keeping time visible in the workspace (see spec).
      QA pass 2026-10-14: 6,000 fuzzed model answers (no real calls): always exactly N hours, <=4 blocks per hour, <=N x 4 per day, parts whole in one hour, flagged never placed, placed == hours joined, every library block homed in a real hour, goes_with resolves in the same hour, notices correct, one retry at most (harness also catches a cap of 5 when mutated). Whole hours: 422 for 2.5/0.5/1.5 on plan-days, plan-day, day-ideas, build-course; legacy untouched. Build: every hour code returned, cross-hour move saved in the hour it was moved to, saved shape matches the contract; run through builderCourse.js: empty first-autosave diff, hour window and 60/15 minutes survive save and reload (also an empty hour); 5x3 course 189 KB. Legacy flow byte-identical. Notes: an empty hour left out of `hours` is silently dropped and later hours are renumbered (no block is lost); prompt says "1 one-hour lessons" for a 1-hour day; earlier-lesson titles cap keeps the first 200, not the latest; no automated test coverage for this module.
- [x] TASK-022: Revert the course workspace to its classic look and behaviour for
      Course Builder courses (sections, subsections, blocks in the classic editor);
      remove the Stage 2-style day view from the workspace, the view page and the
      viewer. Keep the invisible safety fixes (block order kept on reload, Profile
      fix, save guard, read-only incomplete courses, save messages). See
      "Correction (2026-10-14)" in tasks/course-builder-spec.md.
      Assigned: frontend-agent — started 2026-10-14.
      QA pass 2026-10-14: Course Builder courses open in the classic workspace, view page and viewer from My Courses, Profile (own and shared) and the build landing; rendered output identical to a HEAD build of the app (workspace, Edo open, Library, block page, view page). Older courses byte-identical to HEAD (navigation state, text, save payloads, requests). 20,000 random edit sequences (reorder, cross-day moves, delete block/subsection/section, add, legacy section mixed in) keep order, fields and day_schedule consistent; guard never tripped by a legitimate edit, still refuses a stripped remaining day. Lint 33 = HEAD 33 (same messages), build passes flag off and on. Notes: Info panel now shows "N days x Xh" for reopened built courses (HEAD shows none); stale comment at MyCourses.jsx:115 mentions the removed time cap; no automated test coverage for this module.
- [x] TASK-021: Finish TASK-013 — add a legacy ordering field and getter for worksheet
      and activity formats in the knowledge base (seeded with today's order), then
      have block_prompts.py derive those two lists from it, so every format list in
      the old flow comes from the knowledge base. Prompts must stay byte-identical.
      Assigned: backend-agent (then the two-line switch in block_prompts.py) —
      started 2026-10-14.
      QA pass 2026-10-14: 89 prompts byte-identical vs tree with only this task's hunks reverted (seed, Firestore down, label map raising, new getter raising); legacy generate_blocks identical; rename now shows in list and table together. Table labels always a subset of the list under ~30 adversarial KB cases, never raises. TASK-013's follow-up is complete. Notes: the filter that trims the table logs nothing (only malformed labels reach it); a hand edit that reorders a multi-label format's legacy_labels without legacy_order silently misorders; seeder must be run for legacy_order (see CHANGELOG).
- [x] TASK-013: Make backend/outliner/block_prompts.py read its content, worksheet
      and activity subtype lists and compatibility table from the knowledge base
      (get_legacy_label_map keeps the old strings valid), so there is one source of
      truth. Found by QA on TASK-006. Depends on: TASK-008 done. (structure-agent)
      QA pass 2026-10-14 (partial scope accepted): 1554 prompt strings byte-identical before/after (seed, Firestore down, each KB getter raising). Content subtypes + compatibility table now KB-derived; worksheet/activity lists remain literal (KB order differs). REMAINS: backend-agent adds a legacy ordering field + getter, then structure-agent switches the two lists (see CHANGELOG).
- [x] TASK-015: Expose the group-size vocabulary from the knowledge base so the day
      planner stops typing "individual / pairs / small_groups / whole_class" in its
      own code. Found by QA on TASK-008. (backend-agent, then structure-agent)
      QA pass 2026-10-14: planner/prompt output byte-identical to before with seed data; KB edge cases never raise. Notes: all-inactive group sizes returns an inactive id; seeder must be run for the 3 new collections (see CHANGELOG).
- [x] TASK-014: Edo outline edits — build the reply's summary of what changed from
      the code-side diff (changed_day_ids), so Edo never claims a change to a day
      that has no "Changed by Edo" badge. Found by QA on TASK-009. (structure-agent)
      QA pass 2026-10-14: reply's change summary is code-built from the diff; verified by stubbed runs. Notes: filter lets unverifiable non-day claims through; 5-day reply is long (see CHANGELOG).
- [x] TASK-019: Workspace follow-ups from QA on TASK-011 — when a course cannot be
      fully loaded (blocksIncomplete) open it read-only with a plain message and no
      Edit; when a save is refused, tell the teacher in words, not only a red
      "Error" chip; loading state on the Profile-page course click; fix Edo's
      unknown-length message so it does not promise a restore that may not happen.
      Assigned: frontend-agent — started 2026-10-13.
      QA PASS 2026-10-13 (docs-qa-agent): older courses identical to clean HEAD through My
      Courses and Profile (own, shared, failing save with 500 and network abort: same
      requests, payloads, screen text, red "Error" chip only). Incomplete course: no route
      reaches an editable workspace (checked by execution incl. forced stale navigation,
      back/forward), zero saves. Forced refusal: notice shown, editor locked, no save
      request sent, "Leave without saving" works. Builder save failure: notice shown,
      no automatic retry, cleared by next successful save. Profile: loading state, double
      and other-card clicks ignored, released after fetch failure and success. Lint 33 (same
      as HEAD), build passes flag off and on. Minor notes: focus drops to the page when
      the editor locks; the lock does not cover the top bar (Undo, course name, Share);
      the refusal cannot be reached from the UI today; Profile cards are not keyboard
      focusable (as before).

- [x] TASK-018: Build writes each topic's blocks into the saved sections at build
      time (not only in the top-level handsOnResources), so a built course is never
      in a "never autosaved" state. Fixes: a private course shared with a colleague
      before the owner edits it opens with empty blocks and refuses the colleague's
      saves. Found by QA on TASK-011. (structure-agent)
      QA PASS 2026-10-13 (docs-qa-agent): re-built with the real route (model and save
      stubbed): 60/60 blocks load with the top-level blocks present and stripped, failed
      and flagged blocks present, per-type order follows the day plan, first autosave is
      identical to the stored document, legacy generate-blocks byte-identical. SIZE
      FINDING (not a failure, pre-dates this task for the first autosave): a built course
      is stored about 3x (top-level blocks + sections + outline.sections); around 60
      blocks in total is about 0.75 MB of the 1 MiB document limit, and about 80 blocks
      does not fit. Over the limit the build fails and nothing is saved. Needs a decision
      from the person before the Course Builder flag is turned on.

- [x] TASK-011: Carry the Stage 2 design into the course workspace and fix the save
      path. For courses built with the Course Builder the workspace shows each day the
      way Stage 2 does (blocks in the teacher's order, emoji topic icons, "goes with"
      links, 15-minute rows), and saving and reloading keeps block order, topic icons
      and the other Course Builder fields. Older courses keep working as they are.
      Also the small TASK-010 QA items, and the planner's technical warnings are no
      longer shown to teachers. The flag stays OFF: the person turns it on after a real
      end-to-end run. (frontend-agent) (The needs_review hand-off keys moved to TASK-016.)
      Assigned: frontend-agent — started 2026-10-13.
      Attempt 1: QA FAIL 2026-10-13 (docs-qa-agent). One blocking defect: a built course opened from the
      Profile page (own public, or shared with you) lost its Course Builder structure and the first autosave
      overwrote it. Everything else passed.
      Attempt 2: QA PASS 2026-10-13 (docs-qa-agent). Profile page fixed (own and shared, fetch allowed and
      refused, never-autosaved and autosaved: opens in the day view, autosave loses nothing field by field,
      executed in headless Chromium with saves captured, not forwarded). Save guard never blocked a
      legitimate save (emptied day, renamed days, added block, reorder, Back then Edit again) and holds
      across Back/Edit. Older courses identical to a clean HEAD tree (navigation state, screen text, saved
      payloads, requests) through My Courses and the Profile page (own and shared), flag on. Cap, Edo tray
      add (full day, unknown-cap day, after a delete), hidden chips verified; lint 33 identical to HEAD;
      build passes flag off and on; flag default OFF; no backend files changed. Person decision 2026-10-13:
      no way back from the workspace to the Course Builder after build (recorded in the spec).
      OPEN FOLLOW-UPS (need tasks from the person, not blocking the first solo run):
      (1) Backend: a built course that was never edited in the workspace has no block arrays in its saved
      sections (blocks only in top-level handsOnResources), and GET /api/curricula/{id} refuses a
      collaborator on a private course while the shared-with-me list omits handsOnResources/numDays/
      hoursPerDay, so a private shared built course that the owner never edited opens with every block
      "Content not written yet" and (for collaborators) saving is refused. Best fix: build-course saves the
      block arrays into the sections at build time (or the two list routes return handsOnResources).
      (2) Frontend: when the workspace is opened with blocksIncomplete, show a visible explanation and make
      it read-only; today the only sign is a red "Error" chip while edits are silently not saved.

- [x] TASK-017: Library top-up fixes from QA on TASK-016 — put a time limit on a
      stalled top-up so it cannot hold the end of planning; send each day's library
      as soon as it is ready instead of at the next day boundary; make the
      "needs review" notice count correct when both the plan and the top-up have
      flagged ideas; small wording items.
      Assigned: structure-agent — started 2026-10-13.
      QA PASS 2026-10-13 (docs-qa-agent). Backend only, two files. Stubbed real-timing runs: a hung top-up is
      cut at the limit and plans_complete still arrives; each day_library goes out when its top-up finishes
      (slower/equal/faster than next day's planning); no hangs, leaked tasks or stray task errors across
      disconnect, crash, fatal and single/all-failed cases; review-notice count right in all four cases via
      stream and /plan-day. Legacy output byte-identical. No automated test coverage for this module.
      OPEN FOLLOW-UP (frontend, needs a task from the person): GenerationContext.jsx addIdeasTo appends day_library
      notices, but the backend sends the full replacement list, so when the plan AND the top-up both flag ideas the
      teacher sees two "needs review" notices (the plan's count and the corrected total).

- [x] TASK-016: Day planner follow-ups from QA on TASK-010 — fill each day's library
      automatically (one extra ideas call per day, after the day's plan is sent);
      return teacher-facing notices separately from technical warnings; carry
      needs_review / review_note through the build hand-off.
      Assigned: structure-agent — started 2026-10-13.
      QA PASS 2026-10-13 (docs-qa-agent). Backend only; legacy generate-blocks output byte-identical to
      HEAD (LLM stubbed); 1500 randomised stubbed plans with top-up (cap, unique ids, no top-up block
      placed, coverage recomputed, notices free of ids) 0 failures; top-up skip/off/failure/garbage
      leave the day intact; hand-off flags and wrong types checked; 2 real calls (plan 12 s, top-up 6 s,
      +6 library blocks). Known gaps (not blocking): no time limit on a stalled top-up, merged
      review-notice count understated, top-up events arrive a day late. No automated test coverage.

- [x] TASK-010: Course Builder, Stage 2 page — day tabs, 15-minute timeline, library,
      drag and drop, emoji topic icons with partner lines and "goes with", hover
      highlight, hard time cap, objective coverage from the backend, materials total,
      back-to-outline confirmation. See tasks/course-builder-spec.md and the mockup.
      Depends on: TASK-008 done. (frontend-agent)
      Also: show the "needs review" badge and note on flagged library blocks and
      prompt a rename before one is built; tolerate the build_notes event and show
      its notes; mirror NEEDS_REVIEW / REVIEW_NOTE in the frontend schema constants.
      Also the small TASK-009 QA items (focus after Undo/Send, Edo reply announced,
      shell cleanup not wiping an in-flight generation). The flag stays OFF by
      default; TASK-011 flips it once built courses reopen correctly.
      Assigned: frontend-agent — started 2026-10-12.
      QA PASS 2026-10-13 (docs-qa-agent). Flag-off path inert; BLOCK_TAG/T/FONT value-identical to
      HEAD; lint 33 identical to HEAD message-by-message; build passes with the flag on and off.
      Hard cap executed on the reducer (slots-1/slots/slots+1, multi-part with too few free slots,
      slots 0, rapid adds, ideas into a full day, review into a full day, no cross-day mutation) and
      in a real Chromium DOM (mouse and keyboard drags into a full day refused; reorder works).
      Build request proven against the real backend route (save stubbed): teacher's order kept, 422
      over-cap maps to the right day. Not verified: real Firebase auth, real taxonomy route, real
      build-course write, screen readers. Minor notes for later: a day stays "needs attention"
      after a failed build until the next build; day-ideas and re-plan results carry no stale-run
      guard (harmless today as day ids are unique per outline); review rename matches on
      part_group_id (backend always sets it). Product follow-ups: library is empty on real plans
      (consider fetching ideas per day in the backend planner); backend warnings shown verbatim.

- [x] TASK-009: Course Builder, Stage 1 page — three outline choices, day cards, Edo
      customisation with changed-day badges and undo, objective coverage, bottom step
      indicator. Skipped for one-day courses. Behind a toggle so the existing
      selection matrix keeps working. See tasks/course-builder-spec.md and the
      mockup. Depends on: TASK-007 done. (frontend-agent)
      Assigned: frontend-agent — started 2026-10-12.
      QA PASS 2026-10-12 (docs-qa-agent), by code reading, lint/build and flag-on build only (no
      browser run): flag-off path inert, theme constants value-identical to HEAD, lint identical to
      HEAD (33 problems, same files and rules), build passes on and off. Minor follow-ups: focus lost
      after Undo/Send, Edo reply not in a live region, "Age 8" for equal ages, Edo reply text can
      name a day that has no badge (see report).

- [x] TASK-008: Course Builder, Stage 2 backend — plan a day using Prompt 2 in
      tasks/course-builder-spec.md: topics with emoji icon and priority, 15-minute
      blocks with parts, goes_with, objective category, group size and resources.
      Code-side slot filling (essential first, partners adjacent, never over the
      day's time), id validation against the knowledge base, server-side hard cap on
      submit, and keep the new fields through save. Replaces the fixed 15/15/30
      duration constants. Depends on: TASK-006 done. (structure-agent)
      Also fixes the small TASK-007 QA findings (edit-route error codes, input
      validation and length caps, reordered days on edit).
      Assigned: structure-agent — started 2026-10-10.
      Attempt 1 QA 2026-10-10: not passed on 3 small defects (model-supplied list/dict ids crashed
      the planner with a 500; strict mode with >40 students left no activity options; the
      pairing repair swapped a format silently). Fixed by structure-agent 2026-10-12.
      QA PASS attempt 2 2026-10-12 (docs-qa-agent): all three defects verified fixed (stub fuzz
      of 3000 plans plus more-ideas fuzz, strict mode at 41/100/500 students, flagged-block
      flow with every bad fix-call answer); round 1 invariants hold with flagged blocks; build_notes
      emitted first and only when there are notes; legacy generate-blocks output byte-identical
      to HEAD; knowledge base, orchestrator and main untouched. One real model call: the fix
      call retitled all three offenders sensibly. Open items for the person: (1) needs_review and
      review_note are not carried through build-course, so a flagged block the teacher drags into
      the day is built without the flag: TASK-010 must show the flag and note and ask for a
      rename before build; TASK-011 (save path) should keep the two fields (add to the hand-off
      block keys); (2) minor: a fixed title is not checked against sibling titles; a real bug
      inside plan normalising is reported as an unreadable answer (502) and logged without a
      stack trace; the fix prompt names the group-size words instead of reading them from the
      knowledge base; a day where every worksheet and activity is flagged starts under-filled
      (content blocks only); (3) frontend must tolerate the new build_notes event (no phase or
      message fields); (4) no automated tests.

- [x] TASK-007: Course Builder, Stage 1 backend — generate three outline options (per
      day: title, 3 bullets, leads_to, objective ids) using Prompt 1 in
      tasks/course-builder-spec.md, built from knowledge_base_service.py data. For
      multi-day courses generation stops after the outlines; day planning runs only
      after the teacher approves one. Edo can edit the chosen outline and reports
      which days it changed. Depends on: TASK-006 done. (structure-agent)
      Assigned: structure-agent — started 2026-10-10.
      QA PASS 2026-10-10 (docs-qa-agent): diff of routes/curriculum.py is 111 added, 0
      removed; flow absent/legacy/other value runs the original path (stub-verified);
      validation, retry, id stamping, code-side diffing and no-mutation verified with
      stubs. Open items for the person: (1) edit-outline returns 500 (not 502) on
      OpenAI quota/auth errors and outline-to-sections returns 500 when bullets is not
      a list; (2) new routes have no auth and message/conversation_history/outline are
      unbounded, same as neighbouring creation routes; (3) the 12-word bullet limit is
      prompt-only, not checked in code; (4) KB lookup blocks ~2-4s once per process
      without Google credentials, then falls back (backend-agent, low priority).

- [x] TASK-006: Course Builder, knowledge base — add to the knowledge base: thinking
      level on worksheet formats; group size and teacher-attention on activity
      formats; suitable age bands on all formats; age-band notes; the content type →
      worksheet → activity pairing table; move the content/worksheet/activity subtype
      lists and compatibility table out of backend/outliner/block_prompts.py into the
      knowledge base; add lookup functions and a read-only route for the frontend;
      make the seeder stop overwriting hand-edited values. Do not run the seeder.
      See tasks/course-builder-spec.md. Assigned: backend-agent — started 2026-10-10.
      QA PASS 2026-10-10 (docs-qa-agent): additive vs HEAD verified; all legacy subtype
      strings and every pair in WORKSHEET_SUBTYPE_COMPATIBILITY map to kb ids; fallback
      works with Firestore failing; route read-only and auth-gated. Open items for the
      person: (1) block_prompts.py still holds its own copies of the lists (not moved,
      outside backend-agent's files) -> needs a structure-agent/generation-agent task to
      read from the kb, otherwise two sources of truth; (2) class_size is a hard filter,
      so class sizes above ~30 return almost no activities; (3) all pedagogy values are
      first drafts needing teacher review; (4) seeder not run, no automated tests.


## Blocked

(diagnosis-agent moves tasks here with a pointer to their DIAGNOSIS.md entry)