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
- stage authorization: 2026-09-12 — the user approved starting only the bounded
  M0 behavior baseline; M1–M6 remain unapproved.
- authoritative roadmap: [Benefit priorities and delivery map](tasks/09-12-frontend-refactor-plan/roadmap.md)

## Continuation

- mode: guided
- serial authorization: none
- execution authorization: M0 behavior baseline only
- next pulse: review and commit the completed M0 evidence, then stop for an
  explicit M1 decision
- next permitted action: complete the M0 commit/archive workflow. Do not start
  M1, change dependencies/product code, or deploy on the basis of this record.

## Ordered Work

M0 is an authorized child in progress. M1–M6 remain proposed children, and
each requires its own normal planning/approval gates and dependency checks.

| order | task / proposed child | state | readiness and dependency evidence |
| --- | --- | --- | --- |
| Plan | `09-12-frontend-refactor-plan` | planning | Audit, design, benefit ranking, contracts and staged estimates documented; implementation not authorized |
| M0 | behavior-baseline | complete, commit pending | Baseline evidence recorded; browser suites remain environment-blocked and M1 is not authorized |
| M1 | session-player-boundaries | planned | Depends on M0; extract session/player ownership while preserving working Vue frontend |
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
- Next user decision: whether/when to authorize M1 after reviewing the M0
  baseline. Do not infer serial continuation from M0 completion.
- Dirty-state handling: inspect Git before any future action. This planning
  delivery changes project documents only and is not committed; do not treat
  document presence or an archived predecessor as implementation evidence.

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
