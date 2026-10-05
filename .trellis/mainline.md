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
  committed and archived after the owner's `可以；归档`; M4–M6 were still
  unapproved at that point. On 2026-09-28, the owner requested archival of both legacy
  parent tasks. Their closure records distinguish delivered children from
  outstanding proposals. Later on 2026-09-28, the owner requested M4,
  reviewed its final planning summary, and approved implementation with
  `开始`. The owner selected direct React room migration without a Vue fallback
  or old-version compatibility requirement. M4 was validated, committed and
  archived. The owner authorized creating and planning M5 on 2026-09-28;
  The owner reviewed the M5 plan and approved implementation with
  `开始实现 M5`; M5 implementation and validation passed. The owner approved the
  Phase 3.4 work commit plan with `可以提交；`, and the implementation commit is
  `e6c9535`, followed by the M5 contract and validation commit `b8bc7e9`.
  M6 planning was authorized on 2026-09-28. The owner chose a full frontend
  migration: move React-required shared assets to `houkago-kyoushitsu-core`,
  then remove the legacy Vue workspace with no fallback/reference. M6
  implementation was approved on 2026-10-04 with `开始` after review of the
  refreshed final plan. Owner visual acceptance and all-dirty commit authorization followed. The local
  cutover passed; production deployment remains outside scope.
- historical roadmap: [Benefit priorities and delivery map](tasks/archive/2026-09/09-12-frontend-refactor-plan/roadmap.md)

## Continuation

- mode: M0–M6 complete; no active migration implementation remains
- authorization: owner `视校通过；可以提交/继续；包括所有脏文件` accepted
  presentation residuals, all trackable dirty-file commits and normal closure
- M6: [archived parity and cutover](tasks/archive/2026-10/09-28-m6-parity-cutover/validation.md)
- speed-dial: [accepted child](tasks/archive/2026-10/09-28-room-control-speed-dial/validation.md)
- delivered: framework-neutral core and 46-operation browser SDK; legacy Vue
  workspace/dependencies/commands/configs retired; configurable Docker preview
- validation: 459 root tests, 60 React browser cases, one installed adapter,
  93 shell checks and 11 preview tests passed; seven workspace types, lint,
  deterministic contracts, builds and independent review passed
- commits: original work `09b47f3`, tracked local skill preservation `e87044a`,
  M6 cutover `44edc02`; reverting only M6 was verified in an isolated repository
- scope: local delivery complete; production deployment/push not performed

## Ordered Work

### Completed task — room interface refinement (2026-10-05)

The owner requested room refinement against the shared spec, approved task
creation with `建 task`, and approved implementation with `开始实现`.
[Room interface refinement](tasks/archive/2026-10/10-05-room-interface-refinement/prd.md)
retains the reviewed design/plan and both explicit 22-entry contexts. The owner
then requested full-viewport launcher dragging, including the chat dock, and
source presentation that scales as providers grow; R7/R8 continued within the
same task without treating that feedback as visual acceptance or commit authority.

Delivered: compact four-state header, desktop/phone 16:9 waiting stage,
queue-before-source hierarchy, quieter dock, accessible settings and existing
playlist-enabled guest single-delete behavior. The launcher can now stay in
any viewport-safe position, including attendance/composer content, without
automatic content displacement; source
presentation uses one native picker and one visible flow. Link draft/preview
and Baidu connection/visited directory survive switching. Reopened browsing
refreshes that directory; permission/connection revoke resets protected state.
Sorting/clear remain host-only, and runtime/provider/WS ownership is preserved.

Final technical acceptance passed: 460 root tests; full 13-project browser
checkpoint 40 passes/3 applicability skips, then the final two-line Baidu
folder correction passed its pair with 3 passes/3 applicability skips and
55 React unit tests. Lint (279 files), seven workspace types, 18-file byte-stable
contracts, production build, 489-module boundary check and independent final
mouse/touch/200% source/menu probes passed. Evidence and iteration failures are
preserved in [validation](tasks/archive/2026-10/10-05-room-interface-refinement/validation.md)
and [check review](tasks/archive/2026-10/10-05-room-interface-refinement/check-review.md).

The subsequent screenshot clarified that attendance/composer content must also
be valid placement. R7 is now viewport/safe-area only: content obstacle logic,
its helper and five obsolete policy unit cases were retired. Valid version-1
stored positions persist; fresh users start at right-side y=0.65. Exact
2048px mouse and 375px touch landing, release/scroll/content/reload stability,
keyboard/menu/focus and fresh/moved-away real chat passed independent review.
Final repair evidence: 455 root tests, 50 React tests, 29 affected browser cases
and four final danmaku regressions, 279-file lint, seven workspace types,
production build and 489-module boundary check passed. Previous broad/provider
checkpoints above remain historical evidence for unchanged areas.

A1–A10 are accepted under the final clarified R7. After runnable evidence and
independent review, the owner accepted the final result and authorized submission
and normal task closure with `可以提交` on 2026-10-05. Work commit: `62810c5`.
The task is archived as completed in `6fc3fc6`; push and deployment remain unapproved.
All task-owned memory fixtures are stopped, and the owner's original 9998/9999
preview/configuration is preserved. M0–M6 and homepage delivery remain complete.

### Completed task — homepage copy and presentation (2026-10-05)

The owner requested five entry-copy changes, then homepage-only refinement
against eight design dimensions and further label/copy deduplication. The
[archived task](tasks/archive/2026-10/10-05-entry-copy-cleanup/prd.md) records
all rounds and approvals. Warm Club styling, original classroom SVG,
form/navigation behavior and existing configuration edits are preserved;
`entry.hint` now appears only in the figure caption, and ID/name inputs retain
their accessible names after visible labels were removed. No migration scope
was reopened.

The owner accepted the final visuals and authorized submission with
`不错；可以提交`, followed by `脏文件一起提交` for all current trackable dirty
files. Work commit: `353ff18`. Independent review and final 28/28 entry
desktop/phone regressions passed; the preceding visual checkpoint also passed
38 entry/real-cookie cases and 2 contrast cases. Final submit checks passed:
276-file lint, seven workspace types, 459/459 unit tests and production build;
generated contracts were verified byte-stable. Detailed timing and fixture
boundaries remain in [validation](tasks/archive/2026-10/10-05-entry-copy-cleanup/validation.md).

The task is archived as completed in `6d2d9ce`. Visual acceptance and authorized work are
resolved; task-owned memory fixtures are stopped and the owner's original
preview is preserved. Latest diagnostic screenshots:
`/tmp/houkago-entry-simplify-final/`. No push or production deployment was
performed; no subsequent product task is authorized by this closure.

### Completed initiative — visual craft refinement (2026-10-04)

The current thread goal authorizes implementation and iterative visual review
against Awwwards/Webby/FWA quality standards. The scoped task is
[visual craft refinement](tasks/archive/2026-10/10-04-visual-craft-refinement/prd.md), covering
entry and room presentation across the eight requested design dimensions.
Warm Club identity and all runtime/provider/permission contracts are preserved.
This is additional presentation work after completed acceptance and migration.
The owner subsequently authorized submission and normal task closure with
`可以提交` on 2026-10-04. No deployment or push is authorized.
Implementation and self-review evidence are recorded in the task
[validation](tasks/archive/2026-10/10-04-visual-craft-refinement/validation.md): 459 unit tests,
62 full-suite browser passes with 3 existing applicability skips, then 37
affected-layout regressions after the last visual fixes. Lint, seven workspace
types, build, module boundary and byte-stable contract checks passed. The task
is archived as completed. The owner accepted
visuals with `视觉通过` on 2026-10-04 and the final independent Trellis check
passed, resolving the product goal. Work commit: `b700989`; archive commit:
`180aea2`. Normal closure is complete; the owned
memory fixture is stopped. No implementation or visual acceptance remains open.

### Next initiative — real-environment acceptance (2026-10-04)

The owner approved creating a testing task using configuration A from
`/home/wkyuu/cargo/try/try.txt`, explicitly excluding Safari. The new scoped task
is [real-environment acceptance](tasks/archive/2026-10/10-04-real-environment-acceptance/prd.md),
now archived as completed; the owner approved testing with `开始测试` and
submission/normal closure with `可以继续提交；`.
It covers unmocked multi-client HTTP/WS/media, a connected Android
device and live desktop Baidu where its dedicated account prerequisites can be
met. M0–M6 remain complete; this is additional acceptance, not reopened migration
or production deployment authority. Mode remains guided.

Acceptance checkpoint: desktop and physical Android evidence is recorded in
the task [validation](tasks/archive/2026-10/10-04-real-environment-acceptance/validation.md).
The initial host-only single-delete assumption was corrected by the owner:
a playlist-enabled guest may delete host-added entries. DELETE200 is intended
backend behavior; its defect verdict is withdrawn and the corrected acceptance
test passed (403 without playlist permission, 200 after it, both clients'
authoritative queues updated). Current guest delete UI remains untested as an
available action; no frontend/product change was included. The owner completed login, authorized the
Houkago test account and approved any playable video within a scoped directory
tree. Live desktop Chromium provider delivery, decoded progression, pause/seek,
local revoke, source unavailability, grant invalidation and installed rule
cleanup passed and were independently reviewed. Fingerprint success, native
A3 input and Firefox playback are not claimed. All owned services, dedicated
browsers, remote fixtures, private profiles/configuration and credential inputs
were cleaned up. Android task tabs could not be safely identified at cleanup;
the owner-operated Firefox temporary extension is removed by browser restart.
The task is archived as completed after the owner's `可以继续提交；` approval.
Work commit: `f9ec774`; archive commit: `8b1997b`. No product repair was
performed. Frontend spec and acceptance reports now follow this owner-confirmed
permission rule, without changing the backend.

Both historical parent tasks and their completed children are archived. M3
evidence is retained at `archive/2026-09/09-26-react-shell-ui-foundation`.
M4 and M5 are archived. M6 local cutover is complete at
`.trellis/tasks/archive/2026-10/09-28-m6-parity-cutover` and archived; parity
and owner acceptance passed. The room-control speed-dial deliverable is linked beneath
M6 and keeps independent feature acceptance.

| order | task / proposed child | state | readiness and dependency evidence |
| --- | --- | --- | --- |
| Plan | `09-12-frontend-refactor-plan` | archived | Historical migration plan; stage status is tracked in the rows below |
| M0 | behavior-baseline | archived | Historical baseline recorded; browser failures are not parity evidence |
| M1 | session-player-boundaries | archived | Depends on M0; implementation and focused evidence archived at `archive/2026-09/09-12-session-player-boundaries` |
| M2 | http-contract-resources | archived | A1–A8 verified; work commits d7410cf/d76c8e5; 434 aggregate tests and static/build/drift gates pass |
| M3 | react-shell-ui-foundation | archived | A1–A7 accepted; work commits 8c5a326/ae37464; 465 tests, 56 browser cases, 124 shell checks and static/build/drift gates passed; preview stopped |
| Visual final slice | `09-28-warm-club-interaction-surface-polish` | archived | Reviewed and approved; work commits `e0ff941` / `db9c50a`, archive commit `ff019f2`; visual parent also archived |
| M4 | `09-28-m4-room-features` | archived | Direct React room/default local entry; admission, realtime queue/chat/governance; 471 tests and 28 browser cases passed; player deferred to M5 |
| M5 | `09-28-m5-media-provider-danmaku` | archived | A1–A6 fixture evidence recorded; 480 aggregate tests and 41/44 browser cases passed (3 intentional device skips); root lint/typecheck/drift and React build passed; work commits `e6c9535` and `b8bc7e9`; archived in `ca1ee0a` |
| M6 | `.trellis/tasks/archive/2026-10/09-28-m6-parity-cutover` | archived | Neutral core and browser SDK retained; React parity and owner review passed; legacy Vue retired; verified Git restoration; local cutover only |
| M6 child | `.trellis/tasks/archive/2026-10/09-28-room-control-speed-dial` | archived | A1–A6 accepted; responsive controls, preserved information and shared composer validated with M6 |

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
- M3 implementation authorization: final summary from session
  `01a0dc8f-5005-74d1-9085-1c08b8f24c0d` was approved with `开始实现 M3`.
  The owner approved residual review and commit/archive with `提交` after runnable
  evidence. At M3 close, cutover and M4 continuation had not yet been authorized.
- M3 automated evidence: [validation.md](tasks/archive/2026-09/09-26-react-shell-ui-foundation/validation.md).
  A1–A7 accepted; executed work batches:
  [commit-plan.md](tasks/archive/2026-09/09-26-react-shell-ui-foundation/commit-plan.md).
  Work commits: `8c5a326` / `ae37464`; archive commit: `670e4dd`.
  M3 is archived; the parent was subsequently closed at the owner's request.
- M4 implementation and independent review evidence:
  [validation.md](tasks/archive/2026-09/09-28-m4-room-features/validation.md).
  React is the default local frontend and room URLs render React directly.
- M5 planning artifacts: [PRD](tasks/archive/2026-09/09-28-m5-media-provider-danmaku/prd.md),
  [design](tasks/archive/2026-09/09-28-m5-media-provider-danmaku/design.md) and
  [execution plan](tasks/archive/2026-09/09-28-m5-media-provider-danmaku/implement.md).
  [validation](tasks/archive/2026-09/09-28-m5-media-provider-danmaku/validation.md) records
  final automated and browser gates. Production cutover remains a separate
  M6 decision.
- Dirty-state handling: M2/M3 work is committed. The workspace was clean when
  M5 planning began; preserve any later user-owned edits.

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
  M4 was later authorized as a separate task; M5 implementation was approved
  later on 2026-09-28. M6 planning was subsequently authorized with a full
  migration to `houkago-kyoushitsu-core` and legacy-workspace-removal scope;
  implementation and production deployment remain unapproved.
- Room-shell and queue-control children are already archived with status
  completed: `.trellis/tasks/archive/2026-08/08-30-warm-club-visual-followup`
  and `.trellis/tasks/archive/2026-08/08-30-warm-club-queue-control-consistency`.
  Their archived validation records remain historical evidence, not newly run checks.
- Remaining standalone dialog/chat polish remains outside the migration scope.
  Preserve shipped UI behavior during migration. The mobile provider companion
  remains paused; no new mobile-provider work is authorized.

## Room Layout Completion — 2026-10-03

- `10-01-room-layout-refinement` passed owner visual acceptance and is archived
  at [room-layout-refinement](tasks/archive/2026-10/10-01-room-layout-refinement/validation.md).
- Work commits: `3b0e7ed` (container browser runtime) and `4db7e82` (room UI and
  regression contracts); archive commit: `bd0a642`.
- Evidence: 485 root tests, 6 room-control and 6 media desktop/phone browser
  tests, lint, React typecheck/build and independent review passed. The dock's
  chat contents fill its remaining height; return navigation lives in `+`.
- This closes only the layout task. M6 planning/cutover, the separate speed-dial
  task and unrelated preview/policy changes keep their existing scope/status.
