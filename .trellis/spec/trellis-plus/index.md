# Trellis Plus Project Policy

- ownership: project-shared
- source: project-authored
- tracking: commit this index and its project-owned detail files

Read this policy on every Trellis Plus run, at task start, after a substantial
interruption, before commit/archive, and when choosing subsequent work.
It supplements the installed Trellis workflow without modifying its runtime.

## Rules and loading conditions

| Policy | Load when | Required action |
| --- | --- | --- |
| [Development principles](development-principles.md) | Every development task | Preserve user work, limit scope and verify actual behavior |
| [Development and environment](development.md) | Before development, preview or configuration changes | Reuse `dx`; enforce the preview lifecycle, root `.env`, mandatory unified console/address-discovery and verification contract |
| [Frontend integration](frontend.md) | User-visible UI planning, implementation or review | Use project-local UUPM and approved task decisions; classify mobile coverage |
| [Visual and experience contract](visual-experience.md) | Every user-visible page, component, copy, theme, motion or interaction change | Preserve Warm Club identity and shared mental model; inspect all eight quality dimensions and iterate until no obvious improvement remains |
| [Validation and human review](validation.md) | Planning checks and reaching submit-ready | Run desktop/mobile checks before requesting residual human review |
| [Commit and archive policy](commit-policy.md) | Commit planning, archive or journal recording | Attribute each Codex-assisted task once on its archive commit |
| [Mainline continuity](continuity.md) | Task lifecycle, status or next-work requests | Reconcile sources/evidence and respect guided/serial/paused authority |
| [Policy loading](loading.md) | Task context setup and after Trellis updates | Register applicable details explicitly; verify resolved context |
| [Third-party inventory](../../../third_party/index.md) | Bundled material changes or staging/distribution | Preserve exact notices and report unresolved provenance |

## Write boundary

Protected paths remain read-only: `.trellis/workflow.md`, `config.yaml`,
`.gitignore`, version/hash/update/backup metadata, `scripts/**`, `agents/**`,
the Trellis-managed `AGENTS.md` block, and generated platform integrations.
Do not restore older Plus content into them or add them to `update.skip`.
Existing spec indexes outside this namespace remain read-only in this flow.

Write shared rules here, task evidence in the normal task tree, direction in
`.trellis/mainline.md`, and exact third-party notices in `third_party/`.
Runtime pointers and local platform settings are local state, not shared policy.
Preserve ignore behavior; never stage personal/local settings, force-add them,
or use broad staging. Existing tracked UUPM files under `.codex/` are a
pre-existing exception, preserved without adding or untracking files.

README and root `design.md` are human-owned; do not edit or stage them during
Plus reconciliation. Do not create tasks, install tools or commit merely by
applying this policy. Update mainline only from approved scope or verified
lifecycle changes; preserve its current user edits.

## Integration status

The installed Trellis version is `0.6.14`. Its available exact LICENSE is
collected; UUPM notice/provenance remains `license-notice-needed`.
Existing task/archive manifests explicitly reference this policy and applicable
details; this update has no task and does not claim live hook injection.
Future-task loading needs the manual steps in [loading.md](loading.md):
the package-context command does not load this namespace automatically. Root
AGENTS now supplies a project-owned read directive outside its managed block.
The preview contract in `development.md` is required for preview implementation;
its runtime section records the implemented Docker commands and constraints.
Read [preview-console.md](preview-console.md) for the mandatory format and host
address enumeration; register that detail alongside development.md for preview tasks.
Future-task implement/check loading still needs explicit detail registration.
No protected template was changed and no backup recovery was needed.

## Visual contract context registration

For user-visible work, read `visual-experience.md` with `frontend.md` and
`validation.md`, and register all three explicitly in both implement/check
manifests. This includes changes to copy and interactions without CSS edits.
The visual contract owns the award-level quality requirement, project identity,
mental model, token conventions and eight-dimension iteration gate; package
runtime/config specs retain their concrete behavior contracts. Explicitly
authorized no-task work reads the same files directly without creating a task.

## Preview contract context registration

For normal preview tasks, register `index.md`, `development.md` and
`preview-console.md` explicitly in both implement/check manifests; loaders do
not recursively follow Markdown links. Root AGENTS supplies the portable main
session read directive. An explicitly authorized no-task change reads the same
files directly and must not create a task or change existing task status merely
for this policy reconciliation.
