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
- stage authorization: M0, M1 and M2 are complete and archived. On 2026-09-26
  the user requested completing M2 and approved its commit/archive batch.
  The user approved creating M3 and entering planning on 2026-09-26,
  then approved its final planning summary with `开始实现 M3`;
  M3 implementation is authorized. M4–M6 remain unapproved.
- authoritative roadmap: [Benefit priorities and delivery map](tasks/09-12-frontend-refactor-plan/roadmap.md)

## Continuation

- mode: guided
- serial authorization: none
- execution authorization: M3 implementation and validation; bounded M2 task fulfilled
- next pulse: execute owner-approved M3 commits, archive and journal
- next permitted action: finish the approved M3 batch; no later-stage continuation

## Ordered Work

M0, M1 and M2 are archived children.
M3 is the active child `09-26-react-shell-ui-foundation`. M4–M6 remain
proposed children requiring their own authorization and checks.

| order | task / proposed child | state | readiness and dependency evidence |
| --- | --- | --- | --- |
| Plan | `09-12-frontend-refactor-plan` | planning | Stage scope documented; M0–M2 archived; M3 authorized; M4–M6 authorization pending |
| M0 | behavior-baseline | archived | Historical baseline recorded; browser failures are not parity evidence |
| M1 | session-player-boundaries | archived | Depends on M0; implementation and focused evidence archived at `archive/2026-09/09-12-session-player-boundaries` |
| M2 | http-contract-resources | archived | A1–A8 verified; work commits d7410cf/d76c8e5; 434 aggregate tests and static/build/drift gates pass |
| M3 | react-shell-ui-foundation | in_progress | Implementation/independent check passed: 465 tests, 56 browser cases, 124 shell checks; preview stopped; owner accepted residual-review and commit/archive batch with 提交 |
| M4 | room-features | planned | Depends on M3 and validated session controller; realtime queue/chat/governance |
| M5 | media-provider-danmaku | planned | Depends on M4 and player seam; media lifecycle, Baidu, subtitles/fullscreen and danmaku |
| M6 | parity-cutover | planned | Depends on M4/M5, all acceptance gates and explicit cutover authorization; preserve rollback |

## Evidence and Decisions

- Initial planning assessment: [audit.md](tasks/09-12-frontend-refactor-plan/audit.md).
  That historical assessment was static analysis only. Completed M2 evidence:
  [validation.md](tasks/archive/2026-09/09-13-http-contract-resources/validation.md).
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
- M3 scope decision: user approved automatic same-window handoff from React home
  to existing Vue rooms on 2026-09-26. New app stays opt-in; room/media migration
  remains M4/M5. Its exact dependency patches need the bounded compatible build spike.
- Implementation authorization: final summary from session
  `01a0dc8f-5005-74d1-9085-1c08b8f24c0d` was approved with `开始实现 M3`.
  Next user decision follows runnable M3 evidence and residual human review;
  no cutover or M4 continuation is authorized.
- M3 automated evidence: [validation.md](tasks/09-26-react-shell-ui-foundation/validation.md).
  A1–A7 accepted; user approved the presented batch with `提交`. Proposed work
  batches: [commit-plan.md](tasks/09-26-react-shell-ui-foundation/commit-plan.md).
  Functional work commit: `8c5a326`; docs and finish bookkeeping follow. Parent stays planning.
- Dirty-state handling: M2 work is committed; the pre-existing `dev.sh` URL
  edits remain outside its commits and must be preserved.

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
