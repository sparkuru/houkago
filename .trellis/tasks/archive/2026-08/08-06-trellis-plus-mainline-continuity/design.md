# Design: Trellis Plus mainline continuity

## Model

The enhancement adds a small project control record, not a new task system.
`.trellis/mainline.md` points to the current initiative parent and records the
approved sequencing policy. Existing parent/child task artifacts remain the
source of requirements, technical design, execution plan, validation, and
archive history.

```text
mainline record -> initiative parent -> ready child -> task lifecycle
                                             ^              |
                                             +-- pulse <----+
```

## Continuation modes

| Mode | Default behavior | Authority boundary |
| --- | --- | --- |
| `guided` | Run a read-only Project Pulse and recommend one action. | Never create a task or edit code until the user chooses. |
| `serial` | Continue one ready, listed child after each clean archive. | Requires explicit authorization for that bounded initiative; stop on ambiguity, risk, scope change, or unmet dependency. |
| `paused` | Report state only. | No task creation or implementation. |

No mode authorizes the agent to infer a new project objective. When the record
has no declared initiative or the candidates are not uniquely ordered, the
Pulse reports evidence and asks the user for one product-priority decision.

## Project Pulse

The injected no-task behavior is read-only and activates for project-relevant
requests such as continuing work, requesting progress/next steps, beginning
implementation, or immediately after a task archive. It reads the mainline
record, active/archived task evidence, git state, and available validation
results. It emits: current initiative, completed evidence, blocker/dirty-state
warning, one ready candidate when determinable, and the next permitted action.

It must not run as a distracting response to an unrelated conversational
question merely because no task is active.

## Coordination protocol

The main session owns phase selection, dispatch, acceptance-criteria mapping,
commit, archive, and mainline update. Child agents perform only the bounded
research, implementation, or check responsibility in the active child task.
They must report changed files, validation, and unresolved decisions back to
the conductor; they do not select a new child or run project-level cleanup.

The reference directs `serial` execution through the existing normal lifecycle
for each child. The initial serial authorization substitutes only for repeated
task-creation / plan-start consent when the child is listed, ready, and has no
new decision. It does not waive required planning artifacts, checks, or stop
conditions.

## Injection design

`SKILL.md` gains a default-registry entry and a concise discovery/injection
pointer. The detailed procedure lives in one new `references/` file. The
skill's UI metadata is regenerated to mention mainline continuity. Later
`trellis-plus` applications patch a target project's `.trellis/mainline.md`
and `.trellis/workflow.md`; no hook code is needed because the existing
workflow-state injector parses workflow blocks verbatim.

## Compatibility and rollback

The installed enhancement defaults to `guided`, so a repository without a
declared mainline remains conservative. Removing the injected workflow block
and `.trellis/mainline.md` restores today's behavior; no runtime data migration
or task-schema change is required. The reference must state that `completed`
cannot be used as a post-archive trigger in the current Trellis lifecycle.
