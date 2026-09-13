# Frontend architecture assessment and refactor planning

## Goal

Assess the current implementation and the difficulty/value of adopting Hey API, TanStack Query, TanStack Router, Tailwind CSS and shadcn/ui. Deliver evidence-backed planning and proposed contracts for extensibility and maintenance.

## Authorization

The user authorized task creation on 2026-09-12, then accepted the recommended direction and benefit priorities for a plan and global mainline. The planned target is the requested React stack with boundary-first migration. Keep the parent status `planning`: direction approval is not broad implementation approval. The parent itself does not authorize product code, dependency, runtime configuration, database change, or implementation dispatch; the separately authorized M1 child still requires its own artifact-review/start gate.

The user subsequently approved starting the bounded M0 behavior-baseline child
with `启动` on 2026-09-12. M0 is complete and archived. The user has now
authorized the bounded M1 session/player child; its planning artifacts,
implementation, and validation are complete and archived. M2–M6, unrelated dependency changes,
serial continuation and cutover remain unapproved.

## Background

- Current web stack is Vue 3 / Pinia / Vue Router / Vite with Eden: `packages/kyoushitsu/package.json:12`, `packages/kyoushitsu/src/api/index.ts:1`.
- Two routes exist: `packages/kyoushitsu/src/router.ts:4`.
- Room orchestration combines REST bootstrap, WebSocket admission, synchronization and presentation: `packages/kyoushitsu/src/views/BushitsuView.vue:575`.
- Shared protocol contracts, backend domain modules, pure frontend helpers and unit/browser tests are reusable assets. Detailed findings live in `audit.md`.

## Requirements and acceptance

| ID | Required output | Observable acceptance |
| --- | --- | --- |
| R1 | Implementation assessment | `audit.md` cites source evidence and distinguishes confirmed structure from unverified risks |
| R2 | Stack evaluation | `design.md` assesses each library and compares a smaller Vue-preserving alternative |
| R3 | Proposed contracts | `spec.md` defines HTTP, realtime, player and UI ownership without weakening existing behavior |
| R4 | Migration estimate and plan | `implement.md` includes effort assumptions, ordered gates, compatibility checks and rollback |
| R5 | Planning-only delivery | Git diff contains project mainline/policy and task documents/metadata only; status remains planning |
| R6 | Approved global direction and benefit ranking | `roadmap.md` records all eight benefit priorities, stage dependencies and acceptance; `.trellis/mainline.md` points to it with no implementation/serial authorization |

## Scope and constraints

Inspect Kyoushitsu and its integration with Housou REST/WS, Kousoku contracts, Kokuban parsing, Eisha media handling and the browser adapter. Use existing tests, root design and Trellis specs as evidence. Backend internals are sampled at integration boundaries, not exhaustively audited.

Estimate a compatibility-first migration preserving existing features, room URLs, authentication, shared playback, provider behavior, theme identity and supported layouts. These are estimation assumptions, not final product decisions. Plans must preserve authorized-guest control, admission ordering, newer WS snapshots, autoplay and fullscreen behavior.

## Out of scope

Implementation, dependency installation, UI redesign, new features, database/protocol redesign, backend rewrite, deployment and commits. Static assessment does not establish runtime correctness; no test-pass claim is permitted without execution.

No question blocks this planning delivery. The user accepted the recommended direction; `roadmap.md` is the authoritative benefit ranking and ordered delivery map. Before implementation, obtain explicit stage authorization and refine runtime/version/deployment unknowns through the listed gates. Effort figures remain estimates, not a delivery commitment.
