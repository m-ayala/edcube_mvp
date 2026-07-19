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

**Collection: `curricula`** (one document per course)

Field names are defined once in `backend/schemas/curriculum_schema.py`
(`CurriculumFields`, `SectionFields`, `TopicFields`) and mirrored in
`frontend/src/constants/curriculumSchema.js`. **These two files must be kept in sync —
this is the same hardcoded-mirror problem `blockCategories.js` had; any agent editing
one must check the other.** Ownership: `backend-agent` owns the Python source of truth,
`frontend-agent` owns the JS mirror, and a schema change is always a two-file task
across both agents in the same task, not something either does alone.

Key fields:
- `courseId`, `teacherUid`, `teacherEmail`, `organizationId`
- `courseName`, `class` (grade), `subject`, `topic`, `timeDuration`, `objectives`
- `outline.sections[]` — each section has `id`, `title`, `description`,
  `duration_minutes`, `topics[]`, `pla_pillars[]`, `learning_objectives[]`,
  `content_keywords[]`, plus Phase 2 fields (`video_resources`,
  `search_queries_used`, `content_coverage_status`) and Phase 3 fields
  (`worksheet_options`, `activity_options`, `needs_worksheets`, `needs_activities`)
- `isPublic`, `sharedWith[]`
- `createdAt`, `lastModified`

**Collection: `teacher_profiles`** — `teacher_uid`, `display_name`, `email`,
`subjects_taught[]`, `grades_taught[]`, `bio`, `profile_picture_url`, `org_id`

**Collection: `course_folders`** — organizational grouping for a teacher's courses

**Collections: `kb_age_bands`, `kb_objectives`, `kb_worksheet_formats`,
`kb_activity_formats`, `kb_content_formats`** (and future `kb_examples`) — the taxonomy
knowledge base. Owned exclusively by `backend-agent`; see the KB ownership rule in
`CLAUDE.md`. These replace pedagogy that used to be hardcoded across prompt files and
`blockCategories.js`.

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

- `frontend/src/.../blockCategories.js` may still be a hardcoded array mirroring an
  older version of KB taxonomy rather than fetching live from a backend endpoint — see
  the corresponding `TASKS.md` entry. Until fixed, treat any taxonomy shown in the
  frontend as potentially stale.
- No automated test suite exists yet (no pytest, no jest/vitest — only eslint on the
  frontend). `docs-qa-agent` verifies by other means until this is built out.
- The knowledge base collections (`kb_*`) are being built out but not yet wired into
  generation prompts — `prompt_builder.py` may still contain some hardcoded pedagogy
  that should eventually pull from `knowledge_base_service.py` instead.

## Agentic dev system (meta — how this repo is built)

This repo is developed using a task-queue-driven multi-agent Claude Code setup. See
`CLAUDE.md` for the full explanation, `TASKS.md` for the active queue, and
`.claude/agents/*.md` for each agent's exact ownership and rules. This section exists so
that anyone (including a future agent) reading `ARCHITECTURE.md` understands that the
codebase itself is built this way, not just documented this way.