# Room control policy — implementation plan

## Ordered work

1. Add durable `kengen_json` schema/upgrade support and typed query helpers.
   Preserve the only-chat default for absent or malformed legacy values.
2. Change the Kengen service from process-only state to durable read-through
   state while retaining pure `canDo` enforcement and the unchanged `SETTEI` /
   `KENGEN` protocol.
3. Extend backend tests for migration, restart/cache-clear retrieval, host-only
   persistence, member rejection, and unchanged owner-only queue management.
4. Add typed frontend preset helpers and i18n labels; reshape `KengenPanel` into
   a policy summary, preset radio group, and progressive advanced controls.
5. Extend unit and Playwright coverage for preset/custom rendering, policy
   propagation, member-visible state, accessibility, and portrait layout.
6. Run formatting, static/type checks, isolated package tests, production build,
   and the focused responsive Playwright suite; update code-specs, commit, then
   archive the task.

## Validation

```sh
./dx bun run format
./dx bun run lint
./dx bun run typecheck
./dx sh -c 'HOUSOU_DB=/tmp/houkago-control-policy-final.db bun test packages/kokuban/test packages/eisha/test packages/housou/test packages/kyoushitsu/test'
./dx bun run --filter houkago-kyoushitsu build
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts --grep 'control policy'
```

## Rollback points

- The schema column is nullable and ignored by previous code; do not delete it
  during rollback.
- If a persistence error appears, reject the setting change and retain the last
  stored policy; never broadcast a snapshot that has not been persisted.
- If the preset UI cannot establish an authoritative `KENGEN` round trip, retain
  the existing advanced switches and defer the preset presentation.
