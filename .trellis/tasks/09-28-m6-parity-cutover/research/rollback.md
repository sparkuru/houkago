# Pre-removal restoration rehearsal

Committed project base: `68d8b398d228c9f13f0d773356c751f0b17e2d6e`.
The original dirty working tree is a separate part of the rollback baseline.
Snapshot: `/tmp/houkago-m6-baseline-t2wgvscl/` (patches and original files).

An independent temporary Git repository was created at
`/tmp/houkago-m6-rollback-h6m213e_` from `git archive` of the project base, then
the original tracked patch and original untracked files were restored there.
The fixture baseline commit is `b908d70f65944980463dc4ddd2d06acf44a4dec4`.
The final pre-removal working tree was overlaid and committed in that fixture
as `3b2dd7deec0a595abe094f1ed59d6a32724f7ead`; `git revert --no-edit` restored it.

Both baseline and restored tree IDs are
`639a3c576d69a9ba5362ce2edae63501fc82fa68`.
The exact equality checks all fixture-tracked content and paths, including the
preserved original preview/origin/config/policy edits. The registration change
to the tracked `.trellis/config.yaml` is included. No reset, staging, commit,
branch change or revert was performed in the real project checkout.
Machine-readable result: `/tmp/houkago-m6-baseline-t2wgvscl/rollback-result.json`.

This proves file/tree restoration for the pre-removal product checkpoint.
It does not prove a restored runtime boot or a future Vue-deletion checkpoint.
The actual original runtime was separately verified by the baseline checks.
Temporary artifacts are session-local; preserve required evidence before cleanup.

For the eventual real rollback, revert only approved M6 commit groups in reverse
order, restoring the workspace, scripts, generator paths and imports together.
Do not reset unrelated working-tree changes. Reinstall from the restored lockfile,
run lint/types/tests/contract drift/build, restart the corresponding isolated
previews and verify the browser cases. Repeat the fixture rehearsal with the
actual removal checkpoint before final M6 completion. No backend data migration
or production rollout is part of this change.

## Actual preserved commit baseline

The original preview/config/policy work is committed in `09b47f3`, followed by
`e87044a`, which restores existing tracked local design-skill records that the
initial fixture's fresh `git add` had omitted under local ignore rules.
No local skill file was deleted or rewritten; its original Git blobs are
preserved. The combined baseline tree is
`f2f65aa51be8cf63af7a35cce5d860d52c0282c4`.
Use this actual baseline for the final commit-based restoration rehearsal,
which supersedes the earlier fixture-only tree coverage. Reverting only the
subsequent M6 cutover commit retains the original preview/policy work and skill
records together. Keep both baseline commits when rolling back M6.
