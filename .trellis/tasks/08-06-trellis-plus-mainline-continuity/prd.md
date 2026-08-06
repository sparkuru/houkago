# Trellis Plus mainline continuity

## Goal

Make mainline continuity a default `trellis-plus` enhancement so Codex can
maintain a project-level direction across task boundaries: inspect the current
state, dispatch bounded sub-agent work for an approved task, complete its
verification and archive loop, then identify and safely continue the next
approved point.

## Confirmed facts

- `trellis-plus` is normally applied once at project initialization, so an
  opt-in follow-up enhancement would not reliably be installed later.
- Trellis already supplies parent/child tasks, session-scoped active-task
  pointers, workflow-state injection, and implement/check agent roles. The
  missing layer is a durable project-mainline record and a no-task continuity
  policy.
- The normal `completed` workflow state cannot drive post-archive continuation:
  archive moves the task before the active-task resolver can expose it.
- The existing Codex agents correctly keep coordination in the main session;
  their recursion guard must remain intact.
- The target skill lives in the separate shared agent-skills repository. Its
  worktree currently has an unrelated modified file (`mtf/init-dpkg.sh`) that
  this task must not stage, revert, or otherwise alter.

## Requirements

1. Add mainline continuity to the default `trellis-plus` enhancement set and
   make its triggering description discoverable.
2. Supply a concise reusable reference that directs later agents to install a
   durable `.trellis/mainline.md` control record while retaining Trellis
   parent/child tasks as the sole source of actual deliverables and acceptance
   criteria.
3. Define an evidence-first, read-only Project Pulse for relevant no-task,
   continuation, and post-archive moments. It must report state and recommend
   the next action without inventing a product goal from code alone.
4. Define `guided`, `serial`, and `paused` continuation modes. `guided` is the
   default; `serial` is available only after explicit user approval of a
   bounded roadmap and may continue only ready, already-approved child work.
5. Keep the main session as conductor. Research, implementation, and checking
   sub-agents must receive bounded task scope and cannot choose project
   direction, archive independently, or recursively dispatch their own
   implement/check workers.
6. Preserve existing Trellis task-creation and safety boundaries whenever no
   approved serial roadmap exists; risky, ambiguous, or scope-expanding work
   remains a user decision.
7. Keep the skill concise, reference-driven, update-resilient, and compatible
   with repositories that have no active task or no declared project goal.

## Acceptance Criteria

- [x] A plain `$trellis-plus` invocation reads and applies the new continuity
      reference alongside the existing default enhancements.
- [x] The reference has an exact mainline record template, Project Pulse
      decision table, continuation authorization boundaries, conductor/worker
      protocol, patch locations, and verification checklist.
- [x] The default mode can analyze and recommend in `no_task` state without
      creating a task or editing product files.
- [x] Explicit serial authorization can safely carry an approved, ready child
      through task creation, plan, implement, check, commit, archive, and the
      next Project Pulse; it stops on defined decision boundaries.
- [x] The skill makes no claim that the unreachable `completed` state drives
      continuation and does not create a parallel task system.
- [x] `SKILL.md` and `agents/openai.yaml` remain valid, the new reference is
      linked from the skill, and unrelated changes in the target repository
      remain untouched.

## Out of scope

- Changing the Trellis CLI, its global installation, or the generated task
  runtime scripts.
- Automatically ranking an unapproved product backlog or starting work whose
  objective cannot be established from a declared mainline.
- Replacing Trellis parent/child tasks with a second scheduler, persistent
  daemon, or channel worker pool.
- Editing the target shared repository's unrelated worktree changes.
