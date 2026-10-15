# Course Builder spec (replaces tasks/phase-1.5-redesign-spec.md)

Approved by the person on 2026-10-10. Clickable mockup of both pages:
https://claude.ai/artifact/Qd4knXZRdnG4Dp4dXCuNR7

The Course Builder is the step between course creation and the course workspace
(previously "Phase 1.5"). It has two stages.

## Stage 1: Course outline

- Shown only when the course has more than one day. A one-day course goes straight to
  Stage 2.
- The teacher is offered **three outlines** to choose from. Each has one card per day:
  the day's title, three skimmable bullets of what is covered, and a "leads to" line
  saying how the day sets up the next one.
- After picking one, the teacher customizes it by talking to Edo. Days Edo changed are
  marked and the change can be undone.
- Header line format: `Ages 9–11 · 12 students · 5 days · 3 hours per day`.
- The step indicator sits at the bottom; "2 · Plan each day" is the button forward.
- Coverage of the knowledge base's objective categories is shown across the course.

## Stage 2: Day planner

- Day tabs along the top, clickable. Planned days are green, unplanned days gray.
- One day at a time, as a column of 15-minute rows (hours per day × 4).
- **Every block is exactly 15 minutes.** Anything longer is split into parts
  ("Microcontrollers, part 1 of 2"), each its own draggable block.
- Teaching time is solid time. Breaks are not budgeted.
- **Hard cap.** The blocks in a day can never total more than the day's teaching time.
  When a day is full nothing can be added until a block is removed. Enforce this in
  the UI and again on the server when the plan is submitted.
- The day arrives pre-filled with a suggested plan. Extra suggested blocks wait in a
  library panel beside it.
- **Related blocks are not grouped, but are visibly linked:**
  - each topic within a day has an emoji icon, shown on every block of that topic;
  - partners that sit next to each other are joined by a line;
  - each worksheet and activity names the block it goes with and where that block is
    now, so the link survives being dragged apart;
  - pointing at a block highlights everything it goes with.
- Each worksheet and activity shows the resources it needs; the day shows a total.
- Each activity shows the group size it suits.
- Each block carries one objective category from `kb_objectives`. The day shows which
  categories are covered. Categories come from the backend, never a hardcoded list.
- "Back to outline" asks for confirmation: Stage 2 work is discarded, nothing is saved.
- Nothing in the Course Builder generates block content. That happens after "Build
  course", when the teacher enters the workspace.

## Visual style

Follow the existing course editor (`CourseEditor.jsx` palette `T`, `BLOCK_TAG` colours,
DM Sans) and Edo's existing header and bubble colours. See the mockup.

## How suggestions are produced

Code decides the shape; the AI fills it. Anything in `{braces}` below is filled in by
code, mostly from `knowledge_base_service.py`. No pedagogy is typed into the prompt.

### Prompt 1: three outlines (one call)

```
You are planning a course with a teacher.

COURSE
- Name: {course_name}
- Students: ages {age_min}–{age_max}, {num_students} in the class
- Time: {num_days} days, {hours_per_day} hours of teaching per day
- Teacher's requirements: {requirements}

WHAT SUITS THIS AGE GROUP ({age_band_label})
{age_band_developmental_notes}
{age_band_pedagogy_notes}

LEARNING OBJECTIVE CATEGORIES (the course as a whole must touch every one)
{for each kb_objectives doc: id — label — what it means}

TASK
Propose 3 outlines for this course. They must differ in how the course is organised,
not just in wording: for example one that teaches part by part, one built around a
single project that grows each day, one that opens each day with a challenge.

Each outline has exactly {num_days} days. For each day give:
- title: specific to the topic, never "Introduction" or "Wrap up"
- bullets: exactly 3, at most 12 words each, saying what is covered
- leads_to: one sentence on how this day sets up the next day. For the last day, say
  how it closes the thread of the course.
- objective_ids: the categories this day touches

Also give each outline a short name and a one-sentence description a teacher can use
to choose between them.

RULES
- Each day must need the day before it. A teacher should not be able to swap two days.
- Pitch every day at the age group above, and at what fits in {hours_per_day} hours.
- Do not name individual worksheets or activities yet. That is the next step.
- Honour the teacher's requirements in all three outlines.

Return JSON: {"outlines": [{"name", "description", "days": [{"title", "bullets",
"leads_to", "objective_ids"}]}]}
```

### Prompt 2: plan one day (one call per day, after the outline is approved)

```
Plan Day {day_number} of {num_days} of a course: "{day_title}".

THE WHOLE COURSE (approved by the teacher; do not change it)
{for each day: number, title, bullets, leads_to}

TODAY MUST COVER
{this day's bullets}

ALREADY TAUGHT ON EARLIER DAYS
{topic titles from the days planned so far}

THE CLASS
- Ages {age_min}–{age_max} ({age_band_label}): {age_band_notes}
- {num_students} students

THE TIME
- {slots} blocks of 15 minutes. Every block is exactly 15 minutes.
- Anything that needs longer is split into parts ("part 1 of 2"), each a full block
  that makes sense on its own.

FORMATS YOU MAY USE
These are already filtered to suit this age group and class size. Use only these ids.
- Content types: {id — label}
- Worksheet formats: {id — label — thinking level (recall / critical thinking / ...)}
- Activity formats: {id — label — group size — how much teacher attention it needs}

WHAT GOES WITH WHAT
{pairing table: content type → worksheet formats that test it → activity formats}

LEARNING OBJECTIVE CATEGORIES
{id — label — what it means}

TASK
1. Split today into 3 to 5 topics in teaching order. Each topic needs the one before.
   For each topic give a title, one emoji that pictures it, and a priority:
   essential, supporting or extension.
2. For each topic propose its blocks:
   - content: 1 or 2 parts
   - a worksheet that tests exactly what the content taught, in a format the pairing
     table allows for that content type
   - an activity that puts it to use, 1 to 4 parts
3. Propose about {slots_plus_extra} blocks in total, so the teacher has a few spare.

For each block give: type, format_id, title, one-line description, part and part_count,
goes_with (the block it belongs with), objective_id, group_size, and resources with
quantities worked out for {num_students} students.

RULES
- Titles say exactly what happens: "Label the Arduino board", not "Practice worksheet".
- A worksheet never asks about something its content block did not teach.
- Do not re-teach what earlier days covered unless the block is marked as revision.
- Touch every objective category today where it fits naturally; do not force one.

Return JSON: {"topics": [{"title", "icon", "priority", "blocks": [...]}]}
```

### What code does around the prompts

- Works out `slots` from hours per day; picks the age band; filters formats by age
  band and class size before the prompt sees them.
- Validates every id the AI returns against the knowledge base and drops anything
  that is not in it.
- Fills the day: essential topics first, a block's partners placed next to it, never
  more than `slots` blocks. Everything else goes to the library.
- Reports which objective categories the day and the course cover.

## Constraints

- Additive only: existing courses, routes and Firestore documents keep working. New
  fields are added; nothing is renamed or removed.
- The existing selection matrix stays available behind a toggle until the new flow is
  proven.
- Only backend-agent touches `kb_*` collections and `knowledge_base_service.py`.
- Do not run the knowledge-base seeder against Firestore; the person runs it.
- Leave Edo's existing suggestion-tray drag behaviour untouched.

## Course workspace follows Stage 2 (added 2026-10-12)

The person's direction: the Stage 2 design leads the course workspace. A course built
with the Course Builder should look the same in the workspace as it did in Stage 2:
each day's blocks in the teacher's order, with the emoji topic icons, "goes with"
links and 15-minute rows, and that arrangement must survive saving and reloading.
Older courses keep their current workspace view.

## No way back to the builder after "Build course" (decided 2026-10-13)

Once a course is built, the teacher works only in the course workspace. There is no
route back to Stage 1 or Stage 2 for a built course. Revisit later if teachers ask
for it (options discussed: re-plan one day in the Stage 2 planner; edit the outline
in Stage 1 with a warning before replacing written content).

## Correction (2026-10-14): hours are subsections; workspace stays classic

The person reviewed the built flow and corrected two things. These override anything
above that conflicts.

- **Hierarchy:** a day is a section; each HOUR of the day is a subsection; blocks are
  15 minutes, so a full hour holds four blocks. An hour subsection is a named lesson:
  the AI gives each hour a coherent theme and title (e.g. "What is a
  microcontroller?"), its blocks teach that theme, and the hours of a day are threaded
  the way the days of a course are. The emoji belongs to the hour.
- **Teaching time per day is whole hours only** in the Course Builder (no 2.5 hours).
- **Stage 2:** the day is shown as its hour subsections, each with its four 15-minute
  rows. Teachers can move blocks between hours of the same day, but an hour can never
  hold more than 60 minutes of blocks, and a day never more than its teaching time.
- **Course workspace: back to how it was.** Sections, subsections and content blocks
  in the classic editor. The Stage 2 timeline look in the workspace is removed. Kept,
  because they are invisible data-safety fixes: blocks stay in the teacher's order
  after a reload, the Profile-page loading fix, the guard that stops a save from
  stripping a course, the read-only view for a course that could not be fully loaded,
  and the plain-language save messages.

## Approved 2026-10-14: Stage 2 hours mockup, and time in the workspace

The person approved the hours-as-subsections Stage 2 mockup (Planner.dc.html in the
mockup artifact). Emojis do not need to appear in the course workspace. Time should:
each hour subsection keeps its time window (e.g. Hour 1 · 0:00–1:00, 60 minutes) and
each block its 15 minutes, shown with the workspace's existing elements, and the Info
panel keeps showing the course length (e.g. "5 days × 3h").

Contract between backend and frontend for the hour rework:
- Day plan gains `hours`: ordered `[{id, number, title, icon, start_minute,
  end_minute, capacity_blocks: 4, block_ids: [placed block ids in order]}]`. Hours are
  the lessons, so `topics` stays as the same list (`{id, title, icon, priority}`) for
  compatibility, and every block's `topic_id` is its home hour's id (library blocks
  too). `placed` stays as the concatenation of all hours' block_ids in order.
- Build request day entries gain `hours: [{id, block_ids}]` giving the teacher's final
  arrangement; the server checks no hour holds more than its capacity and no day more
  than hours × 4 blocks, and rejects (422, code `hour_over_capacity`) rather than trims.
- Saved course: day = section, hour = subsection (id = hour id, title = lesson title,
  plus `hour_number`, `start_minute`, `end_minute`, `duration_minutes: 60`), blocks
  inside in the teacher's order, each `duration_minutes: 15`.
- Course Builder courses use whole hours per day only; the server rejects a
  non-whole value with a plain message.
