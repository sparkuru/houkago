# Implementation plan: apply mainline continuity to Houkago

1. Add the evidence-backed guided `.trellis/mainline.md` control record.
2. Add the narrow continuity subsection to `[workflow-state:no_task]`, align
   the corresponding Phase 1 consent wording, and add the Phase 3.5 archive
   handoff without altering existing Plus blocks.
3. Verify Markdown structure and search the workflow for required boundaries;
   forward-read the no-record/guided/serial/blocked/post-archive decisions.
4. Use Trellis check to review scope, test evidence, and workflow consistency;
   update specs only if a project-specific reusable convention is not already
   captured by the mainline record/workflow.

## Validation commands

```sh
git diff --check
rg -n 'Trellis Plus: Mainline Continuity|Project Pulse|serial authorization|completed' \
  .trellis/workflow.md .trellis/mainline.md
python3 ./.trellis/scripts/task.py validate 08-06-apply-trellis-plus-mainline-continuity
```
