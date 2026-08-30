# Implementation plan: Warm Club queue and dense-control consistency

## 1. Pre-start baseline

- [ ] Re-read `prd.md`, `design.md`, and both task research files.
- [ ] Load the Kyoushitsu frontend index, room component contract, and code
      reuse guide from `implement.jsonl`.
- [ ] Search every existing `--row-*`, queue, composer, action, focus, status,
      spacing, and radius consumer before changing a value.
- [ ] Confirm the working tree contains only the current Trellis planning
      changes before activation.
- [ ] Capture or inspect baseline queue/composer states at 1280x640,
      1280x1200, iPad Mini, and 375x812 through existing fixtures.

## 2. Queue/composer component recipes

- [ ] Add only the queue and composer component recipes required by
      `design.md` to `packages/kyoushitsu/src/assets/theme.css`.
- [ ] Derive every recipe from existing semantic or `--room-*` tokens; do not
      add raw palette values, fonts, a second theme, or generated-tool colors.
- [ ] Replace queue/composer-local literal spacing/radii and legacy aliases
      only after searching all consumers.
- [ ] Verify inherited recipes do not change `KengenPanel`, `ChatPanel`,
      dialogs, player controls, provider/danmaku panels, or entry surfaces.

Rollback point: remove the component recipes and restore the previous local
aliases if any unrelated room surface changes.

## 3. Queue presentation

- [ ] Refine only the queue markup/classes and scoped styles in
      `BushitsuView.vue`; preserve every script handler, computed eligibility
      rule, request, live region, and emitted behavior.
- [ ] Establish source/title/status/action hierarchy while retaining DOM and
      keyboard order, `aria-current`, provider detail, and long-title handling.
- [ ] Style playback as primary, cancel/move as secondary, and delete/clear as
      spatially distinct destructive actions without hiding controls.
- [ ] Keep disabled and pending states non-interactive and visually explicit.
- [ ] Keep the clear-pending dialog outside the redesign except for its
      existing launcher adopting the queue action recipe.

Rollback point: restore the queue template/style block without touching queue
logic or API calls.

## 4. URL source-composer presentation

- [ ] Refine only the template classes and scoped styles in
      `EnmokuComposer.vue`; preserve `useEnmokuPreview`, `useBaiduSource`,
      watchers, emits, dialog refs, and action methods.
- [ ] Apply primary/secondary/quiet hierarchy to the three launchers and to
      resolve/add/add-and-switch/edit actions.
- [ ] Align fields, helper/error text, preview, disabled/loading treatment,
      and focus with shared recipes.
- [ ] Preserve draft retention on Escape collapse, reset on explicit close,
      semantic input types, visible labels, and current error announcement.
- [ ] Tokenize the existing entrance timing only if needed; add no new
      animation and preserve reduced-motion behavior.

Rollback point: restore the composer template/style block; no state migration
or provider rollback is needed.

## 5. Responsive and focused coverage

- [ ] Extend `desktop-room.spec.ts` for queue action hierarchy, current and
      disabled states, short-window composer reachability, and stable
      workbench sizing.
- [ ] Extend `mobile-room.spec.ts` for 44px queue/composer controls, wrapped or
      stacked actions, long-content bounds, Escape draft retention, explicit
      close reset, and `scrollWidth <= innerWidth`.
- [ ] Exercise both `phone-375` and `ipad-mini`; keep assertions semantic or
      geometry-based rather than tied to arbitrary pixel screenshots.
- [ ] Capture diagnostic desktop, tablet, and phone screenshots for human
      review. Do not add screenshot baselines.
- [ ] Keep existing queue action/store tests unchanged unless a genuine
      presentation helper requires focused unit coverage.
- [ ] Run the existing governance phone/desktop queue scenarios unchanged as
      regression evidence for owner-only move/clear, disabled boundaries,
      member visibility, and server-snapshot convergence.

## 6. Quality gate

- [ ] Run the focused `bangumi-actions`, `bushitsu-store`, and theme unit tests
      before the package suite.
- [ ] Run `./dx bun test packages/kyoushitsu/test`.
- [ ] Run `./dx bun run --filter houkago-kyoushitsu typecheck`.
- [ ] Run `./dx bun run lint`.
- [ ] Run `./dx bun run --filter houkago-kyoushitsu build`.
- [ ] Start `./dev.sh` and run the focused `desktop-short`, `desktop-tall`,
      `phone-375`, and `ipad-mini` room projects through
      `packages/kyoushitsu/playwright.config.ts` with the repository's
      installed browser setup.
- [ ] Run the full Kyoushitsu Playwright suite; classify any reproduced
      baseline failures against fresh evidence rather than assuming the
      archived room-shell failures still apply.
- [ ] Run `git diff --check`, inspect every changed path, and verify that
      `KengenPanel`, `ChatPanel`, dialogs, gates, cinema, APIs, stores, and
      protocols did not drift into scope.
- [ ] Require human screenshot review for density, hierarchy, touch spacing,
      and Warm Club coherence.

## 7. Finish and rollback review

- [ ] Record exact commands, results, screenshots, baseline failures, and
      residual risks in `validation.md`.
- [ ] Update the frontend component spec only if implementation reveals a
      durable queue/composer contract not already captured.
- [ ] Present implementation and validation evidence before proposing the work
      commit; do not push.

## Risky files and rollback map

| File | Primary risk | Rollback |
| --- | --- | --- |
| `src/assets/theme.css` | component recipes leak to unrelated controls | remove queue/composer recipes and restore aliases |
| `src/views/BushitsuView.vue` | dense layout edit disturbs queue semantics or room scroll | restore queue-only template/style changes |
| `src/components/bangumi/EnmokuComposer.vue` | visual edit changes form/provider state behavior | restore template/style changes; keep composables untouched |
| `e2e/desktop-room.spec.ts` | brittle CSS-only assertions | retain semantic/state and bounded-layout assertions |
| `e2e/mobile-room.spec.ts` | viewport-specific assumptions | assert touch sizes, wrapping, and overflow contracts across both projects |
