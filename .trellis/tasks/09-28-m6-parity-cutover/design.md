# M6 technical design

## Architecture decision

Create a new framework-neutral package at `packages/kyoushitsu-core` with the
workspace name `houkago-kyoushitsu-core`. It owns shared browser/domain logic
that React currently consumes from `houkago-kyoushitsu`. It must not import
React, Vue, Pinia, Eden, or application components. It may depend on
`houkago-kousoku` for protocol/domain types and browser APIs where a shared
client contract requires them.

The React app remains at `packages/kyoushitsu-react` and changes its imports to
the core package. While parity is being established, the legacy Vue app may
also consume core modules so its existing browser tests remain a runnable
comparison. This is a temporary migration state. The final state removes
`packages/kyoushitsu` and all Vue-only implementation, tests, configuration,
workspace dependencies, and active documentation for that app.

```text
Housou OpenAPI ──> kyoushitsu-core generated client/resources
                         ↑                    ↑
                 Kousoku contracts     React app/runtime

Legacy Vue app ──> kyoushitsu-core     (temporary parity baseline only)
```

The package is a client/domain library, not another UI app. Framework-neutral
room/session, playback, provider, danmaku, configuration, localization, theme,
and HTTP assets stay outside React components. React owns routing, rendering,
React hooks, and its application lifecycle. Housou remains the HTTP authority;
Kousoku remains the realtime contract and transport authority.

## Migration map

| Current boundary | Final destination | Rule |
| --- | --- | --- |
| `packages/kyoushitsu/src/api/public.ts`, shared HTTP client/resources/keys/policies and generated SDK | `packages/kyoushitsu-core/src/api/` | Preserve cancellation, typed errors, DTO fidelity, and generated-file ownership. Keep Vue Eden barrels out of core. |
| `packages/kyoushitsu/openapi.json`, generated SDK | `packages/kyoushitsu-core/openapi.json`, `packages/kyoushitsu-core/src/api/generated/` | Housou remains the authoritative OpenAPI source. Update generator, drift checks, Housou tests, and formatter exclusions together. |
| Room ID, session controller, WS client, permission and playback/sync helpers | `packages/kyoushitsu-core/src/room/` and `src/playback/` | Keep one server-authored room state and one transport; retain framework-free lifecycle and ordering behavior. |
| Source/subtitle metadata, seekability, provider/OAuth/adapter and danmaku parsing/selection/preferences | `packages/kyoushitsu-core/src/media/`, `src/provider/`, and `src/danmaku/` | Move only reusable/domain behavior; React owns presentation and React-specific effects. Preserve current provider, permission, and local-state contracts. |
| Typed messages, theme behavior/CSS, and core site-config loader | `packages/kyoushitsu-core/src/i18n/`, `src/theme/`, and `src/config/` | Keep copy/tokens consistent; no Vue injection or React component in core. |
| Vue `App.vue`, views, components, stores, composables, Vue API adapters, Vite/Playwright configs | Remove with the old workspace after parity acceptance | Do not copy framework-specific UI or retain the old app as a fallback/reference. First map its supported behavior to React evidence. |
| Pure helper tests for modules moved to core | `packages/kyoushitsu-core/test/` | Move tests with retained behavior. Remove Vue-store/composable-only tests only after their product behavior has equivalent React evidence or an explicit unsupported-case disposition. |

The inventory and concrete source paths are recorded in
[`research/legacy-workspace-inventory.md`](research/legacy-workspace-inventory.md).
Unconsumed old helpers are not automatically part of core: classify them
against the parity matrix as migrate, replace, or remove.

## HTTP and realtime data flow

The contract pipeline remains:

1. `packages/housou/openapi.json` is generated from Housou and remains the
   authoritative complete contract.
2. `scripts/prepare-page-openapi.ts` selects the browser JSON subset into
   `packages/kyoushitsu-core/openapi.json`.
3. `scripts/verify-http-contract.ts` checks the subset and response/error
   guarantees; `openapi-ts.config.ts` generates the client under core.
4. Core HTTP adapters expose the browser resource and cancellation contracts to
   React Query. Core never imports Housou's server application type.
5. Kousoku messages feed the shared room/session and playback controllers;
   React owns their UI binding. No protocol, endpoint, or database change is
   part of M6.

Every path currently pinned to `packages/kyoushitsu/openapi.json` or
`src/api/generated` must move in the same batch: root generator config, prepare
and verify scripts, drift checker, Housou contract tests, Biome generated-file
exclusions, root scripts, and package tests.

## Parity and cutover contract

Use the legacy Vue app and its existing Playwright suite as a temporary
behavior reference while building a parity matrix from the M4/M5 PRDs,
validation records, and old browser cases. The React suite must cover:

- Entry, identity restore/authentication, room create/join/deep links, and
  failure/recovery states.
- Admission, permission, realtime room state, queue, chat, governance, and
  revocation.
- Local media fixtures, playback authority/synchronization, source/subtitle
  controls, fullscreen/cinema, Baidu pairing/OAuth/grants/revoke, and danmaku
  selection/display/fallback/proposal/manual correction.
- Supported desktop, portrait, short/tall viewport, cinema/fullscreen,
  keyboard, focus, reduced-motion, and installed-Chromium adapter behavior.

The matrix distinguishes parity gaps from intentionally unsupported cases.
Automated checks prove behavior and layout constraints; a recorded human review
captures visual/interaction residuals. Cutover is ready only when every matrix
row has evidence, no blocking residual remains, and the user accepts the
presented M6 result.

The `09-28-room-control-speed-dial` task is linked as an independently
verifiable M6 child. Its controls, focus behavior, responsive placement, and
playlist-layout change remain React UI in `packages/kyoushitsu-react`; none of
that presentation belongs in the framework-neutral core. M6's whole-application
parity sign-off and old-workspace removal depend on the child passing its own
acceptance criteria. The final parity matrix must use the child's accepted
React state as its room-layout baseline.

The archived `10-01-room-layout-refinement` validation is the newer room-layout
evidence: owner visual acceptance and six room-controls plus six media browser
cases passed on 2026-10-03. Map that evidence to the speed-dial child's criteria;
its older browser-launch limitation is historical and its independent task
remains open. Do not infer whole-child acceptance from the layout archive.

The current working tree uses `preview.sh` / `./dx preview` to launch React
locally and deletes `dev.sh`. Preserve this separate, uncommitted preview work
and its configurable origin/port behavior throughout extraction. After acceptance, remove the old
`dev:kyoushitsu` command, Vue workspace, and associated app/config/test paths.
Keep `dev:react` and the React package identity unchanged in this task. Hosted
production deployment is not included.

## Rollback

The refreshed planning-time committed base is `k-on` at `68d8b39` on
2026-10-04; recheck HEAD and the working tree before implementation. This
revision includes the accepted room layout but excludes current uncommitted
preview, configuration/origin, and policy work. Record that pre-existing diff
and carry its changes through moved shared files; do not reset the working tree
to establish a baseline. Make the neutral-package extraction, parity additions, and
legacy removal reviewable in ordered commit groups. Do not remove Vue before
all parity and human-review gates pass. No data or server-contract migration is
planned, so rollback restores the last known-good Git revision by reverting the
M6 commit group(s), which restores the legacy app, scripts, and dependency
graph together. Revert only M6-owned changes and preserve the pre-existing
working-tree changes. Establish fresh pre-M6 validation before naming a
last known-good revision; historical layout validation is scoped evidence,
not a validation of the current working tree. Preserve build/browser evidence
for the rollback review.

## Parity defects found during implementation

The supported source inventory supplements browser cases: some active legacy
room information and actions were not covered by the old E2E suite. Preserve
permission preset shortcuts as well as custom checkboxes, and preserve online
duration/offline participant history in the existing React room-information
dialog. Retain pure preset/formatting helpers in core; derive presence projection
from authoritative `SHUSSEKI` snapshots and timestamps, with no extra socket or
HTTP polling. A local display clock is presentation only and cleans up with the
dialog. These are existing room-information/control requirements, not new scope.

The launcher must clear actual interactive obstacles after queue/chat changes,
not only empty layouts. Resolve the nearest clear point within the existing
safe-area/dock limits, preserving the stored normalized preferred position.
Automatic content-driven correction must not overwrite localStorage. Re-evaluate
visible obstacles on content resize/mutation, page scroll and viewport resize;
guard observer updates against portal feedback. If no clear point exists, report
the constraint rather than hiding the launcher or treating fallback as verified
clearance. Browser tests retain full player/queue-control/composer bounds.

## Main risks and stop conditions

- A React feature still imports a legacy export or a transitive helper is
  missed. Require an active-source/config search for old package paths before
  removal and a post-removal root build.
- Generated HTTP output is moved without updating one pinned path. Run contract
  generation and drift checks after relocation and again after deletion.
- A legacy behavior is not represented by an existing React test. Do not use
  the current React pass count as whole-app parity; add a React case or record
  an explicit unsupported decision before deletion.
- A visual mismatch, keyboard regression, mobile overflow, adapter failure,
  stale async response, duplicate transport/player, or contract drift blocks
  cutover until resolved or explicitly accepted in the human review.
