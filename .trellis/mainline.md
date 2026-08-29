# Trellis Mainline

## Initiative

- title: pluggable media-provider adaptors
- parent task: none
- objective: Extend Houkago's URL-first resolver/player boundary with direct,
  provider-specific adaptors while keeping credentials out of room state and
  media bytes off the Houkago server data plane.
- owner decisions: 2026-08-07 — queue placement remains owner-only; room guest
  controls persist per room and use chat/playback/playlist presets with optional
  fine-grained switches. 2026-08-07 — subtitle selection is viewer-local,
  HLS-only, and resets to Off for each new Enmoku; audio controls remain
  deferred until named audio metadata is available. 2026-08-07 — Baidu Netdisk
  uses a desktop client adaptor with server-saved and user-held credential
  modes; mobile Baidu playback remains deferred. 2026-08-28 — after the
  provider-neutral danmaku pool, hybrid selection, and Bilibili/local source
  migration slices completed, the user approved Baidu release danmaku matching
  as the next bounded mainline slice. 2026-08-29 — the parent danmaku
  integration completed manual episode correction, bounded Baidu fingerprint
  reuse, and cross-provider/browser evidence while preserving personal and
  audited global trust boundaries.

## Continuation

- mode: guided
- serial authorization: none
- next pulse: no-task (including after archive or a project-relevant user request)

## Ordered Work

| order | task / proposed child | state | readiness and dependency evidence |
| --- | --- | --- | --- |
| 1 | `.trellis/tasks/archive/2026-08/08-05-room-governance-foundation` | complete | Durable membership and owner governance delivered in `de93b07`; full-suite and applicable browser validation recorded by the archived task. |
| 2 | `.trellis/tasks/archive/2026-08/08-06-room-governance-hardening` | complete | Authorization, reconnection, revocation, and desktop/phone governance coverage delivered in `7760e19`; full-suite and Playwright validation passed. |
| 3 | `.trellis/tasks/archive/2026-08/08-07-queue-management` | complete | Owner-only durable queue placement, full-snapshot sync, and responsive browser coverage delivered in `261c30e`; task archival and journal follow the final workflow steps. |
| 4 | `.trellis/tasks/archive/2026-08/08-07-control-policy` | complete | Durable room policy, safe legacy fallback, owner-only control UI, and desktop/phone evidence delivered in `04509ce`; task archival and journal follow the final workflow steps. |
| 5 | `.trellis/tasks/archive/2026-08/08-07-subtitle-audio-ui` | complete | Viewer-local HLS subtitle selection, controlled desktop/phone browser coverage, and player ownership contract delivered in `8d2c9f7`; task archival and journal follow the final workflow steps. |
| 6 | `.trellis/tasks/archive/2026-08/08-07-baidu-netdisk-adaptor` | complete | Direct official OAuth, both retention modes, read-only browsing, token-free grants, Firefox real-account/reference evidence, and shared Firefox/Chromium automated builds are complete and archived. |
| 7 | `.trellis/tasks/archive/2026-08/08-08-chromium-baidu-adaptor` | complete | Chromium MV3 session-registry/DNR hardening delivered in `e211897`; final archived evidence records the 302-test full suite, installed Google Chrome and Microsoft Edge gates, and the controlled Playwright pass. |
| 8 | `.trellis/tasks/archive/2026-08/08-27-universal-danmaku-resolution` | complete | Parent integration completed manual episode search/correction, bounded Baidu fingerprint candidate reuse, Bilibili-plus-Baidu convergence, and responsive browser evidence; child dependencies are archived and the final validation record is ready for finish-work archival. |
| 9 | Houkago mobile provider companion | blocked | Deferred placeholder awaiting the user's scope and priority decision; no ordering or task start is authorized. |
| 10 | Choose the next bounded provider-adaptor slice | blocked | No provider is ranked or proposed; awaiting the user's next-scope decision. |

## Evidence and Decisions

- completed evidence: `de93b07` completed durable membership and owner-governance work; `7760e19` hardened its authorization and browser coverage; `261c30e` added owner queue management with 214 isolated package tests and desktop/phone Playwright coverage; `04509ce` persists room Kengen snapshots, preserves exact owner-only queue placement, and passed 219 isolated package tests plus desktop/phone Playwright coverage; `8d2c9f7` added viewer-local HLS subtitles and passed lint, typecheck, build, 221 isolated package tests, and 2 controlled Playwright cases; the universal danmaku parent integration passed the final full-suite, build, focused cross-provider/fingerprint, and phone/desktop Playwright gates recorded in its validation document.
- completed Baidu evidence: the installed Firefox reference path passed real
  server-saved sustained playback plus user-held owner/guest playback,
  owner-offline/reconnect, viewer eviction, same-room removal sync, and
  revoke/reauthorization isolation. Chromium MV3 hardening was delivered in
  `e211897`; the archived final evidence records 302 tests passed, the
  controlled installed-Chromium Playwright gate passed, and the installed
  Google Chrome 150 and Microsoft Edge 151 gates passed with the shared
  Chromium artifact. Browser-compatible sources pass both retention modes;
  source/container/codec-dependent failures are recorded as the native media
  compatibility boundary.
- next task/decision: no new provider-adaptor slice is authorized. Mobile
  provider playback and any further provider-adaptor work remain deferred until
  the user chooses the next scope.
