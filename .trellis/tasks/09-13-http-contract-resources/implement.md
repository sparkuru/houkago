# M2 implementation plan — HTTP contract and resources

## Execution gate

The task is already `in_progress`. On 2026-09-26 the user explicitly requested
starting the current task after reviewing its status. Finish the existing M2
implementation and execute the quality gate below; M3 remains outside scope.
Review the concrete commit batch with the user before Phase 3.4 commits.

## Phase 1 — Freeze the contract inventory

1. Re-read the parent roadmap, design, spec and the applicable backend,
   frontend, cross-layer and reuse guides.
2. Compare the research inventory with every housou route registration and
   every browser/adaptor consumer.
3. Expand all grouped danmaku proposal/admin routes into one operation per
   method/path, including legacy aliases.
4. Assign each operation a stable operation ID, tags, security boundary,
   request schemas, success response schema and relevant error statuses.
5. Mark JSON, HTML, media, WebSocket and adaptor operations explicitly. Fail
   the later page-SDK transform if a JSON operation has no classification.

Expected evidence: a reviewed inventory table, no undocumented JSON route,
and a short list of any route whose runtime shape needs a focused test.

## Phase 2 — Prove isolated OpenAPI export

1. Run a small dependency compatibility spike for the maintained Elysia
   OpenAPI plugin against the pinned Elysia and TypeBox versions.
2. Choose exact compatible versions and update only the required package
   manifests and lockfile after implementation approval.
3. Add route metadata and explicit response/error schemas, reusing kousoku
   schemas and the existing domain error status map.
4. Add an export entry that selects a disposable database configuration before
   loading housou, constructs the app without listen, and requests the
   OpenAPI JSON endpoint.
5. Ensure export never loads production credentials, invokes upstream provider
   calls, mutates persistent runtime data or starts a listener.
6. Write the authoritative artifact deterministically and validate that every
   classified JSON operation appears exactly once.

Expected evidence: a local contract command, an authoritative OpenAPI
artifact, an isolated export test, and a route-count/classification check.

## Phase 3 — Generate the page client

1. Add the exact Hey API generator and Fetch client versions selected by the
   spike.
2. Add a checked generator configuration under the kyoushitsu API boundary,
   with a generated-file header and a stable output directory.
3. Derive the browser JSON SDK input from the authoritative document using a
   deterministic tag/classification transform. Preserve operation IDs and
   fail on unclassified JSON operations.
4. Generate the Fetch client and, if compatible without unsuitable UI
   coupling, generated TanStack Query keys/options. Otherwise implement pure
   operation-derived key builders from generated operation metadata.
5. Add runtime configuration for base URL, credentials include, injectable
   fetch, AbortSignal and normalized typed errors.
6. Assert that generated output has no housou App import, no hand-authored DTO
   duplicates and no unknown/unsafe-cast escape hatches that hide contract
   loss.
7. Leave current Eden call sites in place; do not wire a QueryClient or
   replace Vue consumers in this task.

Expected evidence: deterministic generated output and a compile-time/runtime
smoke test proving cookies, status, errors, unions and cancellation.

## Phase 4 — Add framework-independent resources and policy

1. Add transport-to-resource adapters for the five representative families:
   site config, identity, room queue, Baidu availability/grants and danmaku
   candidates.
2. Add key builders that include identity/session, room, source, normalized
   search and cursor dimensions where required, while excluding secrets.
3. Encode the policy table from design.md as named constants or descriptors:
   stale windows, enabled conditions, retry classes, focus/reconnect rules,
   abort behavior and logout purge.
4. Keep room admission, permissions, roster, current playback, live queue and
   other WS-owned fields out of Query authority.
5. Keep grant creation and polling outside general cache/replay semantics.
   Make polling explicit, bounded and AbortSignal-aware.
6. Provide an adapter for the M1 fetchRoom/fetchBangumi ports only if it does
   not move session generation or WS ordering into the transport layer.

Expected evidence: framework-free unit tests for key identity, policy
classification, logout purge, grant non-replay and WS authority.

## Phase 5 — Representative contract and drift tests

1. Use fake fetch implementations to test public site config and cookie
   identity operations.
2. Test 401, 403, 409, 422 and 5xx/non-network failures, retaining HTTP
   status, domain code, message and response metadata.
3. Test a queue mutation acknowledgement and verify that no optimistic live
   room authority is written.
4. Test Baidu availability and grant union states, including abort and
   explicit stop behavior.
5. Test danmaku candidate keys with room/source/query dimensions and
   cancellation of superseded searches.
6. Run contract export and generation twice, compare artifacts, and fail on
   non-deterministic output.

Expected evidence: focused test report and a no-diff result for the second
generation.

## Phase 6 — Repository quality gate

Run the supported commands through dx, in this order:

1. contract export and generation drift check;
2. focused housou/kyoushitsu contract and resource tests;
3. ./dx bun run typecheck;
4. ./dx bun run lint;
5. ./dx bun run test;
6. ./dx bun run --filter houkago-kyoushitsu build, or the repository's
   equivalent kyoushitsu build command;
7. git diff --check.

Inspect the final diff for generated-file ownership, accidental App imports,
credential leakage in keys, route omissions, changed response behavior,
listener/DB side effects and M1 ordering regressions. Record any command that
cannot run in the current environment and its reason.

## Expected change surface

Likely implementation files are limited to:

- housou package metadata, app/export composition, route metadata and focused
  contract tests;
- kousoku shared HTTP error or response schemas where canonical reuse is
  appropriate;
- eisha cue response metadata/tests if required to describe its JSON route;
- kyoushitsu API generator configuration, generated output, transport runtime,
  resource adapters, key/policy modules and focused tests;
- the minimum package manifests, lockfile and root command wiring needed for
  reproducible generation.

Do not modify Vue component behavior, WS protocol code, media transport,
adapter runtime semantics or database/domain logic unless a contract
annotation cannot be added without a narrowly justified compatibility fix.

## Risk controls and rollback

Highest-risk areas are housou app construction, route response annotations,
the generated-client runtime and resource policy. Work in small commits or
equivalent reviewable slices so each boundary can be checked independently.

If the OpenAPI plugin cannot faithfully describe a route, preserve the
existing Eden path, document the unsupported operation and do not cut over
consumers. If generated output loses error/union/cookie/cancellation fidelity,
remove only the generated-client slice and keep the contract inventory and
tested route annotations that remain useful. If existing checks regress, revert
the narrowest slice before considering any broader change.

## Completion mapping

- A1 and A2 are proved by phases 1 and 2.
- A3 is proved by phase 3.
- A4 and A5 are proved by phases 4 and 5.
- A6 is reviewed in phases 3 through 5 against the M1 session boundary.
- A7 is proved by phase 6.
- A8 is a scope review before task completion.
