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
| [Development and environment](development.md) | Before development, preview or configuration changes | Reuse `dx`; enforce the preview lifecycle, root `.env`, readiness/endpoint summary and verification contract |
| [Frontend integration](frontend.md) | User-visible UI planning, implementation or review | Use project-local UUPM and approved task decisions; classify mobile coverage |
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
Current task manifests explicitly load this policy and applicable details.
Future-task loading needs the manual steps in [loading.md](loading.md):
the package-context command does not load this namespace automatically.
The preview contract in `development.md` is required for preview implementation;
its runtime section records the implemented Docker commands and constraints.
Future-task policy loading still needs explicit context registration.
No protected template was changed and no backup recovery was needed.
