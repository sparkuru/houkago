# M2 — HTTP contract and resources

## Goal

Create a complete, reproducible HTTP contract for the browser-facing system
and a generated, framework-independent client/resource boundary that preserves
current response, error, cookie and cancellation semantics. Establish the
resource and Query policy that later frontend migration work can consume
without making HTTP the authority for live room state.

## User value

Later frontend work can migrate one feature at a time against a checked,
typed contract. Backend route changes become visible through contract drift
checks, and resource ownership is explicit before a cache or generated client
is introduced into the UI.

## Requirements

### R1. Complete route inventory and source contract

- Inventory every JSON HTTP operation in housou, including operations not
  currently called by kyoushitsu, legacy aliases, admin operations and the
  separate adaptor bearer-token contract.
- Reuse canonical kousoku schemas wherever a request or response type already
  exists.
- Add explicit success response schemas, request/body/query/cookie schemas,
  tags and stable operation IDs wherever the current routes lack them.
- Declare the existing uniform error shape
  { error: { code, message } } and its meaningful status classes without
  changing runtime error behavior.
- Account for WebSocket, HTML callback and media/sentinel routes as
  compatibility boundaries, while keeping them out of the JSON page SDK.

### R2. Isolated and deterministic OpenAPI export

- Provide a local export command and committed or otherwise reproducible
  contract artifact.
- Export without a production database, credentials, upstream provider calls,
  normal initialization side effects or a listening server. A disposable
  in-memory setup is allowed only for route construction.
- Make repeated generation stable and make missing/new JSON routes detectable
  by drift checks.
- Keep the page SDK input distinct from adaptor bearer-token, media, HTML and
  WebSocket boundaries while retaining those boundaries in the authoritative
  inventory.

### R3. Generated client and runtime boundary

- Generate a Hey API Fetch client from the checked contract; generated files
  must not import housou's server App type and must not be hand-edited.
- Preserve include-credentials cookie behavior, base URL configuration,
  AbortSignal propagation, typed success unions and typed non-success/domain
  errors.
- Generate or define deterministic operation-derived Query keys without
  duplicating DTO definitions. The policy layer must be usable without
  coupling the current Vue app to a new runtime in M2.
- Keep existing Eden call sites working until a later migration task replaces
  them.

### R4. Resource ownership and lifecycle policy

- Define framework-independent resource descriptors/adapters for the
  representative site-config, identity, room/queue, Baidu and danmaku
  families.
- Include identity/session/room/source/search/cursor dimensions in keys where
  they affect data identity; never put secrets in keys.
- Define explicit stale, retry, focus/reconnect, enabled, abort, invalidation
  and logout-purge behavior for public resources, private resources and
  commands.
- Keep room admission, permissions, roster, current playback, live queue and
  other WS-owned live state authoritative in the room session/WS boundary.
- Keep grant creation/polling as an explicit non-idempotent workflow: no
  optimistic authority, automatic replay or general Query caching.

### R5. Evidence and compatibility

- Prove the five representative families with fake-fetch tests covering
  credentials, status and domain errors, response unions, aborts and
  mutation acknowledgement.
- Prove deterministic generation by running it twice and checking for no
  output drift.
- Preserve existing M0/M1 behavior and the current Vue/Eden/WS boundary.

## Acceptance Criteria

- [x] A1. The route inventory is complete, including legacy aliases and the
  separate adaptor, media, HTML and WebSocket boundaries; every JSON route is
  represented by the authoritative contract.
- [x] A2. The OpenAPI export is reproducible, locally runnable and isolated
  from production DB state, credentials, upstream calls and listeners.
- [x] A3. The generated page client is deterministic, has no housou App
  import, preserves cookies/AbortSignal and exposes typed success and error
  results without unknown/unsafe-cast escape hatches.
- [x] A4. The five representative contract tests preserve HTTP status,
  domain error code, response unions, cookie credentials, cancellation and
  command acknowledgement.
- [x] A5. Resource keys and lifecycle policy are explicit for identity,
  site-config, room bootstrap, provider/Baidu, search/candidate and grant
  workflows; logout purges private state.
- [x] A6. WS-owned live room fields are not duplicated as Query authority, and
  media/adaptor boundaries remain separate.
- [x] A7. Existing typecheck, lint, tests and kyoushitsu build remain green;
  no current UI behavior or M1 session ordering regresses.
- [x] A8. The change does not introduce the React workspace, migrate Vue
  call sites wholesale, redesign UI, alter domain behavior, or perform the
  broader M3 frontend cutover.

## Scope

In scope: backend contract annotations and export mode, shared HTTP error
contract declarations, complete route inventory, deterministic Hey API client
generation, framework-independent resource/key/policy modules, representative
tests, generation drift checks and documentation of non-JSON boundaries.

Out of scope: React/TanStack Router/Tailwind/shadcn setup, Vue component
migration, QueryClient wiring into the existing app, WebSocket protocol
redesign, backend business logic changes, media transport changes, adaptor
protocol changes, database migrations and visual redesign.

## Constraints and risks

- Exact OpenAPI/Hey API package versions must be selected by a small
  compatibility spike and pinned; no unrelated dependency upgrades are
  justified.
- Current housou module loading applies database schema at import time. The
  export entry must make this disposable and non-production.
- The route set has legacy aliases and several union-shaped Baidu workflows;
  flattening them would lose compatibility.
- If OpenAPI inference or generated output cannot preserve errors, cookies,
  unions and cancellation without unsafe casts, stop the migration at the
  contract evidence and retain Eden for consumers.

## Decisions resolved by the parent plan

There are no open product-scope questions for this bounded M2. The accepted
frontend migration plan fixes the boundary-first order, the M2 dependency on
M0/M1, the WS authority rules, the resource policy requirements and the
deferred M3 consumer cutover. Exact library versions and file placement remain
implementation details governed by repository evidence and the quality gate.
