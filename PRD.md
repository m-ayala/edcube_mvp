# EdCube — Product Requirements

Read-only source of truth for all agents except `docs-qa-agent`. If a task conflicts
with something here, the task description is probably underspecified — flag it rather
than silently picking one interpretation.

## Vision

A teacher co-pilot — not a replacement — for after-school educators designing
engaging, skill-based curricula. EdCube is a **curriculum design studio**, explicitly
distinct from an LMS like Google Classroom or Canvas: it doesn't manage rosters,
grading, or delivery. It helps a teacher go from a blank week to a ready-to-teach
curriculum, in minutes instead of hours, while keeping the teacher in full control of
every output.

## Primary users

Teachers at the India Community Center (ICC) Milpitas after-school program, teaching
grades 3-6 (ages 8-12). They have limited prep time, want to go beyond homework help,
and care about soft skills and project-based learning, not just content coverage.

## Core problem

Teachers spend 2-5 hours a week planning: searching for age-appropriate videos, finding
or building worksheets, brainstorming activities, and making sure everything aligns to
learning objectives and hangs together coherently. EdCube compresses that into a guided
generation flow the teacher reviews and edits, not one they have to build from scratch.

## Non-negotiable principles

1. **Human-in-the-loop, always.** AI assists and suggests; the teacher decides. Every
   generated output is a draft for review, never a final artifact applied silently.
   This is the platform's core competitive and philosophical differentiator versus
   fully-automated tools.
2. **Source-verified.** Generated resources (videos, worksheet content, activity
   instructions) should be traceable to a real source, not fabricated.
3. **Free content first.** Prioritize freely available educational resources (YouTube,
   open worksheets) over paid/licensed content.
4. **PLA integration.** Every course touches all four PLA pillars across its sections —
   see below. This isn't optional per-course; it's a structural requirement checked at
   generation time.
5. **Time savings as the metric that matters.** The target is a large reduction in
   planning time versus manual lesson prep — every feature decision should be weighed
   against whether it protects or erodes that.
6. **Age bands are filter lenses, not rigid walls.** Content tagged for one age band can
   be reused in an adjacent one; don't hard-silo the knowledge base by grade.

## The PLA Framework

PLA is adapted from Peter Drucker's *Management as Liberal Art* philosophy for ages
8-12. Every course must integrate all four pillars across its sections. The current
field values used in code are **Personal Growth, Core Learning, Critical Thinking,
Application & Impact** — these map onto the original conceptual pillars below; use the
current field names in code and data, the fuller descriptions here for pedagogical
reasoning.

### Self-Knowledge / Personal Growth — "Who Am I?"
Helping students understand their own feelings, strengths, interests, and how they work
with others. In practice: reflection prompts, peer collaboration, self-assessment,
emotional awareness, growth mindset. Example prompt: *"Which part of this project was
hardest for you? Why?"*

### Knowledge / Core Learning — "What Do I Need to Know?"
The core facts, concepts, vocabulary, and skills of the subject. In practice: main
lesson content, step-by-step skill building, foundational concepts. This is the pillar
most existing curricula already cover well — the other three are what make EdCube's
output distinct from a plain content dump.

### Wisdom / Critical Thinking — "How Do I Think Deeper?"
Going beyond facts to meaning, connections, and perspective — practiced through
worksheets, discussion, comparison, and explanation in the student's own words. Example:
*"Compare two different types of leaves — how are they similar? Different?"*

### Application / Application & Impact — "Why Does This Matter?"
Connecting learning to the real world — careers, community, future possibilities,
impact. Example: *"Understanding photosynthesis helps scientists fight climate change."*

Every generated section should map to one or two of these pillars (`pla_pillars` field),
and a complete course should touch all four across its full section list — this is
something `structure-agent`'s outline generation and Edo's PLA coverage flagging should
actively check for, not just record after the fact.

## Product structure (four-level hierarchy)

**Course → Section → Subsection → Block.** Sections are the top-level thematic
divisions of a course; Subsections are self-contained learning arcs within a section;
Blocks are atomic 10-30 minute units (Content, Worksheet, or Activity subtype). This
hierarchy is what `structure-agent` builds and edits — it must stay intact.

### Generation quality bar
Titles and descriptions must be specific to the actual topic and grade — never generic
placeholders like "Introduction," "Key Facts," or "Wrap Up." A subsection title should
tell a teacher exactly what happens during that block (e.g. *"Experiment: Measuring
Evaporation with Two Cups of Water"*, not *"Practice Activity"*). Learning objectives use
measurable action verbs (identify, explain, compare, demonstrate, calculate). This
specificity rule applies to every generation agent's output, not just outline — it's
enforceable and should be checked by `docs-qa-agent`.

## MVP input/output shape

**Teacher provides:** grade level (3rd-6th), subject/topic, timeframe, number of
worksheets (1-5), number of activities (1-3), free-text requirements/objectives.

**System generates:** a course outline (sections → subsections → blocks), worksheets
(PDF-ready), and activities (materials/time/resources specified) — all touching all
four PLA pillars across the course.

## Risks and how the product addresses them

- **Teachers don't trust AI-generated content** → make clear this is AI-assisted, not
  AI-automated; teachers customize everything before it's used.
- **Content quality issues** → source verification, mandatory human review, feedback
  loop.
- **Too complex to use** → simplest possible interface, guided generation over
  free-form configuration.
- **Limited adoption** → start with ICC where trust and relationships already exist
  before expanding to other after-school programs.

## Out of scope for now

- Roster management, grading, delivery (LMS functionality) — explicitly not the product
- Social/collaboration features between teachers — validate core single-teacher flow
  first, per existing product principle, before layering these on