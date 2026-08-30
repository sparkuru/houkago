# Validation: Warm Club 2.0 room shell hierarchy

## Automated evidence

- `./dx bun test packages/kyoushitsu/test` — passed, 146 tests / 0
  failures.
- `./dx bun run --filter houkago-kyoushitsu typecheck` — passed.
- `./dx bun run lint` — passed, 244 files checked.
- `./dx bun run --filter houkago-kyoushitsu build` — passed. Vite retained the
  existing third-party dash.js CommonJS-in-ESM warning.
- Focused room browser projects using installed Google Chrome and the local
  `dev.sh` services:
  `--project=desktop-short --project=desktop-tall --project=phone-375
  --project=ipad-mini` — 15 passed / 7 intentionally project-skipped. The
  passing scenarios cover short/tall desktop reachability, bounded player /
  workbench / chat-rail layout, cinema mode with the desktop chat rail kept
  visible, portrait player-first order, 44px chat/disclosure controls, chat
  sheet expansion and dismissal, ordinary-source mobile behavior, and
  horizontal-overflow bounds.
- Full Kyoushitsu browser suite with the same Chrome/service setup — 35 passed,
  7 skipped, 2 failed. Both failures are the existing governance assertion at
  `packages/kyoushitsu/e2e/room-governance.spec.ts:173`: the alert currently
  renders `! 你已被移出该部室。` while the old assertion expects the sentence
  without the leading marker. `HomeView.vue` and governance markup are outside
  this task's diff; no unrelated fix was included.
- `./dx bun test` — 354 passed, 26 failed, 8 errors. The failures are outside
  this frontend shell slice and reproduce in backend/REST/Baidu/danmaku tests
  (shared test data, authorization/registration fixtures, queue timeouts,
  SQLite uniqueness) plus Bun loading Playwright files as unit tests. The
  Kyoushitsu unit suite and focused browser projects remain green.
- `git diff --check` — passed.
- `python3 ./.trellis/scripts/task.py validate
  08-30-warm-club-visual-followup` — passed; both sub-agent manifests contain
  eight validated entries.

## Visual evidence

Diagnostic screenshots were captured by the focused browser tests and inspected
locally. They are temporary Playwright artifacts, not committed baselines:

- Desktop shell: `packages/kyoushitsu/test-results/desktop-room-the-desktop-r-36b3e-rimary-and-surfaces-bounded-desktop-tall/room-shell-desktop.png`
- Cinema with desktop chat rail: `packages/kyoushitsu/test-results/desktop-room-cinema-mode-k-08fbc-d-desktop-chat-rail-visible-desktop-tall/room-shell-cinema.png`
- iPad Mini portrait: `packages/kyoushitsu/test-results/mobile-room-portrait-room--ba8e8-ontrols-within-the-viewport-ipad-mini/room-shell-portrait.png`
- 375px portrait: `packages/kyoushitsu/test-results/mobile-room-portrait-room--ba8e8-ontrols-within-the-viewport-phone-375/room-shell-portrait.png`

The reviewed states show the media stage as the strongest surface, a bounded
desktop conversation companion, quiet workbench panels, a full-width portrait
chat entry, and compact native disclosures. Cinema removes context/workbench
surfaces while retaining the established desktop chat rail.

## Human review gate

Classification: `human-required`.

Automation establishes semantic hierarchy, responsive bounds, control sizing,
cinema visibility, and preserved room behavior. The remaining decision is
subjective: confirm that the player remains the clear visual anchor, the chat
rail is useful but not dominant, and the workbench feels like a calm secondary
area at desktop, cinema, iPad portrait, and 375px portrait widths. A short
approval or a note naming the distracting/understated element is sufficient;
no generic smoke test is needed after the passing browser evidence.

## Spec and residual risk

- The existing frontend component spec already defines cinema as the player +
  desktop chat side panel + danmaku arrangement, so the implementation and
  task design were aligned to that contract rather than adding a conflicting
  media-only rule.
- The room shell remains presentation-only: no player, chat, governance,
  queue, provider, subtitle, danmaku, API, WebSocket, or store contract was
  changed.
- No approved pixel baseline exists; system-font metrics may vary slightly.
  Real-device and assistive-technology checks remain residual risks.
