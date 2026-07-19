# EdCube — Agent System Conventions

This file is read automatically by every Claude Code session in this repo. It explains
how the multi-agent system works so you don't need to re-explain it each time.

## What this system is

A solo-founder-scale agentic pipeline: tasks get added to `TASKS.md` by the person, and
running `/next-task` picks the next one, delegates it to the right specialist agent,
verifies it, and reports back. There is no separate "coordinator" agent file — the main
session itself acts as coordinator, following this file and `.claude/commands/next-task.md`.

## The agents

| Agent | Owns |
|---|---|
| `backend-agent` | Infra, schema, orchestrator, prompt_builder.py, ALL of the knowledge base (`kb_*` collections, `knowledge_base_service.py`) |
| `structure-agent` | Outline generation + Edo (Course→Section→Subsection→Block hierarchy) |
| `generation-agent` | Content, worksheet, activity, and PPT generation |
| `frontend-agent` | `frontend/src/**` |
| `docs-qa-agent` | Verification, tests, `TASKS.md`/`CHANGELOG.md` status, doc maintenance |
| `diagnosis-agent` | Circuit breaker for repeated failures — writes to `DIAGNOSIS.md` only |

Full definitions with exact file ownership live in `.claude/agents/*.md` — read the
relevant one before delegating if you're unsure of a boundary.

## The one hard rule: knowledge base writes

Only `backend-agent` writes to `kb_*` Firestore collections or edits `knowledge_base_service.py`.
Every other agent calls into `knowledge_base_service.py` (imports its functions) but never edits it
and never touches Firestore directly. If an agent needs a KB change, that becomes a
task for `backend-agent` — it does not work around the boundary.

## Source-of-truth docs (read-only to all agents except docs-qa-agent)

- `PRD.md` — product requirements, the PLA pedagogical framework
- `ARCHITECTURE.md` — system architecture, data flow, schema shapes

Agents should check their work against these, not just against the task description.

## Working principles (apply to every agent)

- **Additive over destructive.** Existing courses, existing function signatures, and
  existing Firestore documents must keep working after any change.
- **Behavioral over path-prescriptive.** When a task doesn't specify an exact file path,
  agents should discover the right location by reading the existing code, not guess.
- **Human-in-the-loop.** AI-suggested changes are visible, reversible, and explainable
  to the teacher — never silently applied.
- **No hardcoded pedagogy.** If an agent is about to hardcode a taxonomy value instead
  of pulling it from `knowledge_base_service.py`, that's a signal to file a `backend-agent` task
  instead.

## The task loop

1. Person adds a line to `TASKS.md` under `## Backlog`.
2. Person runs `/next-task`.
3. Coordinator (this session) delegates, per `.claude/commands/next-task.md`.
4. `docs-qa-agent` verifies before anything is marked done.
5. Failures retry once automatically; a second failure goes to `diagnosis-agent`, which
   halts the loop and writes a report to `DIAGNOSIS.md` instead of retrying further.
6. Nothing is committed or pushed automatically — the person reviews the diff first.

## Current known gaps (update this section as they close)

- No automated test suite exists yet (no pytest, no jest/vitest — only eslint on the
  frontend). `docs-qa-agent` verifies by other means until this is built out, and only
  works on test coverage when the person explicitly approves it.
- `frontend/src/.../blockCategories.js` already fetches live from Firestore's
  `kb_objectives` collection, with the hardcoded array kept only as a fallback shown
  before that fetch resolves — it is not a stale hardcoded mirror. The actual problem is
  that this fetch reads Firestore directly from the frontend, bypassing the backend
  entirely, which violates the spirit of the KB-write-boundary rule above even though
  it's a read, not a write. `knowledge_base_service.py` already has `get_objectives()`;
  there is no FastAPI route exposing it yet. See `TASKS.md`'s `## Needs Input` section
  for the current fix plan.


  ## Autonomy policy for subagents

Default to proceeding without asking. Only stop and ask me first if:
- The decision is destructive or hard to reverse (schema changes, 
  deleting/renaming existing behavior, changing something another 
  feature already depends on)
- It contradicts something I explicitly said elsewhere
- There's genuinely no reasonable default — not just multiple valid 
  options, but no basis for picking one

For everything else — including "this needs a small new backend 
route" or "this taxonomy should live in a shared file" — pick the 
most reasonable approach yourself, note what you chose and why in 
the task file or commit message, and keep going. I'll review the 
reasoning after the fact rather than approving it beforehand.