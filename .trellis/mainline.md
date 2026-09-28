# Trellis Mainline

## Initiative

- title: Houkago frontend architecture and stack migration
- historical parent task: `.trellis/tasks/archive/2026-09/09-12-frontend-refactor-plan`
- objective: Thin pages, business features, an independent room-session
  controller, an HTTP Query layer and an independent player driver; migrate
  toward React, Hey API, TanStack Query/Router, Tailwind and shadcn/ui after
  stabilizing these boundaries, preserving existing behavior.
- owner decision: 2026-09-12 — the user accepted the recommended direction and
  migration-benefit priorities, requested plan and global mainline, and
  explicitly said not to implement yet.
- stage authorization: M0, M1 and M2 are complete and archived. On 2026-09-26
  the user requested completing M2 and approved its commit/archive batch.
  The user approved creating M3 and entering planning on 2026-09-26,
  then approved its final planning summary with `开始实现 M3`;
  M3 is complete, committed and archived after the owner's `提交` approval.
  On 2026-09-28, the user selected the 08-29 visual-refresh parent to handle
  before further migration work and authorized planning its final
  interaction-surface child. The user then approved the child's final planning
  summary and implementation started on 2026-09-28. The child was reviewed,
  committed and archived after the owner's `可以；归档`; M4–M6 remain
  unapproved. On 2026-09-28, the owner requested archival of both legacy
  parent tasks. Their closure records distinguish delivered children from
  outstanding proposals.
- historical roadmap: [Benefit priorities and delivery map](tasks/archive/2026-09/09-12-frontend-refactor-plan/roadmap.md)

## Continuation

- mode: no active parent task
- serial authorization: none
- execution authorization: bounded M0–M3 tasks fulfilled; the approved visual
  interaction-surface child is complete and archived
- next pulse: await a new scoped request; review the archived roadmap against
  current code before any migration continuation
- next permitted action: plan a newly authorized slice; M4–M6 and cutover
  remain unapproved

## Ordered Work

Both parent tasks and all eight existing children are archived. M3 evidence is
retained at `archive/2026-09/09-26-react-shell-ui-foundation`. M4–M6 remain
historical proposals requiring new planning, authorization and checks.

| order | task / proposed child | state | readiness and dependency evidence |
| --- | --- | --- | --- |
| Plan | `09-12-frontend-refactor-plan` | archived | Planning delivered; M0–M3 archived; M4–M6 were not started |
| M0 | behavior-baseline | archived | Historical baseline recorded; browser failures are not parity evidence |
| M1 | session-player-boundaries | archived | Depends on M0; implementation and focused evidence archived at `archive/2026-09/09-12-session-player-boundaries` |
| M2 | http-contract-resources | archived | A1–A8 verified; work commits d7410cf/d76c8e5; 434 aggregate tests and static/build/drift gates pass |
| M3 | react-shell-ui-foundation | archived | A1–A7 accepted; work commits 8c5a326/ae37464; 465 tests, 56 browser cases, 124 shell checks and static/build/drift gates passed; preview stopped |
| Visual final slice | `09-28-warm-club-interaction-surface-polish` | archived | Reviewed and approved; work commits `e0ff941` / `db9c50a`, archive commit `ff019f2`; visual parent also archived |
| M4 | room-features | unstarted proposal | Depends on M3 and validated session controller; realtime queue/chat/governance |
| M5 | media-provider-danmaku | unstarted proposal | Depends on M4 and player seam; media lifecycle, Baidu, subtitles/fullscreen and danmaku |
| M6 | parity-cutover | unstarted proposal | Depends on M4/M5, all acceptance gates and explicit cutover authorization; preserve rollback |

## Evidence and Decisions

- Initial planning assessment: [audit.md](tasks/archive/2026-09/09-12-frontend-refactor-plan/audit.md).
  That historical assessment was static analysis only. Completed M2 evidence:
  [validation.md](tasks/archive/2026-09/09-13-http-contract-resources/validation.md).
- Acceptance: [PRD](tasks/archive/2026-09/09-12-frontend-refactor-plan/prd.md),
  [contracts S1–S6](tasks/archive/2026-09/09-12-frontend-refactor-plan/spec.md),
  [design](tasks/archive/2026-09/09-12-frontend-refactor-plan/design.md),
  [effort and verification](tasks/archive/2026-09/09-12-frontend-refactor-plan/implement.md),
  and [closure boundary](tasks/archive/2026-09/09-12-frontend-refactor-plan/closure.md).
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
- M3 scope decision: user approved automatic same-window handoff from React home
  to existing Vue rooms on 2026-09-26. New app stays opt-in; room/media migration
  remains M4/M5. Compatible new patches are locked without upgrading old entries.
- Implementation authorization: final summary from session
  `01a0dc8f-5005-74d1-9085-1c08b8f24c0d` was approved with `开始实现 M3`.
  The owner approved residual review and commit/archive with `提交` after runnable
  evidence. No cutover or M4 continuation is authorized.
- M3 automated evidence: [validation.md](tasks/archive/2026-09/09-26-react-shell-ui-foundation/validation.md).
  A1–A7 accepted; executed work batches:
  [commit-plan.md](tasks/archive/2026-09/09-26-react-shell-ui-foundation/commit-plan.md).
  Work commits: `8c5a326` / `ae37464`; archive commit: `670e4dd`.
  M3 is archived; the parent was subsequently closed at the owner's request.
- Dirty-state handling: M2/M3 work is committed; the pre-existing `dev.sh` URL
  edits remain outside their commits and must be preserved.

## Previous Initiative and Preserved History

- Previous visual mainline is retained verbatim as a historical snapshot:
  [previous-mainline.md](tasks/archive/2026-09/09-12-frontend-refactor-plan/previous-mainline.md).
  Its old pending-commit/next-action instructions are superseded by this record.
- The visual parent is archived at
  [08-29-visual-experience-refresh](tasks/archive/2026-09/08-29-visual-experience-refresh/closure.md).
  Its four child slices are complete; the closure record does not claim fresh
  full-parent integration validation.
- On 2026-09-28, the owner selected that parent to handle before further
  migration work and authorized planning its final dialog/gate/chat/cinema
  child. The owner approved the final planning summary, reviewed the completed
  implementation and requested archival on 2026-09-28. The child is archived
  at `tasks/archive/2026-09/09-28-warm-club-interaction-surface-polish`;
  M4–M6 remain unapproved.
- Room-shell and queue-control children are already archived with status
  completed: `.trellis/tasks/archive/2026-08/08-30-warm-club-visual-followup`
  and `.trellis/tasks/archive/2026-08/08-30-warm-club-queue-control-consistency`.
  Their archived validation records remain historical evidence, not newly run checks.
- Remaining standalone dialog/chat polish remains outside the migration scope.
  Preserve shipped UI behavior during migration. The mobile provider companion
  remains paused; no new mobile-provider work is authorized.
