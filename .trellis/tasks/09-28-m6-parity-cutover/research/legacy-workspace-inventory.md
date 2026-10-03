# Legacy frontend workspace inventory

Planning snapshot: 2026-09-28. This is a read-only inventory for M6; no
implementation or validation commands were run.

## Verified size and consumers

- `packages/kyoushitsu` contains 141 tracked files and 38 unit-test files.
- `packages/kyoushitsu-react` imports 26 distinct `houkago-kyoushitsu/*`
  subpaths across 25 files. Its manifest depends on the old workspace at
  `packages/kyoushitsu-react/package.json:21`.
- React's imports cover HTTP resources and generated DTOs, localization, room
  identity/session and WebSocket logic, permission rules, playback contracts
  and metadata, Baidu/provider and adapter helpers, danmaku selection/parsing,
  theme CSS and site configuration. `packages/kyoushitsu/package.json` maps
  these exports to files under the old workspace.
- The existing React build evidence records no Vue, Pinia, Eden or Housou
  server modules in the React bundle. The old workspace is a source/package
  boundary, not a runtime dependency on Vue for the React build.

## New neutral package contents

Create `packages/kyoushitsu-core` (`houkago-kyoushitsu-core`) as the final owner
of framework-independent browser/domain modules consumed by React. It should
have no React or Vue dependency. Likely groups to relocate after import-graph
review:

- HTTP boundary: `src/api/public.ts`, `http-client.ts`, resource adapters,
  resource keys/policies, generated SDK/DTOs, and the browser subset
  `openapi.json`.
- Domain/runtime helpers: room ID, room session, WebSocket client, permission,
  playback controller, player contract, clock and seek helpers, and media
  metadata.
- Provider/danmaku helpers: source and OAuth/adaptor helpers, candidate and
  track selection, file parsing, and local preferences that React consumes.
- Shared presentation primitives that are not framework-bound: typed
  localization, theme functions/CSS, and the core site-configuration loader.

Vue injection wrappers, Pinia stores, Vue components/composables, Vue API
barrels, and presentation-only helpers with no React consumer are not core
package contents. They can be removed with the old workspace after the
parity review; their behavior still needs a disposition in the parity matrix.

## Contract generation and cross-package paths

The Housou OpenAPI document remains authoritative at
`packages/housou/openapi.json`. The browser subset and generated SDK currently
live in `packages/kyoushitsu/openapi.json` and
`packages/kyoushitsu/src/api/generated/`:

- `openapi-ts.config.ts:4-5`
- `scripts/prepare-page-openapi.ts:2`
- `scripts/verify-http-contract.ts:3`
- `scripts/check-contract-drift.ts:1-2,34,42`
- `packages/housou/test/http-contract.test.ts:118-119`
- `biome.json:19-20`

All targets and checks must move together to the neutral package. The React
client must not import Housou server types or change HTTP/WS wire contracts.

## Existing app, tests, and tooling

- `dev.sh` already starts `dev:react`; root `package.json:16` still exposes
  `dev:kyoushitsu`, and `package.json:7` still includes the old unit-test
  directory.
- The Vue app is rooted at `packages/kyoushitsu/src/{main.ts,App.vue,router.ts}`
  and includes views, components, stores, composables, Vue-specific API
  adapters, Vite/TypeScript config, and two Playwright configs.
- Legacy browser tests cover entry, desktop and portrait room behavior,
  governance, subtitles, danmaku, and installed-Chromium adapter behavior.
  React browser tests cover entry, real-cookie room flows, media, Baidu, and
  danmaku. M4/M5 archive validation is the most recent React evidence; it is
  not a complete M6 parity comparison.
- Of the old unit tests, tests for pure helpers and generated HTTP contracts
  that move to core should move with those modules. Vue store/composable tests
  may be removed after equivalent React behavior has evidence. Useful old E2E
  cases must be mapped to React coverage before their runner and fixtures are
  removed.
- Other active references include `bun.lock`, `.trellis/config.yaml`,
  `packages/houkago-adapter/README.md`, root `design.md`, and active frontend
  specs. Update these to the final workspace layout. Keep archived Trellis
  tasks and journals as historical evidence.

## Migration grouping

1. Create the neutral package and move required modules, generated contracts,
   and tests; update React and temporarily retained Vue imports to consume the
   shared package.
2. Complete the linked `09-28-room-control-speed-dial` child in the React UI;
   it does not move into `houkago-kyoushitsu-core`.
3. Build the behavior/layout parity matrix and add missing React automated
   coverage while the Vue app and its browser suite are still available as the
   comparison baseline. Freeze the room-layout baseline after the child passes.
4. Record human residual review and resolve all blockers. Confirm the local
   React cutover and Git-based rollback procedure.
5. After the acceptance gates pass, remove the Vue workspace, its dependencies,
   scripts, tests, configs, and active docs/spec registrations. Regenerate the
   lockfile and run the post-removal quality gates.
