# Validation evidence

## Automated gate — 2026-08-28

- `./dx bun run format`: 226 files, no fixes required.
- `./dx bun run lint`: 226 files clean.
- `./dx bun run typecheck`: all six workspaces passed.
- `./dx bun run test`: 318 passed, 0 failed, 1,494 assertions across 68
  files. The root command explicitly sets `HOUSOU_DB=:memory:`.
- `./dx bun run --filter houkago-kyoushitsu build`: passed. The existing
  dashjs CommonJS-in-ESM warning remains non-blocking.
- Focused server coverage passed: `danmaku-foundation.test.ts` 11/11 with
  `HOUSOU_DB=:memory:` and `danmaku-hybrid.e2e.test.ts` 1/1. The coverage
  includes owner-only default writes, viewer denial, DB persistence, full
  `DANMAKU_DEFAULT` snapshots, late-join delivery, and candidate visibility.
- Focused client coverage passed: 19/19 selection/store tests and the full
  `packages/kyoushitsu/test` suite at 136/136.
- `git diff --check`: passed.

## Browser gate — 2026-08-28

- Installed host Chrome (`/usr/bin/google-chrome`) ran
  `node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts`
  with the `danmaku-phone` and `danmaku-desktop` projects: 2 passed, 0
  failed.
- The scenario covers source provenance and disabled state, distinct personal
  selection, stable player DOM while switching tracks, fallback, empty, load
  failure/retry, 44px controls, and phone/desktop horizontal-overflow checks.
- No provider credentials or upstream provider data were used; REST candidate
  responses and legacy cue responses were page-local test fixtures.

The independent Trellis check worker was started but did not return after a
bounded shutdown request; it made no workspace changes. The final gate above
was rerun locally after that shutdown.
