# Commit and Task-Archive Attribution

## Attribution anchor

For each task completed with ChatGPT/Codex participation, put exactly one
matching trailer on that task's successful archive commit, regardless of size:

```text
Co-authored-by: OpenAI Codex <codex@openai.com>
```

Ordinary implementation/fix/checkpoint, policy-only and separate journal commits
receive no task-level trailer through this rule. Preserve Git identity, other
valid coauthors and explicit user attribution instructions. Merely inspecting
an unrelated historical task does not establish Codex authorship.
This supersedes the old substantial-contribution/work-commit placement rule.

## Verified route for installed Trellis 0.6.14

`python3 .trellis/scripts/task.py archive --help` exposes `--no-commit` and no
custom message option. Default archival auto-commits unless disabled, using
`chore(task): archive TASK-ID`. Its helper stages the entire
`.trellis/tasks/archive/` subtree plus modified child task directories, removes
tracked source entries from the index, then commits the index. That can include
unrelated archive edits/pre-staged files. Use the supported explicit route:

1. Read this policy, mainline, task criteria, validation and work commits; finish
   required review. Inspect `git status --short`, `git diff --name-only` and
   `git diff --cached --name-only`. Resolve unrelated staged changes without
   resetting the user's index. Preserve existing commit/archive authorization.
2. Prepare one proportional completion message and exact candidate path list
   for that task. Include outcome, actual validation/limitations, task ID and
   work commit references. Use `chore(task): archive TASK-ID` and the exact
   trailer after a blank line.
3. Run `python3 .trellis/scripts/task.py archive TASK-ID --no-commit` only for
   the authorized completed task. Verify returned destination, moved task's
   `status: completed`/`completedAt`, source absence and cleared local pointer.
   Archiving a parent may clear child parent links; inspect those exact
   `task.json` changes too. No project lifecycle hooks are configured here.
4. Stage only the exact destination `.trellis/tasks/archive/YYYY-MM/TASK-ID/`,
   tracked source deletions and verified relationship files. Use explicit
   `git add -- <existing destination/relationship paths>`; for a moved tracked
   source use `git rm -r --cached --ignore-unmatch -- <exact source task path>`.
   Never stage the entire archive tree or unrelated task/product changes.
   Local runtime pointers/platform settings stay excluded. If ignored, stop
   rather than force-add. Verify normal/staged `git diff --check` and all paths.
5. Write the message to a private temporary file under `/tmp` and use
   `git commit -F <message-file>` within existing authorization. Inspect
   `git show --format=full --name-status HEAD` and `git log -1 --format=%B`:
   verify the task, paths and exactly one matching trailer. Remove the
   temporary message after use.
6. Reconcile mainline with archive path, work/archive commits and remaining
   scope. A later mainline-only commit does not repeat the trailer.

If archive moved but commit failed, inspect destination, status, pending changes
and history; resume only the missing explicit commit. Do not rerun archive
blindly. Already archived/attributed tasks get no second archive commit or
duplicate trailer. Existing archives lacking attribution are historical gaps,
not permission to amend history or create empty repair commits.

If a later runtime lacks message injection and `--no-commit`, report
`archive-attribution-blocked` before archive. Do not patch protected scripts,
install global hooks or invent flags. Reread help/implementation after updates.

## Journal and history

`python3 .trellis/scripts/add_session.py --help` also exposes `--no-commit`.
Default recording auto-stages the developer's journal/index and current task
directory if resolved, then commits with configured `chore: record journal`.
For a separate journal commit, prefer `--no-commit`, inspect changed paths and
commit only intended journal/index files. Do not repeat the archive trailer.

Recent M4/M5 archives and journals have no trailer; older visual-work commits
carry the old placement. Preserve them. This update applies prospectively and
does not archive, stage, commit or change task statuses itself.
