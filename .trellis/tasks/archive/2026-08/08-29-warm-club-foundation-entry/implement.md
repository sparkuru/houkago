# Implementation plan: Warm Club 2.0 foundation and entry

## 1. Baseline and guardrails

- [ ] Re-read the active PRD/design and injected theme, quality, Trellis Plus,
  and visual-direction context before editing.
- [ ] Capture current unauthenticated desktop/375px entry evidence and record
  the existing accessible labels used by room E2E helpers.
- [ ] Search all current semantic token names and literal values before changing
  `theme.css`; prepare a compatibility list for every existing consumer.

## 2. Token foundation

- [ ] Refactor `packages/kyoushitsu/src/assets/theme.css` into documented
  primitive, semantic, and component sections without removing existing token
  names or changing room visuals incidentally.
- [ ] Add the approved typography, control, state, focus, elevation, layer, and
  motion aliases; keep all entry component recipes derived from semantics.
- [ ] Extend the theme unit contract only where deterministic behavior can be
  verified without snapshotting CSS implementation details.

Rollback point: the old semantic aliases still resolve after this step; if room
regression evidence changes, stop and fix compatibility before editing Home.

## 3. Entry composition

- [ ] Move Home-only hardcoded UI strings into the existing i18n message table
  while retaining accessible names relied on by existing browser helpers.
- [ ] Restructure `HomeView.vue` into the quiet floor shell, compact brand/floor
  sign, authentication desk, and authenticated classroom-choice zone.
- [ ] Map known-classroom and new-classroom cards directly to existing join and
  create handlers. Do not add room queries, lists, recommendations, or presence.
- [ ] Present `seito.restoring`, authentication pending, disabled, and error/
  revocation states without changing store or API behavior.
- [ ] Implement responsive desktop/tablet/375px layout, pointer-inert decorative
  CSS/SVG, consistent control variants, focus, and reduced-motion behavior.
- [ ] Extract the existing WAAPI runner, reduced-motion detection, animation
  tracking, replacement cancellation, and unmount cleanup into a shared
  interface-motion composable.
- [ ] Preserve the current `useRoomMotion` API through that shared runner and
  add a separate entry-motion preset composable for the one-time floor entrance
  and 180ms panel replacement.
- [ ] Trigger the floor sequence only after session restoration and DOM state
  stabilization; keep focus/state changes and room navigation independent of
  animation completion.

Rollback point: Home markup/styles/messages can revert independently; no route,
store, API, or room component should require a matching rollback.

## 4. Public site configuration revision

- [ ] Add the tracked public `config/config.toml` with `社团活动室` defaults and
  comments documenting the `.env` secret/operational boundary.
- [ ] Add strict `SiteConfigSchema`, `SiteConfig`, normalization/default
  helpers, and exports in Kousoku. Reject unknown fields and unsafe visible text;
  resolve optional subtitle/browser-title values once at the contract boundary.
- [ ] Add a Housou loader that resolves the canonical root config from
  `import.meta.url`, parses TOML once, reports source/field failures without
  echoing values, freezes the normalized result, and fails before listen when
  the tracked file is invalid.
- [ ] Add an unauthenticated typed `GET /site-config` endpoint returning only
  the validated public singleton with `Cache-Control: no-store`; never expose
  raw TOML or environment state.
- [ ] Add a memoized Kyoushitsu config loader through Eden. Complete it before
  app mount, set `document.title`, expose immutable config to Home, and use the
  shared default only for transport failure with a value-free warning.
- [ ] Replace the fixed floor-sign identity/floor copy/default room name with
  config consumers. Omit the subtitle node when it is not configured and keep
  authentication/action/error copy in i18n.
- [ ] Change the static HTML title to the safe `社团活动室` fallback and document
  that TOML changes require Housou restart plus browser refresh.

Rollback point: reverting the schema, Housou loader/route, Kyoushitsu loader,
and Home config consumers restores the prior fixed presentation without data
migration. Do not entangle this config with room/session state.

## 5. Focused verification

- [ ] Add a focused `entry-home` Playwright specification and dedicated 375px
  and desktop projects in `packages/kyoushitsu/playwright.config.ts`.
- [ ] Cover unauthenticated/restoring, register/sign-in switching, pending and
  error states, authenticated join/create hierarchy, keyboard focus, 44px
  targets, no horizontal overflow, the stable post-animation state, and
  `prefers-reduced-motion` behavior.
- [ ] Extend motion unit coverage for the shared reduced-motion/cancellation
  contract while preserving current room-motion imports and presets.
- [ ] Add Kousoku schema/default tests; add Housou valid/invalid TOML and exact
  public-route projection tests; add Kyoushitsu success/fallback/memoization/
  browser-title tests.
- [ ] Extend desktop/375px entry Playwright coverage with a custom long site
  identity, absent/present subtitle, configured copy, configured empty-room
  default, and no old `放学后 / HOUKAGO` identity.
- [ ] Inject secret-sentinel environment values in the route test and prove the
  public JSON contains none of them.
- [ ] Validate the tracked `config/config.toml` with the same production parser.
- [ ] Run `./dx bun run --filter houkago-kyoushitsu test`.
- [ ] Run `./dx bun run --filter houkago-kyoushitsu typecheck`.
- [ ] Run `./dx bun run --filter houkago-kyoushitsu build`.
- [ ] Run `./dx bun run lint`.
- [ ] Start `./dev.sh`, then run the focused entry desktop/phone Playwright
  projects with the installed Chrome executable and preserve failure traces.
- [ ] Run at least the existing desktop-room and phone-room browser coverage to
  verify shared-token compatibility.

## 6. Full check and handoff

- [ ] Run `./dx bun run test`, `./dx bun run typecheck`, and `./dx bun run lint`.
- [ ] Run `git diff --check`; inspect exact changed/staged paths and confirm no
  protected Trellis or personal/local files enter the work commit.
- [ ] Record exact commands/results and residual subjective visual risk in
  `validation.md`; classify the Trellis Plus human-review gate.
- [ ] Re-capture signed-out/authenticated desktop and phone evidence after the
  default identity changes; request human review only if the new configured
  identity materially changes atmosphere or attention hierarchy.
- [ ] Confirm the public/secret boundary, restart rule, and Firefly-adapted
  decisions are recorded in the applicable project spec before proposing the
  Phase 3.4 work commit.
