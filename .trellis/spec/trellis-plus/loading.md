# Policy Loading and Update Verification

## Observed entry points

`AGENTS.md` points to general Trellis workflow/specs. The installed
`get_context.py --mode packages` lists configured packages and shared guides,
not this policy namespace. `.codex/hooks/session-start.py` can discover this
top-level index but emits paths for on-demand reading, not their contents.
Current `.codex/hooks.json` registers UserPromptSubmit and SubagentStart, not
that SessionStart script. No automatic main-session policy read/startup extension
is verified here. Do not claim that spec existence enforces policy.

The Codex SubagentStart hook resolves explicit JSONL entries with file/total
limits; it does not expand Markdown links. Generated implement/check agents
fall back to reading the supplied task's manifest and every listed file plus
PRD/design/plan. No protected hook, agent or AGENTS block is patched.

## Main session and task context procedure

At task start, after interruption, before commit/archive and choosing next work:

```sh
cat .trellis/mainline.md .trellis/spec/trellis-plus/index.md
```

Read applicable details from the index. During normal planning, register the
index and each applicable detail in both implement/check manifests:

```sh
python3 .trellis/scripts/task.py add-context TASK-DIR implement .trellis/spec/trellis-plus/index.md "Project policy and loading conditions"
python3 .trellis/scripts/task.py add-context TASK-DIR check .trellis/spec/trellis-plus/index.md "Verify project policy"
```

Replace `TASK-DIR` with the authorized task directory; repeat for
`development-principles.md`, `development.md`, `validation.md` and `frontend.md`
when applicable. Register `continuity.md` and `commit-policy.md` when completion
or integration authority matters. Add approved task design/research separately.
The installed command deduplicates paths and preserves other entries.
Run `python3 .trellis/scripts/task.py validate TASK-DIR` to resolve both manifests.

Current M6 and room-control manifests explicitly include shared details; their
PRDs, plans, statuses and parent/child relationships are preserved. This session
has no active pointer and creates no task for the policy update.

For dispatch, obtain the actual task path and begin with `Active task: TASK-DIR`.
Prefer native injection; if unavailable/truncated, the child reads referenced
manifest files. Confirm resolved content rather than assuming Markdown details
were loaded. For a session intentionally skipping tasks, read applicable files
directly and do not create a task merely to obtain context.

## Start → check → archive walkthrough

For the room-control child, read approval/criteria and existing design/research;
manifests supply desktop/mobile validation and runtime constraints. Start
isolated services, probe readiness, run the room-controls pair from
`validation.md`, record actual outcomes and residual review. Before completion
read `commit-policy.md`: only after accepted checks and archive authorization
use `archive --no-commit`, verify moved completed state, then commit exact paths
with one trailer. Missing Docker/browser means `playwright-unavailable`; missing
archive interfaces mean `archive-attribution-blocked`. This is a procedural
walkthrough, not a claim that the child passed/completed/archived in this update.

## Update resilience

Additions are independent project data outside `.template-hashes.json` targets.
No backup directory was found and no recovery was used. After `trellis update`,
reread shared policy/mainline and revalidate context, wrapper, UUPM, browser and
archive interfaces. If update/provenance is unclear, inspect
`trellis update --dry-run` and newest backup read-only. Never restore Plus
behavior into protected templates or change `update.skip`. Keep personal
adapters narrow/local; they cannot replace portable discovery.
