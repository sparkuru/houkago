# Implementation plan: Warm Club 2.0 room shell hierarchy

## 1. Pre-start baseline

- [ ] Re-read `prd.md`, `design.md`, and `research/room-shell-direction.md`.
- [ ] Load the Kyoushitsu frontend package guidelines and the UI/UX/quality
      rules referenced by the manifests.
- [ ] Search existing room token names and shell class names before changing
      any CSS value; record consumers that must remain visually compatible.
- [ ] Capture or inspect the current admitted-room states at
      `1280x900`, `1280x640`, `768x1024`, and `375x812` using the existing
      Playwright fixtures.
- [ ] Confirm the working tree contains only this task's planning changes
      before `task.py start` is requested.

## 2. Shell token and surface recipes

- [ ] Add only the room component recipes required by the approved hierarchy to
      `packages/kyoushitsu/src/assets/theme.css`.
- [ ] Derive room canvas, stage gutter, media frame, panel surface/border,
      elevation, section gap, and status values from existing semantic tokens.
- [ ] Preserve existing public token aliases and the `warm-club` root theme;
      do not introduce raw palette values or a second theme.
- [ ] Verify that inner player, chat, governance, queue, subtitle, danmaku,
      and provider styles do not receive unintended inherited changes.

Rollback point: if token compatibility changes a room surface outside this
child's shell scope, revert the token additions before continuing.

## 3. Desktop room hierarchy

- [ ] Refine `BushitsuView.vue` shell styles so the player/media stage is the
      strongest surface and metadata is compact and subordinate.
- [ ] Align the desktop `ChatPanel` rail, room-control panel, and queue wrapper
      with one panel spacing/border/elevation recipe without changing their
      internal behavior or event wiring.
- [ ] Keep the fixed desktop viewport and intentional `.stage` scrolling;
      verify both short-window reachability and tall-window content sizing.
- [ ] Preserve the collapsed-chat handle, keyboard visibility, and player/chat
      alignment.

Rollback point: the route's existing markup and local state remain sufficient
to restore the current visual shell without touching stores or APIs.

## 4. Tablet, portrait, and cinema presentation

- [ ] Refine the tablet transition without changing the established breakpoint
      or hiding critical room information.
- [ ] Preserve portrait document scrolling, player `aspect-ratio: 16 / 9`,
      full-width chat launcher, native disclosures, and 44px summaries/actions.
- [ ] Keep mobile chat sheet sizing, backdrop, expand/shrink, close, Escape, and
      focus restoration behavior intact while aligning its surface recipe.
- [ ] Keep cinema mode media-first: hide metadata, workbench, timeline source,
      mobile launcher, and collapsed-chat handle while preserving the
      established desktop chat rail and in-player danmaku overlay.
- [ ] Add or adjust only named `useRoomMotion` presets if the shell needs a
      transition; use opacity/transform, cancellation, and reduced-motion
      behavior already provided by `useInterfaceMotion`.

Rollback point: if a responsive change introduces nested scrolling, horizontal
overflow, or an inaccessible dismissal path, revert that breakpoint group and
retain the previous layout while investigating.

## 5. Focused browser and unit coverage

- [ ] Extend the existing desktop-room coverage for player-first hierarchy,
      short/tall scroll behavior, panel bounds, and cinema visibility.
- [ ] Extend mobile-room coverage for player-first order, disclosures, chat
      sheet interaction/focus, 44px controls, and no horizontal overflow.
- [ ] Add tablet coverage at `768x1024` if the existing project does not already
      exercise the shell there.
- [ ] Add reduced-motion assertions for any new or changed room preset.
- [ ] Keep governance, subtitle, danmaku, provider, admission, and sync tests
      running unchanged to prove behavior ownership was preserved.
- [ ] Capture diagnostic screenshots for signed-in admitted-room desktop,
      short desktop, tablet, portrait, and cinema states. Do not add screenshot
      baselines unless a separate product decision approves them.

## 6. Quality gate

- [ ] Run `./dx bun test`.
- [ ] Run `./dx bun run typecheck`.
- [ ] Run `./dx bun run lint`.
- [ ] Run `./dx bun run --filter houkago-kyoushitsu build`.
- [ ] Start `./dev.sh` and run the focused room Playwright projects with
      `/usr/bin/google-chrome` through the repository configuration.
- [ ] Run the full Kyoushitsu Playwright suite and preserve traces on failure.
- [ ] Run `git diff --check` and inspect all changed paths for scope drift.
- [ ] Classify the Trellis Plus human-review gate. A subjective visual review
      remains required for the room attention hierarchy; real-device and AT
      checks remain residual risks unless available.

## 7. Pre-commit handoff

- [ ] Record exact commands, results, screenshots, and residual risks in
      `validation.md`.
- [ ] Confirm no API, WebSocket, store, auth, permission, media, provider,
      subtitle, or danmaku contract changed.
- [ ] Update the applicable frontend spec only if the implementation surfaces a
      durable room-shell rule that is not already documented.
- [ ] Present the final planning/implementation summary and wait for explicit
      user approval before `task.py start`; this plan alone is not execution
      authorization.
- [ ] After implementation and human review, propose a work commit with the
      exact paths and the Codex co-author trailer when author-level contribution
      is substantial; do not push.

## Risky files and rollback map

| File | Risk | Rollback |
| --- | --- | --- |
| `packages/kyoushitsu/src/views/BushitsuView.vue` | layout/state coupling, player/chat bounds | revert shell markup/style-only changes; preserve script wiring |
| `packages/kyoushitsu/src/assets/theme.css` | shared token leakage | remove room recipes and restore existing aliases |
| `packages/kyoushitsu/src/composables/use-room-motion.ts` | transition timing/reduced-motion regressions | restore existing public presets |
| `packages/kyoushitsu/src/components/chat/ChatPanel.vue` | desktop/mobile surface interaction | prefer wrapper/token changes; revert component styling only if necessary |
| `packages/kyoushitsu/e2e/{desktop-room,mobile-room}.spec.ts` | brittle visual assertions | keep semantic/layout-bound assertions tied to stable contracts |
