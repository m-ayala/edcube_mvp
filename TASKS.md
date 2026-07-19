# TASKS

Add new tasks under `## Backlog` in plain language. Run `/next-task` to process the top
eligible item. Don't edit `## In Progress` or `## Done` by hand — `docs-qa-agent` and the
coordinator manage those sections.

Format: `- [ ] TASK-XXX: description (suggested agent, optional)`

## Backlog

- [ ] TASK-001: Wire blockCategories.js to fetch live taxonomy from a backend endpoint
      instead of using a hardcoded array (backend-agent for the endpoint, then
      frontend-agent for the fetch)
- [ ] TASK-002: Phase 1.5 redesign, part 1/3 — content library panel (subsection
      cards with drag handle, individually draggable block chips, suggested badge
      for Edo-proposed subsections, gated behind a toggle/feature flag). See
      tasks/phase-1.5-redesign-spec.md section 1. Depends on: nothing. (frontend-agent)
- [ ] TASK-003: Phase 1.5 redesign, part 2/3 — day lanes panel with copy-on-drop
      (fresh unique id per copy, subsection drop renders grouped card, single block
      drop renders standalone chip). See tasks/phase-1.5-redesign-spec.md section 3.
      Depends on: TASK-002 done. (frontend-agent)
- [ ] TASK-004: Phase 1.5 redesign, part 3/3 — per-block format/topic dropdowns with
      strictly local, per-copy-id edit scoping (never mutates the library original or
      other copies). See tasks/phase-1.5-redesign-spec.md section 2. Depends on:
      TASK-003 done. (frontend-agent)

## Needs Input

A task lands here, instead of being implemented or silently reinterpreted, when
investigating it reveals that the task description's assumptions don't match the actual
code. Each entry should include what was found (with file/line references) and a
proposed delegation plan. Nothing proceeds on an entry here until the person replies
"proceed," "go ahead," or edits the task description themselves.

## In Progress

(empty)

## Done

(empty)

## Blocked

(diagnosis-agent moves tasks here with a pointer to their DIAGNOSIS.md entry)