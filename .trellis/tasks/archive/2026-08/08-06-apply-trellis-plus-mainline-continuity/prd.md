# Apply Trellis Plus mainline continuity

## Goal

Apply the updated default `$trellis-plus` enhancement set to Houkago, preserving
its existing validation and review conventions while adding a durable,
evidence-first project mainline that prevents task archives from losing the
next-step context.

## Confirmed facts

- The repository already has Trellis Plus sections for Docker command readiness,
  UUPM, Playwright validation, submit-ready human review, and Codex commit
  attribution in `.trellis/workflow.md`.
- `./dx` is the existing Docker-backed Bun wrapper; `.devhome/` is ignored, and
  the existing Codex approval rules already permit `./dx`. No competing wrapper
  or broader Docker permission is needed.
- Codex UUPM is completely initialized at `.codex/skills/ui-ux-pro-max/`.
- Playwright is configured in `packages/kyoushitsu/`, and the frontend spec
  already contains the project-specific execution profile.
- `design.md` §10.3 declares the current product mainline as room-governance
  foundation. The durable-membership foundation and hardening slices are
  archived and validated; the following room-governance product slice is not
  yet selected or approved.
- `.trellis/mainline.md` does not exist. The current `no_task` state always
  asks for task-creation consent and has no project pulse or serial exception.
- A Trellis update backup exists at `.trellis/.backup-2026-08-05T15-52-39`; no
  update is currently in progress.

## Requirements

1. Create `.trellis/mainline.md` as a tracked, `guided` control record for the
   declared room-governance initiative, with completed evidence and exactly one
   outstanding product-priority decision.
2. Add a compact `Trellis Plus: Mainline Continuity` rule to the existing
   `no_task` workflow state. Relevant continuation/status requests must run a
   read-only Project Pulse before proposing work; unrelated conversation must
   not be interrupted by a Pulse.
3. Permit serial child continuation only when the mainline record explicitly
   authorizes a bounded, ordered, ready child. Preserve normal consent for the
   default guided mode and every ambiguous, risky, scope-changing, or blocked
   case.
4. Add a post-archive handoff rule that updates the control record and returns
   to Project Pulse rather than relying on the currently unreachable
   `completed` status.
5. Preserve the existing project-specific Docker, UUPM, Playwright, review,
   and commit conventions without duplicating or weakening them.

## Acceptance Criteria

- [x] `.trellis/mainline.md` names the existing declared initiative, operating
      mode, archived evidence, ordered work state, and the one next decision;
      it does not invent a new deliverable.
- [x] `no_task` behavior can autonomously report project state and recommend a
      ready item, while only an explicit `serial` record can bypass repeated
      task-creation/start consent for listed work.
- [x] A post-archive path updates the record and runs Project Pulse; no rule
      claims the `completed` state will be injected after archive.
- [x] Existing Trellis Plus integrations and narrow `./dx` command boundary
      remain unchanged and no new UUPM, browser, Docker, hook, runtime-script,
      or task-schema infrastructure is created.
- [x] Workflow/mainline Markdown passes structural checks and a forward-read
      covers no-record, guided, serial, dirty/blocked, and post-archive cases.

## Out of scope

- Selecting the next governance feature or enabling serial automation now.
- Modifying product code, task runtime scripts, active-platform hooks, or the
  global Trellis installation.
- Replacing the existing parent/child task model with a scheduler or daemon.
