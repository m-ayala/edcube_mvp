Read TASKS.md and find the first item under ## Backlog that is not checked off and not
marked [BLOCKED].

If there are no eligible tasks, tell me the queue is empty and stop. If the only
remaining items are about adding test coverage, ask me directly whether docs-qa-agent
should spend this turn adding tests to a specific module — don't start on your own.

Otherwise, for the task you picked:

1. Verify the task's assumptions against the actual code before delegating anything.
   Grep for the files, functions, or routes the task description references — don't
   trust the description at face value. Two outcomes:
   - **Reality matches the description:** proceed normally to step 2.
   - **Reality diverges in any way that changes the delegation plan:** stop. Don't touch
     any implementation file. Move the task from ## Backlog to ## Needs Input in
     TASKS.md, including what you found (with file/line references) and a proposed
     delegation plan. Report it to me in chat and wait — don't delegate to any agent
     until I reply "proceed," "go ahead," or edit the task description myself.

2. Read the task description. Decide which agent(s) it belongs to based on the
   ownership boundaries defined in each `.claude/agents/*.md` file. Most tasks belong
   to exactly one agent — if a task genuinely needs two (e.g. a new KB field plus the
   frontend fetch that reads it), split it into an ordered sequence and say so before
   proceeding.

3. Move the task from ## Backlog to ## In Progress in TASKS.md, noting the assigned
   agent and today's date.

4. Delegate to that agent via the Task tool. Pass it the full task description plus
   any relevant context from PRD.md or ARCHITECTURE.md if the task references product
   or architecture decisions.

5. When the implementer agent reports back, delegate to docs-qa-agent to verify.

6. If docs-qa-agent passes the task: it will move the task to ## Done in TASKS.md and
   append to CHANGELOG.md. Report the outcome to me in a few sentences — what changed,
   which files, anything worth knowing.

7. If docs-qa-agent fails the task: check how many attempts this task has had (look for
   an "(attempt N)" note next to it in TASKS.md). If this is attempt 1, increment the
   attempt count, move it back to ## Backlog, and stop — don't retry automatically. If
   this is attempt 2 or more, delegate to diagnosis-agent instead of retrying again, then
   report its findings to me.

Never skip the docs-qa-agent verification step. Never mark a task done yourself — only
docs-qa-agent does that, after actually checking the work.