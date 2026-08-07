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
  modes; mobile Baidu playback and filename-based danmaku matching are deferred.

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
| 4 | `.trellis/tasks/08-07-control-policy` | complete | Durable room policy, safe legacy fallback, owner-only control UI, and desktop/phone evidence delivered in `04509ce`; task archival and journal follow the final workflow steps. |
| 5 | `.trellis/tasks/08-07-subtitle-audio-ui` | complete | Viewer-local HLS subtitle selection, controlled desktop/phone browser coverage, and player ownership contract delivered in `8d2c9f7`; task archival and journal follow the final workflow steps. |
| 6 | `.trellis/tasks/08-07-baidu-netdisk-adaptor` | complete | Direct official OAuth, both retention modes, read-only browsing, token-free grants, Firefox real-account/reference evidence, and shared Firefox/Chromium automated builds are complete; ready to archive. |
| 7 | Installed Chromium adaptor smoke and hardening | ready | Independent next task: run the real installed-Chromium matrix and harden browser-specific DNR/WebRequest behavior before making any Chromium production-support claim. |
| 8 | Baidu filename-based danmaku matching | blocked | Follow-up explicitly requested, but deferred until the direct Baidu adaptor contract is delivered. |
| 9 | Houkago mobile provider companion | blocked | Follow-up explicitly requested; desktop adaptor behavior and protocol must stabilize before mobile implementation. |
| 10 | Choose the next bounded provider-adaptor slice | blocked | Depends on completion evidence from the Baidu adaptor and an explicit user priority. |

## Evidence and Decisions

- completed evidence: `de93b07` completed durable membership and owner-governance work; `7760e19` hardened its authorization and browser coverage; `261c30e` added owner queue management with 214 isolated package tests and desktop/phone Playwright coverage; `04509ce` persists room Kengen snapshots, preserves exact owner-only queue placement, and passed 219 isolated package tests plus desktop/phone Playwright coverage; `8d2c9f7` added viewer-local HLS subtitles and passed lint, typecheck, build, 221 isolated package tests, and 2 controlled Playwright cases.
- completed Baidu evidence: the installed Firefox reference path passed real
  server-saved sustained playback plus user-held owner/guest playback,
  owner-offline/reconnect, viewer eviction, same-room removal sync, and
  revoke/reauthorization isolation. Shared Chromium contracts, manifests, and
  builds pass, but installed Chromium support is not claimed.
- next task: installed Chromium adaptor smoke and browser-specific hardening.
  Filename-based danmaku and mobile playback remain separate follow-ups.
