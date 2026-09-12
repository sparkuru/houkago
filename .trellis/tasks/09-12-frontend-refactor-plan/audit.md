# Implementation assessment

Date: 2026-09-12. Baseline: `cae7202`, branch `k-on`; initially clean worktree. Module: architecture and evolution. Method: static source, manifests, tests and specifications; no runtime tests or browser session executed.

## Conclusion

The application has useful package boundaries and behavioral tests. Its main maintenance problem is concentration of frontend orchestration and lifecycle responsibilities, compounded by inconsistent specification ownership. Replacing Vue with React does not itself address those problems. The proposed stack is viable as a frontend migration, but the realtime/media behavior makes it substantially larger than a UI-library replacement.

## Current architecture

| Package | Observed role | Migration disposition |
| --- | --- | --- |
| kyoushitsu | Vue SPA, Eden, Pinia, WS client, ArtPlayer, UI | Primary migration surface |
| housou | Elysia HTTP/WS, admission, identity, domain operations, SQLite | Preserve behavior; add/export HTTP contracts if Hey API chosen |
| kousoku | Shared protocol/domain schemas and types | Preserve canonical vocabulary and WS contracts |
| eisha | Media resolution/proxy routes | Preserve implementation and URL semantics |
| kokuban | Danmaku parsing/matching | Reuse browser-safe parsing/domain interfaces |
| houkago-adapter | Browser adapter protocol/runtime | Preserve external integration contract |

Evidence: workspace manifests; `packages/housou/src/index.ts:1`; `packages/kyoushitsu/src/views/BushitsuView.vue:1`; `packages/kyoushitsu/src/composables/useBaiduPlayback.ts:1`.

The root `design.md` is substantive architecture intent, but some early sections describe earlier stages. Housou actually mounts Eisha routes in the same Elysia app (`packages/housou/src/index.ts:37`); logical package separation must not be mistaken for separate deployed services. The root design's initial five-module description also predates the adapter package.

## Strengths to preserve

- REST already has compile-time backend linkage through `treaty<App>` and sends cookies: `packages/kyoushitsu/src/api/index.ts:1`. Hey API is not repairing a wholly untyped client.
- Room events converge through `useBushitsuStore.apply`; explicit playback handling is separate from snapshot storage: `packages/kyoushitsu/src/stores/bushitsu.ts:109`, `packages/kyoushitsu/src/composables/useShinkou.ts:1`.
- Playback integration has a narrow `PlayerHandle`; clock offset, drift and seekability have small testable helpers. ArtPlayer/HLS/DASH ownership is already localized to a player wrapper.
- Existing tests cover permissions, queue behavior, reconnects, danmaku and provider flows; Playwright defines mobile/tablet/desktop layouts and subtitle/governance scenarios. Evidence: `packages/kyoushitsu/test/use-shinkou.test.ts:1`, `packages/kyoushitsu/playwright.config.ts:1`, `packages/housou/test/queue-management.e2e.test.ts:1`.
- Semantic styling tokens already exist in `packages/kyoushitsu/src/assets/theme.css:1`. A migration can preserve the visual identity instead of rebuilding a palette.

## Findings, ordered by importance

### F1 — high: room orchestration remains coupled to the page lifecycle

Evidence: `packages/kyoushitsu/src/views/BushitsuView.vue:1` imports API, stores, WS, player, provider/danmaku controllers and motion. Lines 575–683 own admission-dependent HTTP bootstrap, snapshot ordering, socket callbacks, account restore and teardown. Queue commands and pending/error state also live here (line 339 onward).

Measured source size is 2,012 lines, including about 683 script lines and CSS beginning at 1109. The finding is mixed responsibility, not a line-count rule. A new provider, new session transition or queue interaction currently risks edits to the same integration hub.

Smallest step: extract room-session orchestration with explicit start/dispose and commands, retaining the Vue view initially. Validate admitted bootstrap, reconnect, room switch and queue event ordering before moving UI. Benefit: changing layout no longer requires reasoning through transport lifecycle.

### F2 — high migration risk: HTTP and realtime data need explicit ordering and ownership

Evidence: `BushitsuView.vue:575` deliberately guards the initial HTTP Bangumi result against a newer WS snapshot using array identity. `BushitsuView.vue:539` has another HTTP fallback for resolving a current item. `stores/bushitsu.ts:109` accepts queue and playback messages. `useBaiduPlayback.ts:52` uses a preparation counter to reject obsolete async completions.

Confirmed: bespoke stale-result handling exists and is necessary. Hypothesis requiring tests: other in-flight completions or socket callbacks could cross a room/session transition; this audit has not reproduced such a failure. Blindly copying these values into Query cache and a realtime store would introduce two writers.

Smallest step: specify one authority per field and a room/session generation guard. Test a delayed HTTP snapshot after BANGUMI, rapid source switches, disconnect/reconnect and teardown. Benefit: cache integration cannot regress the existing race protection.

### F3 — medium: backend-type coupling is deliberate, but OpenAPI readiness is incomplete

Evidence: frontend imports `App` from Housou (`api/index.ts:3`), and Housou exports the application entrypoint (`packages/housou/package.json:6`). `packages/housou/src/index.ts:1` has no OpenAPI plugin. Route scans find body/query schemas throughout, but only the site-config route explicitly declares a route `response` schema (`routes/site-config.ts:11`).

This is compile-time package coupling, not evidence of server code leaking into the browser: the App import is type-only. Moving to Hey API trades that coupling for a generated public contract and its maintenance. Existing inferred Eden response types are not automatically an exported OpenAPI response contract.

Smallest step: contract/export spike covering site-config, authentication, one queue mutation, one provider request and error responses. Validate cookie behavior, nullable/unions, success/error statuses and generated type fidelity. Benefit: independent client generation without losing type coverage.

### F4 — medium: large imperative player and provider/danmaku controllers are expensive to port

Evidence: `components/player/EnmokuPlayer.vue:1` owns ArtPlayer, HLS/DASH, deferred seek, subtitle choice, fullscreen integration and custom controls (1,325 total lines; 821 script lines). `composables/useBaiduPlayback.ts:52` includes grant creation/polling, capability checks, optional fingerprint fallback and cancellation. `composables/useTimelineDanmaku.ts:58` owns fetching, a resolution cache, local selection and source preference.

These are partly successful abstractions, not intrinsically wrong. They still depend on Vue lifecycle/store primitives, so they cannot be copied unchanged into React. Existing `useShinkou` tests also construct Pinia/ref objects.

Smallest step: extract framework-independent controllers around the existing PlayerHandle and provider operations; port thin React bindings separately. Test setup/cleanup/setup, remote-event echo suppression, native fullscreen overlays, autoplay gesture preservation and expired grants. Benefit: frontend framework changes stop being domain rewrites.

### F5 — medium: documented rules are fragmented and some conflict with current behavior

Evidence: package frontend/backend indexes still mark most guidelines “To fill”; `houkago-kyoushitsu/frontend/component-guidelines.md` mixes placeholders and a concrete room-shell contract. `.trellis/spec/frontend/quality-guidelines.md` says only the host emits SHINKOU, while `useShinkou.ts:74` and `test/use-shinkou.test.ts:72` support authorized guests. The root design contains later shared-control amendments.

Smallest step: establish a reviewed behavior inventory from current code/tests before migration; later update only the authoritative affected specs. This planning task records proposed contracts locally and does not rewrite current Vue standards. Validate host, authorized guest and unauthorized guest separately. Benefit: a future agent will not “fix” the app back to obsolete requirements.

### F6 — medium, adjacent scope: backend extensibility will not improve through frontend libraries

Evidence: `packages/housou/src/domain/danmaku.ts:1` combines candidate resolution, curation, proposals, revision operations, authorization and direct DB/query imports (1,420 lines). `db/queries/danmaku.ts` has 1,147 lines; `lib/baidu.ts` has 819. Domain code also imports live presence from `ws/housou` at line 95.

This sampled concentration is evidence of broader maintenance surfaces, not proof that a complete backend redesign is needed. Defer backend decomposition until a concrete extension requires it; isolate the relevant use case then, with existing backend tests. Keep it outside the frontend migration estimate except for HTTP contract work.

### F7 — low: routing is not the present architectural bottleneck

Evidence: `src/router.ts:4` defines home and room only. TanStack Router offers a coherent React routing/data-loading layer, but current route complexity does not justify a framework migration by itself. Preserve URLs and route lazy loading; do not introduce SSR/TanStack Start without a separate need.

## Measurement and limitations

`rg --files packages/kyoushitsu/src | xargs wc -l` reports 11,874 source lines, including styles, markup, comments and translations. Other large files include KengenPanel (1,039), HomeView (839), TimelineDanmakuSourcePanel (619). Most `src/lib` files do not import Vue/Pinia; `lib/site-config.ts` does, and browser globals/alias dependencies still need checking before extraction.

Searched root design/readme, package source/manifests, `.trellis/spec`, tests, Playwright config and root development wrapper. No `.github` workflow directory was found; this does not prove absence of external CI. Test existence is not test success. No installation, typecheck, build, browser run, benchmark or security audit was performed. Effort figures in `implement.md` are engineering estimates, not measurements of delivery speed.
