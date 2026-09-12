# Frontend behavior baseline

## Goal

Record a reproducible snapshot of the current Vue-based frontend and its
cross-package behavior before M1 extracts any ownership boundaries. This gives
the migration a factual compatibility baseline and makes pre-existing failures
distinguishable from regressions.

## Scope

Run the repository's existing typecheck, lint, unit/integration test, Kyoushitsu
build, and applicable browser checks from the parent plan. Inventory the tests
and fixtures covering room admission, state/snapshot ordering, playback sync,
queue/governance, subtitles/fullscreen, danmaku, Baidu/adapter behavior, entry
and responsive layouts. Record command, environment, duration when available,
pass/fail/blocked result, and concise failure evidence in a task-local
`validation.md`.

This slice is baseline-only: do not add migration dependencies, create the
React workspace, alter runtime behavior, change contracts, or repair unrelated
failures. Fixture setup must be isolated from production data and must not
expose credentials.

## Requirements

- R1. Use the project-standard `./dx` wrapper and the exact commands listed in
  the parent implementation plan where the environment supports them.
- R2. Capture failures without weakening tests, changing acceptance criteria,
  or claiming a blocked browser/provider scenario passed.
- R3. Link each recorded failure to its command and, where practical, the
  package/test file or fixture that produced it.
- R4. Preserve the existing worktree changes and leave product source,
  dependencies, runtime configuration, and database/protocol behavior
  unchanged.
- R5. Record any unavailable dependency, service, browser, credential, or
  fixture as a limitation and identify the smallest follow-up needed.

## Acceptance Criteria

- [x] `validation.md` contains a command-by-command baseline for typecheck,
      lint, tests, Kyoushitsu build, and applicable E2E/browser checks.
- [x] The behavior inventory identifies current coverage and fixture locations
      for room/session, sync, queue/governance, media/player, subtitles,
      danmaku, provider/adapter, entry, and responsive layout behavior.
- [x] Every failure or blocked check is labeled with evidence and is not
      presented as a migration regression.
- [x] `git diff` shows no product-code, dependency, runtime-config,
      database, or protocol changes attributable to this slice.
- [x] The task remains independently reviewable and provides the gate evidence
      required before M1.

## Key decisions and limitations

- M0 is explicitly authorized by the user's `启动` response to the parent
  planning summary on 2026-09-12; authorization is limited to this baseline
  slice, not M1–M6.
- Existing baseline commands may require the Docker-backed `./dx` environment;
  if a command cannot run, preserve the exact error and continue with safe
  read-only inventory work.
- No runtime correctness, browser parity, or provider availability is inferred
  from static inspection or from an unrun check.
