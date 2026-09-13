# Trellis Mainline

## Initiative

- title: Houkago frontend architecture and stack migration
- parent task: `.trellis/tasks/09-12-frontend-refactor-plan`
- objective: Thin pages, business features, an independent room-session
  controller, an HTTP Query layer and an independent player driver; migrate
  toward React, Hey API, TanStack Query/Router, Tailwind and shadcn/ui after
  stabilizing these boundaries, preserving existing behavior.
- owner decision: 2026-09-12 — the user accepted the recommended direction and
  migration-benefit priorities, requested plan and global mainline, and
  explicitly said not to implement yet.
- stage authorization: 2026-09-12 — M0 and the bounded M1 session/player slice
  are complete and archived; M2–M6 remain unapproved.
- authoritative roadmap: [Benefit priorities and delivery map](tasks/09-12-frontend-refactor-plan/roadmap.md)

## Continuation

- mode: guided
- serial authorization: none
- execution authorization: M1 session/player slice complete; no M2–M6
  continuation
- next pulse: review archived M1 evidence and request explicit M2 authorization
  if the user wants to continue
- next permitted action: plan/review M2 only after explicit authorization. Do
  not change dependencies, start M2, or deploy.

## Ordered Work

M0 and M1 are archived children. M2–M6 remain proposed children
and require their own authorization and dependency checks.

| order | task / proposed child | state | readiness and dependency evidence |
| --- | --- | --- | --- |
| Plan | `09-12-frontend-refactor-plan` | planning | Audit, design, benefit ranking, contracts and staged estimates documented; implementation not authorized |
| M0 | behavior-baseline | archived | Baseline evidence recorded; browser suites remain environment-blocked; M1 planning is now authorized |
| M1 | session-player-boundaries | archived | Depends on M0; implementation and focused evidence archived at `archive/2026-09/09-12-session-player-boundaries` |
| M2 | http-contract-resources | planned | Depends on M0 and M1 ownership contracts for integration; OpenAPI/Hey API and Query policy |
| M3 | react-shell-ui-foundation | planned | Depends on M1/M2; React/Vite, Router/Query, identity/home, tokens and primitives |
| M4 | room-features | planned | Depends on M3 and validated session controller; realtime queue/chat/governance |
| M5 | media-provider-danmaku | planned | Depends on M4 and player seam; media lifecycle, Baidu, subtitles/fullscreen and danmaku |
| M6 | parity-cutover | planned | Depends on M4/M5, all acceptance gates and explicit cutover authorization; preserve rollback |

## Evidence and Decisions

- Current implementation assessment: [audit.md](tasks/09-12-frontend-refactor-plan/audit.md).
  Static analysis only; no runtime tests, browser verification or migration performed.
- Acceptance: [PRD](tasks/09-12-frontend-refactor-plan/prd.md),
  [contracts S1–S6](tasks/09-12-frontend-refactor-plan/spec.md),
  [design](tasks/09-12-frontend-refactor-plan/design.md),
  [effort and verification](tasks/09-12-frontend-refactor-plan/implement.md).
- Priority: session ownership and HTTP resources first in benefit; player and
  feature boundaries next, then UI reuse. Hey API provides contract separation;
  routing and React replacement alone have lower immediate maintenance value.
  The full eight-row ranking lives in the roadmap, not a second backlog here.
- Preservation: room URLs, admission/identity, owner-only queue placement,
  authorized-guest playback, latest WS authority, local subtitle/preferences,
  provider/adapter boundaries and Warm Club layouts/theme.
- Exclusions: backend rewrite, protocol/database redesign, visual rebrand and
  new mobile-provider functionality. Existing shared/backend/media assets stay.
- Estimate: 25–39 person-days before contingency, 30–51 with contingency under
  the plan assumptions; not a delivery commitment or implementation approval.
- Next user decision: whether to authorize M2 after reviewing the archived M1
  evidence. Do not infer serial continuation from M1 completion.
- Dirty-state handling: inspect Git before any future action. The archived M1
  update includes bounded implementation and task evidence; no M2 product code
  or dependency changes are authorized.

## Previous Initiative and Preserved History

- Previous visual mainline is retained verbatim as a historical snapshot:
  [previous-mainline.md](tasks/09-12-frontend-refactor-plan/previous-mainline.md).
  Its old pending-commit/next-action instructions are superseded by this record.
- The visual parent `.trellis/tasks/08-29-visual-experience-refresh` still has
  status planning; this update neither completes nor archives it.
- Room-shell and queue-control children are already archived with status
  completed: `.trellis/tasks/archive/2026-08/08-30-warm-club-visual-followup`
  and `.trellis/tasks/archive/2026-08/08-30-warm-club-queue-control-consistency`.
  Their archived validation records remain historical evidence, not newly run checks.
- Remaining standalone dialog/chat polish is deferred from the active mainline.
  Preserve shipped UI behavior during migration. The mobile provider companion
  remains paused; no new mobile work is authorized.
