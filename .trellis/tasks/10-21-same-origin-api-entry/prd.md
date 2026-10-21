# 统一站点入口：业务服务迁入 /api 前缀可行性与方案

## Goal

Expose the existing Docker development preview through one configurable site
port: pages at `/`, all application backend traffic at `/api/`. Preserve
independent backend execution without publishing its port on the host.

## Background and approval

- Owner requested task creation and feasibility assessment on 2026-10-21;
  `9998 -> 9999/api/` describes the topology, not fixed port numbers.
- Owner accepted the recommended unified `/api/` direction and selected
  existing Docker development preview only. Production hosting is excluded.
- Owner reviewed the plan and authorized implementation with `可以；开始实施`.
- This is one integrated deliverable: the preview cannot satisfy acceptance
  until browser, backend, media and extension consumers agree on its entry.

## Baseline facts (before implementation)

- Preview currently publishes both services and derives the browser backend
  port from the inspected mapping (`dx:263`, `dx:306`).
- HTTP derives a separate origin (`packages/kyoushitsu-core/src/config/housou-url.ts:6`);
  room transport repeats that derivation
  (`packages/kyoushitsu-react/src/features/room/room-runtime.ts:138`).
- WS replaces the complete path with `/ws`
  (`packages/kyoushitsu-core/src/ws/client.ts:68`).
- Source resolution uses the request origin without a path prefix
  (`packages/housou/src/routes/bushitsu.ts:108`, `:121`);
  Baidu grants use root-absolute paths
  (`packages/housou/src/lib/baidu.ts:566`, `:674`).
- Extension validation drops the server path
  (`packages/houkago-adapter/src/host-policy.ts:36`), while grant parsing
  assumes an origin-only base and `/baidu/media/...`
  (`packages/houkago-adapter/src/runtime.ts:450`).
- Readiness currently requires a published endpoint for each service
  (`scripts/preview-config.py:266`); internal-only backend support needs work.

## Requirements

- R1: Keep pages and room deep links at their existing paths. Browser HTTP,
  WS, application media proxy, provider grant and OAuth callback endpoints
  use the site's origin and `/api/` prefix. External upstream media URLs
  retain their provider behavior.
- R2: Publish only the configured site port. Backend listener ports remain
  configurable and reachable by the frontend service over Docker networking.
  Do not retain a second public legacy route family as a fallback.
- R3: Preserve identity cookies, Origin checks, room admission, permissions,
  WS authority, reconnect behavior, media Range/seek and provider boundaries.
  Prefix handling must not weaken origin or extension authorization checks.
- R4: Preserve preview start/status/reuse/stop/down, ownership checks,
  configuration-change detection, bounded readiness and console format.
  Readiness must verify both backend health and the public `/api/health` path.
- R5: Update safe configuration examples and actual consumers together.
  Preserve existing private `.env` values, databases and unrelated work;
  report obsolete settings rather than silently deleting them.
- R6: Desktop and phone entry/room flows are mobile-required. Controlled
  provider fixtures and installed-extension checks must state their limits.
- R7: Owner follow-up changes manifest defaults to backend 8081 / frontend
  8080 and configuration to `BACKEND_*`, `FRONTEND_*`, `LAN_HOST`,
  `READY_TIMEOUT`. Honor the explicit site published port independently.
  Accept `/api/baidu/oauth/callback` as a relative OAuth configuration,
  resolving it against the validated request origin and pinning the full URI
  to its OAuth state for the token exchange. Preserve the owner's `.env` edits.

## Acceptance Criteria

- [x] A1 (R1, R2): With two different site/backend port configurations,
  including a Docker-assigned site host port, `/` and `/api/health` succeed;
  Docker inspection shows no backend host publication.
- [x] A2 (R1, R3, R6): Desktop/phone identity restoration, login/logout,
  room admission and commands work through the site origin; two-client WS
  synchronization and reconnect use `/api/ws`.
- [x] A3 (R1, R3): Returned application proxy URLs, HLS segment URLs, DASH
  references, Baidu grant/sentinel URLs and callback routes retain `/api/`;
  controlled Range/seek and provider authorization/revoke cases pass.
- [x] A4 (R1, R3): Installed Chromium extension pairing, grant parsing,
  requests and cleanup work with a path-bearing API base; wrong-origin and
  malformed-path requests remain rejected. Real Baidu OAuth is not claimed
  from fixture tests.
- [x] A5 (R4, R5): Lifecycle/configuration/console fixtures and isolated real
  Docker start/reuse/status/stop/down pass; data and unrelated services persist.
  Unknown `/api/...` routes return API errors rather than SPA HTML; backend
  failure cannot produce a ready status.
- [x] A6 (R3, R5, R6): Relevant lint/types/unit/build/contract checks and
  desktop/phone browser regressions pass with recorded fixture limits.
- [x] A7 (R7): Renamed keys control real listeners/publications, readiness,
  summaries and lifecycle; omitted listener keys follow manifest defaults.
  Relative callbacks retain the actual public scheme/host/port, reject URL
  escapes and use the identical absolute URI at authorization and exchange,
  even if callback configuration changes after authorization starts.

## Out of scope

- Production static hosting, reverse-proxy deployment, TLS/domain setup,
  remote changes, push, commit and archive.
- Backend business rewrite, protocol/database redesign, UI redesign,
  unrelated dirty room controls and new mobile-provider functionality.
- Live provider credentials or changes to the owner's running preview.

## Planning status

Implementation is authorized and in progress. See `design.md`, `implement.md`
and `validation.md` for the delivered boundary and verification evidence.
