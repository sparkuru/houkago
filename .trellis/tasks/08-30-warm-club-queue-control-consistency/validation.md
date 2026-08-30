# Validation: Warm Club queue and dense-control consistency

Date: 2026-08-30

## Scope review

- Product changes remain inside the approved five-file boundary:
  `theme.css`, `BushitsuView.vue`, `EnmokuComposer.vue`,
  `desktop-room.spec.ts`, and `mobile-room.spec.ts`.
- The parent task only adds this child id, and this task's planning artifacts
  remain limited to the approved queue/composer slice.
- No store, composable, API, WebSocket, i18n, KengenPanel, ChatPanel, player,
  subtitle, danmaku, gate, chat-sheet, cinema, or dialog file changed.
- Script handlers and computed eligibility expressions remain unchanged.
  Queue mutation still relies on server-authoritative `BANGUMI` snapshots, and
  composer Escape collapse versus explicit-close reset semantics are retained.

## Commands and results

- `./dx bun test packages/kyoushitsu/test/bangumi-actions.test.ts packages/kyoushitsu/test/bushitsu-store.test.ts packages/kyoushitsu/test/theme.test.ts`
  - Pass: 23 tests, 0 failures.
- `./dx bun test packages/kyoushitsu/test`
  - Pass: 146 tests, 0 failures.
- `./dx bun run --filter houkago-kyoushitsu typecheck`
  - Pass: exit code 0, including the final rerun after the browser-test fix.
- `./dx bun run lint`
  - Pass: Biome checked 244 files with no fixes, including the final rerun.
- `./dx bun run --filter houkago-kyoushitsu build`
  - Pass: Vite built 424 modules. The existing third-party dash.js
    `COMMONJS_VARIABLE_IN_ESM` warning remains non-fatal.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts --project=desktop-short --project=desktop-tall --project=phone-375 --project=ipad-mini`
  - Pass: 18 tests, 8 intentional project skips, 0 failures.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts --project=governance-phone --project=governance-desktop --grep "owner reorders and clears pending sources|control policy presets converge"`
  - Pass: 4 tests, 0 failures. The unchanged owner/member queue scenarios
    preserve move/clear permissions, disabled boundaries, and snapshot
    convergence.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts --project=phone-375 --project=ipad-mini --grep "portrait queue keeps dense actions"`
  - Pass after the test-race fix: 2 tests, 0 failures.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts`
  - Final result: 38 passed, 8 intentional skips, 2 failures.
  - Both subtitle projects passed in the final parallel run.
  - The only failures are the unchanged governance-phone and
    governance-desktop member-removal assertion at
    `room-governance.spec.ts:173`: the test expects
    `你已被移出该部室。`, while unchanged `HomeView.vue` renders an existing
    aria-hidden `!` followed by that message. This task does not change either
    file or governance behavior, so the mismatch remains out of scope.
- `git diff --check`
  - Pass.
- Task JSON and both JSONL manifests were parsed with `jq`.
  - Pass.

## Reviewer fix

The first full Playwright run produced a task-caused phone fixture race:
`mobile-room.spec.ts` seeded an enmoku immediately after the route changed,
while the UI was still at `正在入室…`. The server correctly rejected the
request with `403 room admission is required`. The test now waits for the
entered-room Bangumi disclosure before seeding sources. The focused phone/iPad
rerun and the final eight-worker suite both passed this scenario.

## Screenshot evidence

- Desktop queue/composer:
  `packages/kyoushitsu/test-results/desktop-room-desktop-queue-35ed1-and-action-hierarchy-states-desktop-tall/queue-composer-desktop.png`
- Phone queue:
  `packages/kyoushitsu/test-results/mobile-room-portrait-queue-15326-h-sized-wrapped-and-bounded-phone-375/queue-actions-portrait.png`
- iPad queue:
  `packages/kyoushitsu/test-results/mobile-room-portrait-queue-15326-h-sized-wrapped-and-bounded-ipad-mini/queue-actions-portrait.png`
- Phone composer:
  `packages/kyoushitsu/test-results/mobile-room-portrait-room--bcb4e-h-retained-and-reset-drafts-phone-375/source-composer-portrait.png`
- iPad composer:
  `packages/kyoushitsu/test-results/mobile-room-portrait-room--bcb4e-h-retained-and-reset-drafts-ipad-mini/source-composer-portrait.png`

Automated geometry and semantic checks confirm 44px controls, wrapping,
focus visibility, long-title bounds, no horizontal overflow, pending/error/
success/current cues, draft retention/reset, and reduced-motion operation.
The diagnostic screenshots show the intended Warm Club hierarchy without
visible horizontal clipping. Subjective density and hierarchy remain a human
review gate before the work commit.

## Readiness

No task-caused quality failure remains. Phase 3.3 synchronized the durable
queue/composer layout, state, and draft contracts in the shared frontend
component guide. The Kyoushitsu room-shell guide now also records that browser
fixtures must observe an admitted-room state before seeding protected data,
preventing the 403 race found during the final check.

Before Phase 3.4, retain the human screenshot review gate and classify the two
unchanged governance assertion failures separately from this task.
