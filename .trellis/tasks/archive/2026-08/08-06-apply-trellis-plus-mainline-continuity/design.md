# Design: apply mainline continuity to Houkago

## Existing baseline

Houkago has a single durable project blueprint in `design.md`. Its §10.3
declares room-governance foundation as the current mainline and excludes
content-discovery expansion. Two flat archived tasks supplied the completed
membership implementation and hardening evidence; no active parent task exists
for that initiative. The control record will therefore reference `parent task:
none` and point to those archived task/commit facts rather than fabricating a
parent retroactively.

## Mainline record

The new `.trellis/mainline.md` is project data and remains intentionally small:

- initiative: room-governance foundation, with objective and source link to
  `design.md` §10.3;
- mode: `guided`; serial authorization: `none`;
- ordered work: completed foundation/hardening entries and one blocked
  “choose next bounded governance slice” entry;
- evidence: the two work commits and their full-suite/browser validation;
- next decision: select one concrete follow-up from the blueprint's permitted
  categories before another task exists.

This record is navigation only. The next selected work still becomes an
ordinary Trellis task with its own PRD, plan, context manifests, validation,
commit, and archive history.

## Workflow integration

Patch the current `[workflow-state:no_task]` block in place:

1. For a relevant continuation, status, next-step, or implementation request,
   read the control record, task/archive evidence, git state, and validation
   evidence; report the Project Pulse before acting.
2. `guided` recommends a uniquely ready child but retains the existing
   task-creation consent requirement.
3. A `serial` exception is valid only when the record contains explicit user
   authorization, an ordered ready child, and no stop condition. It does not
   waive task artifacts, checks, review gates, or archive evidence.
4. An absent record/objective, multiple candidates, a dirty tree, failed or
   incomplete verification, new risk, scope change, or dependency blocker
   stops for direction.

Add a concise Phase 3.5 handoff: before/after archiving, update the record's
evidence and return to Project Pulse. Do not use `completed`; archive removes
the active task before the state injector can expose that status.

## Compatibility

All existing Trellis Plus blocks stay intact. The no-task behavior is modified
only by an additive subsection and retains normal consent outside a recorded
serial authorization. Because the workflow-state hook parses this block
verbatim, no hook code needs changing. The existing update backup is discovery
evidence only; no `trellis update` command is needed for this local patch.
