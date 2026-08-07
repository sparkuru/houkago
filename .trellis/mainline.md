# Trellis Mainline

## Initiative

- title: room-governance foundation
- parent task: none
- objective: Advance the room-governance foundation declared in `design.md` §10.3 without expanding the URL-first product boundary.
- owner decisions: 2026-08-07 — queue placement remains owner-only; room guest
  controls persist per room and use chat/playback/playlist presets with optional
  fine-grained switches. 2026-08-07 — subtitle selection is viewer-local,
  HLS-only, and resets to Off for each new Enmoku; audio controls remain
  deferred until named audio metadata is available.

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
| 6 | Choose the next bounded room-governance slice | blocked | A user must select one concrete follow-up allowed by `design.md` §10.3 before a new task can be created; no scope or priority is approved. |

## Evidence and Decisions

- completed evidence: `de93b07` completed durable membership and owner-governance work; `7760e19` hardened its authorization and browser coverage; `261c30e` added owner queue management with 214 isolated package tests and desktop/phone Playwright coverage; `04509ce` persists room Kengen snapshots, preserves exact owner-only queue placement, and passed 219 isolated package tests plus desktop/phone Playwright coverage; `8d2c9f7` added viewer-local HLS subtitles and passed lint, typecheck, build, 221 isolated package tests, and 2 controlled Playwright cases.
- current blocker / dirty-state warning: Product priority is unresolved. A Project Pulse must inspect the working tree and validation/archive evidence again before continuation.
- next user decision: Choose one concrete, bounded follow-up within the room-governance categories allowed by `design.md` §10.3.
