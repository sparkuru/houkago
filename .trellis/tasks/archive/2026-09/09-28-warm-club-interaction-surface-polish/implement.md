# Implementation plan: Warm Club 2.0 interaction surface polish

## 1. Baseline and guardrails

- [x] Read this PRD/design, the parent 08-29 PRD, package component and quality
      guidance, state-management guidance, and Trellis Plus browser policy.
- [x] Confirm the working tree and active-task state; preserve unrelated edits.
- [x] Inspect existing dialog/gate/chat/cinema styles and search theme.css for
      reusable tokens before changing any value.
- [x] Run focused baseline browser scenarios for mobile chat, cinema, provider
      dialogs, member removal, and queue confirmation. Record pre-existing
      failures before editing.
- [x] Capture diagnostic baseline screenshots for phone, tablet, desktop
      short/tall, and cinema states.

## 2. Shared surface language

- [x] Map existing semantic and component tokens to dialog, gate, sheet, and
      composer surfaces; avoid raw palette values in components.
- [x] Add only the minimum repeated room-interaction recipes to theme.css if
      scoped tokens cannot express the approved surface language cleanly.
- [x] Keep provider-brand indication and user-configurable chat text settings.

## 3. Dialog and gate presentation

- [x] Refine BushitsuView queue-confirm/provider-info dialogs and nickname/
      admission gate states without changing state or dismissal logic.
- [x] Refine KengenPanel member-removal dialog while preserving pending/error
      messaging, Escape dismissal, and confirm/cancel behavior.
- [x] Refine BaiduConnectionDialog and BaiduFileDialog surfaces while preserving
      all provider copy, security explanations, focus paths, and step order.
- [x] Refine EnmokuPlayer join-gate hierarchy and cinema control state without
      changing player or parent event behavior.

## 4. Mobile chat sheet and composer

- [x] Refine mobile sheet surface, header, scrim, safe-area spacing, and
      expand/shrink/close controls while preserving the current modal lifecycle.
- [x] Refine ChatPanel composer field, resizer affordance, settings, and send
      action hierarchy without changing draft, preference, or event behavior.
- [x] Verify read-only chat presentation and existing message history remain
      unchanged.

## 5. Browser coverage and responsive review

- [x] Extend existing desktop-room, mobile-room, and room-governance specs with
      semantic and interaction checks for every changed state that lacks
      coverage; prefer public roles, labels, and visible state over internals.
- [x] Assert critical dialog/composer controls remain reachable and touch
      targets remain at least 44px where the control is touch-facing.
- [x] Verify the desktop chat rail remains visible in cinema and mobile launcher
      behavior remains unchanged.
- [x] Capture post-change diagnostic screenshots at 375x812, 768x1024,
      1280x640, and 1280x1200, including a cinema state. Do not create pixel
      snapshots or automatically update baselines.

## 6. Quality gate

- [x] Run ./dx bun test packages/kyoushitsu/test.
- [x] Run ./dx bun run --filter houkago-kyoushitsu typecheck.
- [x] Run ./dx bun run lint.
- [x] Run ./dx bun run --filter houkago-kyoushitsu build.
- [x] Start ./dev.sh, then run the focused browser projects:
  ```sh
  PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts --project=phone-375 --project=ipad-mini --project=desktop-short --project=desktop-tall --project=governance-phone --project=governance-desktop
  ```
- [x] Run the full browser suite and classify any baseline failure without
      broadening this presentation task:
  ```sh
  PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts
  ```
- [x] Run git diff --check and inspect changed paths for behavior/scope drift.

## 7. Human review and handoff

- [x] Record exact commands/results and screenshot paths in validation.md.
- [x] Request human visual review of the named dialog, gate, composer, sheet,
      and cinema states; include viewport and state for each screenshot.
- [x] Record residual real-device, assistive-technology, or subjective risk.
- [x] Present the final implementation summary and wait for explicit approval
      before any work commit/archive step.

## Risky files and rollback map

- BushitsuView.vue: multiple overlays and responsive room-state CSS; revert the
  task-owned markup/classes/styles and matching e2e assertions together.
- ChatPanel.vue: composer styling and local control layout; preserve emits and
  user preferences when reverting or reviewing changes.
- EnmokuPlayer.vue: player-owned join/cinema affordances; do not change player
  lifecycle or cinema event contracts.
- KengenPanel.vue and Baidu dialog components: scoped modal styling; preserve
  async operation states, provider-security copy, and dismissal behavior.
- theme.css: if changed, remove only the task-owned component recipes and keep
  existing semantic compatibility aliases intact.
