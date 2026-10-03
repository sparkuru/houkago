# M6 implementation plan

Implementation is gated on explicit approval of the final M6 planning summary.
Run these steps in order; the Vue app is a temporary parity reference and is
removed only after the parity and human-review gates pass.

## Ordered checklist

### 1. Inventory the parity baseline

- [x] Record current HEAD and the pre-existing working-tree diff, including
      preview/origin/configuration/policy work. Preserve those edits when moving
      shared modules and updating overlapping scripts; do not commit unrelated
      changes as M6 work.
- [x] Establish fresh pre-M6 checks on the current working tree; distinguish
      existing failures from migration regressions and record the rollback base.
- [x] Reconcile every legacy Vue E2E case, M4/M5 acceptance item, and supported
      entry/room/media/provider/danmaku/layout state into a draft parity matrix.
- [x] Record current Vue and React coverage, required React cases, fixtures,
      viewport, authentication/admission state, and expected result per row.
- [x] Run the legacy suite as the comparison baseline while the old workspace
      still exists. Retain failures as baseline evidence; distinguish them from
      newly introduced React gaps.
- [x] Write the matrix and screenshot/review locations under the M6 task's
      `research/` directory.

### 2. Create `houkago-kyoushitsu-core`

- [x] Add `packages/kyoushitsu-core` with a framework-neutral package manifest,
      exports, typecheck/test scripts, and only the dependencies needed by the
      shared client/domain modules.
- [x] Move React-consumed framework-neutral HTTP, room/session, WebSocket,
      permission, player/sync, provider, danmaku, configuration, localization,
      and theme modules. Convert internal aliases/imports to package-relative
      boundaries where needed; do not duplicate production source.
- [x] Move corresponding pure unit tests with the modules. Keep Vue-specific
      UI/store/composable tests in the old workspace until parity disposition.
- [x] Point React to core. Temporarily point the Vue app's shared consumers to
      core where necessary so the old app remains runnable as a comparison.
- [x] Add the core package to `.trellis/config.yaml`; add focused core frontend
      specs documenting package boundaries and export rules.

### 3. Relocate browser HTTP contracts

- [x] Move the browser OpenAPI subset and generated SDK/DTO files to core.
- [x] Update `openapi-ts.config.ts`, page OpenAPI transform/verification,
      `scripts/check-contract-drift.ts`, Housou contract tests, root test and
      Biome paths together.
- [x] Regenerate and review the SDK. Preserve stable operation IDs, typed
      error responses, cancellation behavior, and the 46-operation browser
      contract; keep the Housou full OpenAPI document authoritative.
- [x] Remove React and temporary Vue imports from the old package's exports.
      Confirm no generated or runtime client imports Housou server types.

### 4. Reach React behavior and layout parity

- [x] Restore active legacy permission preset shortcuts and online-duration /
      offline-member history through shared pure helpers and the existing
      React control dialog; test authoritative two-client state and cleanup.
- [x] Verify state-dependent launcher clearance with populated queue and chat
      in normal/phone-cinema layouts; preserve stored preferred coordinates
      when automatic obstacle avoidance temporarily changes rendered position.
- [x] Complete the linked speed-dial child acceptance in the React room before
      freezing the final parity matrix; keep the UI in React rather than core.
- [x] Map every speed-dial child criterion to the newer archived
      `10-01-room-layout-refinement/validation.md` evidence and identify residual
      gaps. That task's owner acceptance does not automatically close the
      independently tracked speed-dial child.
- [x] Use the accepted child result as the room-layout baseline in the final
      whole-application parity matrix.
- [x] Verify speed-dial and playlist behavior against the child PRD: all prior
      controls remain available with unchanged permissions, and desktop,
      portrait, cinema, touch, keyboard, safe-area, and reduced-motion cases
      pass without overlap or overflow.
- [x] Port or add React browser cases for every parity matrix gap before
      removing the legacy test oracle. Include legacy-only governance,
      subtitle, responsive queue/chat, and installed-Chromium adapter cases.
- [x] Inventory legacy-only unit/source surfaces as well as E2E: distinguish
      active presence/preset behavior from dormant nickname gate/chat-theme
      helpers using actual runtime consumers and server identity labeling.
- [x] Verify host/member permission and revocation; entry/auth/room failure and
      recovery; local MP4/HLS/DASH; subtitle/source switching; authorized guest
      playback; Baidu pairing/OAuth/grants/revoke; danmaku precedence, fallback,
      manual correction and fullscreen overlay.
- [x] Run desktop 1280×900, portrait 375×812 and iPad, short/tall desktop, and
      cinema/fullscreen scenarios where supported. Check keyboard/focus,
      touch targets, reduced motion, and horizontal overflow.
- [x] Record human visual/interaction residuals with screenshots. Resolve all
      blocking findings; record explicit acceptance for any remaining
      non-blocking difference.
- [x] Confirm the user-facing M6 parity summary is accepted before legacy
      workspace deletion.

### 5. Remove the legacy Vue workspace

- [x] Delete `packages/kyoushitsu` only after Steps 1–4 pass and cutover is
      approved. This includes Vue views/components/stores/composables, old-only
      helpers, obsolete tests and fixtures, Vite/TypeScript/Playwright configs,
      and the old package manifest.
- [x] Remove root `dev:kyoushitsu` and the old test path; preserve the current
      `preview.sh` / `./dx preview` React entry, configurable origin/ports, and
      `dev:react`. Move any retained adapter-installed browser
      scenario to the React or adapter-owned test boundary before deleting its
      old config.
- [x] Remove obsolete Vue dependencies when no workspace uses them, then
      regenerate `bun.lock`; do not remove dependencies still used by Housou or
      another package.
- [x] Update `packages/houkago-adapter/README.md`, root `design.md`, active
      `.trellis/spec` docs, package mapping, and React spec links. Keep archived
      tasks/journals as history.

### 6. Post-removal quality and cutover gate

- [x] Confirm no active source/config/test imports or paths reference
      `houkago-kyoushitsu` or `packages/kyoushitsu`; historical archive matches
      are allowed.
- [x] Confirm core imports neither React nor Vue, the React build graph
      excludes Vue/Pinia/Eden/server modules, and browser contract output stays
      deterministic.
- [x] Run the full quality and browser gates below, inspect screenshots and
      failures, and record validation evidence in the task.
- [x] Present a final cutover/rollback and residual-review summary. Do not
      deploy to production under M6.

### Pre-removal checkpoint — 2026-10-04

Steps 1–3 and runnable Step 4 checks passed; see [validation.md](validation.md).
The owner subsequently accepted all remaining presentation criteria.
Step 5 deletion and Step 6 post-removal gates passed. The pre-removal
Git restoration rehearsal passed; repeat it for any later deletion checkpoint.

## Validation commands

Use the repository `./dx` wrapper. During the comparison phase, run the old
Vue browser suite and React browser suite before removing either test config.
Use task-owned preview ports if 3000/5173 are occupied. The preview runner
checks below exercise the isolated preview script; they do not replace the
Playwright browser suites.

```sh
./dx bun install
./dx bun run typecheck
./dx bun run lint
./dx bun run test
./dx bun run contract:drift
./dx bun run --filter houkago-kyoushitsu-core typecheck
./dx bun run --filter houkago-kyoushitsu-core test
./dx bun run --filter houkago-kyoushitsu-react build
bash scripts/test-react-preview.sh  # host-side fake Docker/Bun harness; needs Python
git diff --check
python3 ./.trellis/scripts/task.py validate 09-28-m6-parity-cutover
```

For React browser tests, start the isolated Housou/React preview with
`scripts/dev-react-preview.sh` on task-owned ports and run Playwright with
`PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_HOUSOU_URL`, and
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` as in the archived M5 validation record. The
validated invocation shape is:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5195 \
PLAYWRIGHT_HOUSOU_URL=http://127.0.0.1:3195 \
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome \
  node_modules/.bin/playwright test \
  --config packages/kyoushitsu-react/playwright.config.ts \
  --output=/tmp/houkago-m6-react-final
```

Adjust the two port values and output directory if needed. Before removal, also
run the Vue package's `typecheck`, unit suite, and `test:e2e` against its
Housou/Vite preview. For the installed Chromium adapter, build the extension
and run its mapped React/adapter-owned Playwright project.
After removal, run contract generation twice through `contract:drift` and
confirm the generated files are byte-stable. Store the exact browser commands,
viewport results, and screenshot paths in the validation record.

## Stop conditions and rollback

- Stop before legacy deletion for any unmapped behavior, blocking visual or
  accessibility regression, failing parity case, contract drift, API/WS
  contract change, stale async state, duplicate room/player resource, or
  unresolved adapter behavior.
- Stop if the neutral package pulls in a UI framework or React requires a
  fallback import from the old package.
- The refreshed committed base is `68d8b39` on `k-on` (2026-10-04); recheck
  before work starts and record fresh validation plus the separate pre-existing
  working-tree diff. If cutover fails, revert only the M6 commit group(s) to
  restore the old workspace, scripts, and import graph together while preserving
  unrelated changes. Do not use a workspace reset as rollback. No backend data
  or protocol rollback is required.
