# React shell and UI foundation

## Goal

Deliver M3: a parallel React application with a single Router/Query composition
root, identity/home flows and a reusable UI foundation that consumes completed
M2 HTTP resources and preserves Warm Club. Users can authenticate, create/join
a room and continue in its existing Vue implementation.

## Authorization

On 2026-09-26 the user approved creating M3 and entering planning with `开始`,
then approved automatic same-window handoff to Vue rooms with `可以`.
The user approved the completed final planning summary with `开始实现 M3` on
2026-09-26. M3 implementation and its validation are authorized; deployment,
cutover and M4–M6 are excluded.

## Background

- M0, M1 and M2 are archived. M2 evidence records 434 aggregate tests, six-package
  typecheck, lint, production build and deterministic contract generation.
- The accepted parent roadmap assigns React/Vite, Router/Query, identity/home,
  theme tokens and reusable primitives to M3. Room features belong to M4;
  player/provider/danmaku migration belongs to M5, and parity cutover to M6.
- The existing Vue app has `/` and `/bushitsu/:id` routes. Home restores cookie
  identity, authenticates, creates rooms and navigates to the room page.
- Existing Vue remains the default and rollback path. M3 is a sibling app,
  not a Vue/React bridge mounted inside a live room.
- The only pre-existing uncommitted product change is `dev.sh` URL text; preserve
  and exclude it from M3 ownership.
- Confirmed entry/auth/theme/HTTP boundaries and source anchors are recorded in
  `research/entry-boundaries.md`. The current theme is fixed Warm Club; there is
  no theme-selection persistence key to invent or migrate.
- Source anchors: `router.ts:4` owns URLs; `HomeView.vue:42`, `:71`, `:78`,
  `:93`, `:96` own entry/create/default/join/normalization; `:48`, `:65`,
  `:121`, `:122` own auth/logout/restore/revoked notice. `main.ts:10` and
  `lib/site-config.ts:14` own config bootstrap; `lib/theme.ts:1`,
  `assets/theme.css:1`, `i18n/index.ts:1` own theme/tokens/copy. These paths are
  under `packages/kyoushitsu/src/`. `api/index.ts:1` mixes Eden/server App,
  and `api/http-client.ts:1` leaks a workspace alias; neither is a ready React
  package-root boundary. Backend anonymous restoration is real HTTP 401.

## Requirements

- R1. Build a separately runnable React shell with the existing user-visible URL
  vocabulary and lazy room-route boundary, retaining the Vue default.
- R2. Bind the M2 generated client and resource policies to one QueryClient.
  Preserve cookies, cancellation, typed errors and non-secret private key scope.
- R3. Preserve identity restore, register/sign-in/sign-out and home entry/create
  behavior, with explicit loading/error/disabled states and logout cleanup.
- R4. Preserve public site copy, browser title, translated labels, theme identity
  and Warm Club semantic tokens; introduce owned accessible UI primitives using
  Tailwind/shadcn without a visual rebrand.
- R5. Automatically hand off create/join and room deep links to existing Vue
  rooms in the same window, encoding IDs safely and preventing redirect loops.
  React starts no protected room bootstrap, admission, WS or media before handoff.
- R6. Provide reproducible Docker-wrapper commands and meaningful unit/browser
  evidence for desktop and 375px entry flows. Retain aggregate existing checks.

## Acceptance Criteria

- [x] A1. Old Vue default and separately runnable/buildable React entry coexist.
  Its transitive module graph excludes Vue, Pinia, Eden, Housou server and media
  engines. (R1, R2)
- [x] A2. One identity restoration and one QueryClient serve each React app;
  401 means anonymous, other failures allow recovery; logout and delayed private
  responses preserve account isolation. Failed logout is reconciled, never
  reported as success. (R2, R3)
- [x] A3. Registration/sign-in/sign-out, public configuration and create/join
  preserve pending/disabled/error states, configured default room name, one
  command per submit and the approved same-window handoff. (R3, R5)
- [x] A4. Route refresh/deep links, loading/error boundaries and the chosen
  room transition work without protected pre-admission bootstrap; revoked
  notice, invalid paths/targets and loop prevention are covered. (R1, R5)
- [x] A5. Theme/storage keys, visible copy, keyboard focus, pending states and
  44px controls are preserved; desktop/375px entry has no horizontal overflow.
  Config loads once and applies title; transport/true-empty fallback is distinct
  from invalid-success rejection. Reduced motion passes. (R4)
- [x] A6. M2 drift, old/new typechecks/lint/tests/builds and new focused browser
  desktop/phone checks, old Vue entry and real-cookie continuity pass. Affected
  shared-runtime/browser regressions pass. Material environment-blocked gates
  stay incomplete with exact evidence and remaining work recorded. (R2, R6)
- [x] A7. No room feature/player/provider rewrite, backend/domain/protocol/DB
  redesign, production cutover, Vue retirement or unrelated dependency upgrade.
  Residual visual/auth human review follows runnable evidence. (R1–R6)

## Out of scope

Room admission/realtime/queue/chat/governance implementation (M4), player,
subtitles/fullscreen/Baidu/danmaku implementation (M5), final rollout and Vue
retirement (M6), backend changes and deployment are outside M3.

## Technical notes

Boundaries/lifecycle are in `design.md`; ordered ownership and gates are in
`implement.md`. Exact new dependency patches are selected and locked in the first
authorized compatibility spike against existing Bun/Vite; failure does not
authorize broader toolchain upgrades. No unresolved product scope question remains.

## Execution status

2026-09-26: implementation/independent check complete; A1–A6 automated
requirements passed. A7 scope is verified; the owner accepted the residual-review and one-shot
commit batch with `提交`. Commit and finish bookkeeping are now authorized. See `validation.md`, `check-report.md`
and `commit-plan.md`. Work commits `8c5a326` / `ae37464` completed; M3-only archive follows.
