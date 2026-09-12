# Approved direction: frontend architecture and stack migration

## Decision record

On 2026-09-12 the user accepted the recommended architecture and migration-benefit priorities and requested a plan plus global mainline, explicitly excluding implementation. The planning target is React + Hey API + TanStack Query + TanStack Router + Tailwind + shadcn/ui, approached by first stabilizing responsibilities. This confirms direction, not dependency installation, a delivery-date commitment or permission to start a stage.

Target structure: **thin pages + business features + independent room-session controller + HTTP Query layer + independent player driver**. Existing backend, media engines, protocol vocabulary and functional behavior remain the compatibility baseline. Framework replacement is a later integration step, not the architectural acceptance criterion.

## Migration benefit priorities

This table is the authoritative benefit ranking. It is not literal execution order: dependencies may require lower-benefit contract work before higher-benefit UI work.

| Priority | Change | Expected benefit | Cost | How to verify the benefit | Delivery stage |
| --- | --- | --- | --- | --- | --- |
| 1 | Extract room-session controller from the page | Very high: admission, reconnect, exit and event ordering gain one owner; layout changes stop touching transport orchestration | Medium-high | Fake-transport tests cover transitions without rendering the page; no page-owned socket/bootstrap lifecycle | M1, M4 |
| 2 | Standardize HTTP resources and introduce Query | High: reduce duplicated loading/error/cache/cancel behavior | Medium | Account/config/file/candidate queries use shared policy; late results and logout do not leak stale state | M2–M4 |
| 3 | Separate player driver from framework binding | High: lifecycle and sync are testable independently; UI/framework changes reuse media behavior | High | Framework-free controller tests plus actual setup/cleanup, autoplay, subtitle/fullscreen checks | M1, M5 |
| 4 | Organize queue, governance, Baidu and danmaku by feature | High: an extension changes its owning feature rather than the room integration hub | Medium | Dependency review shows commands/selectors are reused, with no second socket/player or scattered provider branches | M1, M4–M5 |
| 5 | Consolidate UI primitives using Tailwind/shadcn | Medium-high: consistent forms, dialogs, buttons and interaction states | Medium | Shared primitives preserve theme, focus, disabled/pending states, touch size and fullscreen portals | M3–M6 |
| 6 | Replace Eden with Hey API | Conditionally high: public contract enables independently generated clients and separates backend type linkage | Medium | Complete OpenAPI, deterministic generation, no backend App-type import in new client, no lost response/error fidelity | M2–M4 |
| 7 | Replace Vue Router with TanStack Router | Currently low: two routes; useful for the chosen React composition/data-loading model | Low within React migration | Existing URLs/deep links/lazy loading remain; no pre-admission protected bootstrap | M3 |
| 8 | Replace Vue with React | Ecosystem/long-term technology benefit; maintainability depends on the preceding boundaries | High overall | New UI consumes extracted controllers and features; no mechanical recreation of a giant page component | M3–M6 |

High benefit does not mean low risk. Priorities 1 and 3 contain the main lifecycle/concurrency risks. Hey API is not an urgent type-safety repair because Eden already provides compile-time linkage. Keep its contract work a prerequisite of the new HTTP client, not a prerequisite for extracting session logic.

## Ordered delivery map

The initiative planning task owns the requirements and integration acceptance.
M0 is now a created, separately reviewable child; M1–M6 remain proposed future
children and require their own authorization through the normal Trellis
workflow.

| Order | Proposed child | Scope and acceptance | Dependencies | State |
| --- | --- | --- | --- | --- |
| M0 | behavior-baseline | Inventory current behavior/spec drift; run and record existing test/browser baseline with fixtures | Fresh implementation authorization | Evidence complete in `09-12-behavior-baseline`; commit/archive pending; browser prerequisites remain blocked |
| M1 | session-player-boundaries | Extract session/queue authority, sync and player seams while retaining Vue; prove generation/disposal ordering; define feature ownership | M0 | Planned, not started |
| M2 | http-contract-resources | Inventory/export OpenAPI; prove Hey API types/errors/cookies; define Query keys, resource policy and HTTP/WS boundaries | M0; M1 ownership contracts before resource integration | Planned, not started |
| M3 | react-shell-ui-foundation | Parallel React/Vite app, Router/Query composition root, identity/home, tokens and reusable primitives | M1 and M2 | Planned, not started |
| M4 | room-features | Admission, realtime queue/chat/governance with feature commands and selectors | M3, validated M1 session controller | Planned, not started |
| M5 | media-provider-danmaku | React player binding, subtitles/fullscreen, Baidu grants/adapter and danmaku, reusing extracted logic | M4 and validated M1 player seam | Planned, not started |
| M6 | parity-cutover | Full behavior/layout regression, human residual review, rollout/rollback plan, then retire old frontend only after acceptance | M4 and M5, explicit cutover authorization | Planned, not started |

Execution order is M0 → M1 → M2 → M3 → M4 → M5 → M6. A bounded M2 contract investigation can be independently reviewed after M0, but must not bypass M1's ownership decisions. Do not first add Vue Query and then repeat the whole binding in React by default: define framework-independent HTTP policy, keep Eden functioning during extraction, and add React Query in the new application.

The earlier effort buckets in `implement.md` retain their IDs for traceability: M0=P0, M1=P2, M2=P1, M3=P3, M4=P4, M5=P5, M6=P6. M IDs govern order; P IDs are estimate labels.

## Scope and completion

Preserve room URLs, authentication, owner-only queue placement, authorized-guest playback, HTTP/WS ordering, local subtitle/preferences, source and danmaku behavior, Warm Club visual identity, desktop/portrait/cinema layouts and adapter boundaries. Do not turn this into a visual rebrand, backend rewrite, protocol/database redesign or mobile-provider feature initiative.

Complete only when spec S1–S6 passes, retained package tests still run, old/new feature parity is evidenced, contract generation is reproducible, new page components do not own transport/media lifecycles, and approved rollout has a verified old-frontend rollback. A smaller line count alone is not proof of maintainability.

Estimated full effort remains 25–39 person-days, or about 30–51 with contingency, under `implement.md` assumptions. The Vue-preserving 6–12 day scope is retained as a fallback/comparison, not a competing current mainline and not an extra prerequisite budget.

## Global continuity and history

The global pointer is [mainline.md](../../mainline.md). Requirements are in [prd.md](prd.md), technical design in [design.md](design.md), contracts in [spec.md](spec.md), and estimate/check/rollback details in [implement.md](implement.md).

The previous visual initiative record is preserved verbatim in [previous-mainline.md](previous-mainline.md) as historical evidence, not live execution instructions. Its pending room-shell commit pointer was stale: both `08-30-warm-club-visual-followup` and `08-30-warm-club-queue-control-consistency` are archived with status completed. The old visual parent remains planning; this initiative does not mark it complete or archive it. Remaining dialog/chat polish is deferred from the current mainline, and the mobile provider companion remains paused.

M0 is represented by the child task `09-12-behavior-baseline`, which the user
authorized on 2026-09-12 with `启动`. Its baseline evidence is complete and
awaits the normal commit/archive workflow. This does not authorize M1–M6,
dependency changes, product-code edits, automatic serial continuation, or
deployment.
