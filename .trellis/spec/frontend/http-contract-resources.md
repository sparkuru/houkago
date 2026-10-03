# HTTP Contract and Resources

## 1. Scope / Trigger

Use this contract when adding a Housou HTTP operation, generating the browser
SDK, or consuming framework-independent HTTP resources. The React frontend
consumes explicit core package subpaths for room and identity operations;
the old framework-specific consumer was retired by M6.
QueryClient/identity ownership is specified in
[react-entry-runtime.md](react-entry-runtime.md).

The source of truth is runtime route registration plus canonical TypeBox schemas
in `houkago-kousoku`. `packages/housou/openapi.json` records the full surface;
`packages/kyoushitsu-core/openapi.json` is the browser JSON subset. Generated files
under `packages/kyoushitsu-core/src/api/generated/` are generator-owned.

## 2. Signatures

Run commands serially through the repository wrapper:

```sh
./dx bun run contract:generate
./dx bun run contract:drift
./dx bun run typecheck
./dx bun run lint
./dx bun run test
./dx bun run --filter houkago-kyoushitsu-core typecheck
./dx bun run --filter houkago-kyoushitsu-react build
```

`contract:generate` exports the authoritative contract, derives the page input,
verifies it, and runs the pinned Hey API generator. `contract:drift` must reject
stale checked artifacts as well as non-deterministic generation.
Current pins are `@elysiajs/openapi@1.4.16` and
`@hey-api/openapi-ts@0.99.0`. The latter embeds the Fetch generator/runtime;
generated transport imports are local, so no separate client-fetch runtime
dependency is required. Revisit pins only with export and fidelity evidence.

The handwritten boundary exposes:

```ts
configureHousouHttpClient(config?: { baseUrl?: string; fetch?: typeof fetch }): void
fetchIdentityMe(options?: { signal?: AbortSignal }): Promise<IdentityMeResponse>
fetchSiteConfig(options?: { signal?: AbortSignal }): Promise<SiteConfigResponse>
createRoom(body: RoomCreateData["body"], options?: { signal?: AbortSignal }): Promise<RoomCreateResponse>
fetchRoom(roomId: string, options?: HttpRequestOptions): Promise<RoomGetResponse>
fetchRoomBangumi(roomId: string, options?: HttpRequestOptions): Promise<RoomBangumiGetResponse>
previewRoomEnmoku(roomId: string, sourceUrl: string, title?: string, options?: HttpRequestOptions): Promise<RoomEnmokuPreviewResponse>
createRoomEnmoku(roomId: string, sourceUrl: string, title?: string, options?: HttpRequestOptions): Promise<RoomEnmokuCreateResponse>
deleteRoomEnmoku(roomId: string, enmokuId: string, options?: HttpRequestOptions): Promise<RoomEnmokuDeleteResponse>
clearPendingRoomBangumi(roomId: string, options?: HttpRequestOptions): Promise<RoomBangumiPendingClearResponse>
deleteRoomMember(roomId: string, seitoId: string, options?: HttpRequestOptions): Promise<RoomMemberDeleteResponse>
moveRoomBangumi(roomId: string, enmokuId: string, direction: "up" | "down", options?: HttpRequestOptions): Promise<RoomBangumiMoveResponse>
roomBootstrapKey(sessionScope: string, roomId: string): ResourceKey
bangumiBootstrapKey(sessionScope: string, roomId: string, bootstrapGeneration: string): ResourceKey
purgePrivateResources(cache: PrivateResourceCache): Promise<void>
prepareBaiduGrant(sourceId: string, roomId: string, options: BaiduGrantPreparationOptions): Promise<BaiduPlaybackGrantPollResponse>
```

Response DTOs come from the generated SDK; resource adapters may compose them,
but must not redefine wire DTOs or import Housou's server `App` type.
`ResourceKey` begins with `keyof typeof import("../generated/sdk.gen")` followed
by string dimensions, tying key roots to generated operation IDs.

The shared `houkago-kyoushitsu-core` package exposes only explicit portable subpaths: `http` points to
the handwritten `api/public.ts` barrel, `http/generated` to the existing
generated tree, and `site-config` to the pure loader. `i18n`, `room-id`, `theme`,
`theme.css`, `room-session`, `ws-client`, `kengen` and `bangumi-actions` are
additional portable assets. Never import the package root/Eden
barrel from React, copy generated code or resolve a legacy `@` alias through the
new app. The HTTP URL helper uses its relative source path.

## 3. Contracts

- Every operation has a stable unique `operationId` and explicit classification:
  `browser-json`, `adaptor-json`, `media`, `html-callback`, or `websocket`.
  Legacy aliases remain separate operations. Unknown classifications fail.
- Preserve record value types when exporting canonical TypeBox dictionaries.
  The exporter normalizes the supported catch-all `patternProperties` form to
  an `additionalProperties` schema for generation; do not flatten constrained
  record patterns. Generated wire DTOs must not widen values to `unknown`/`any`.
- Browser JSON enters the page SDK. Adaptor bearer operations, streaming/media,
  HTML callbacks and WebSocket operations stay outside that SDK. Security
  metadata describes cookie-session and bearer boundaries separately.
- Export sets `NODE_ENV=test`, `HOUSOU_DB=:memory:` and `HOUKAGO_OPENAPI=1`
  before importing the server. It must not load production state, call providers,
  listen on a port, or write runtime databases. Only contract artifacts are output.
  Export-related Bun commands use `--no-env-file`; production provider,
  credential and admin environment keys are cleared before server import.
- Runtime requests use the configured Housou origin, `credentials: include`,
  injectable fetch and the caller's `AbortSignal`. React consumes the core generated
  resource boundary; M6 retired the former framework-specific consumer.
- Private keys contain a non-secret identity/session scope and all relevant
  room/source/search/path/cursor dimensions. Logout cancels private requests and
  purges private keys; public site configuration survives. Policy is a framework
  independent contract, not an installed Query cache.
  `PrivateResourceCache.cancel(matches)` returns a promise;
  `remove(matches)` runs even if cancellation rejects. A future Query binding
  implements this port and guards account-switch writes independently.
- Admission, permissions, roster, current item and live queue are owned by
  room-session/WS. HTTP room/Bangumi reads are guarded bootstrap/recovery only.
  Queue mutations acknowledge commands; they do not overwrite live state.
  The React room runtime waits for server `NYUUSHITSU entered` before these
  protected reads, uses the generated SDK wrappers for commands, and retains
  `HoukagoHttpError` details for visible failures. A failed or uncertain
  command is not replayed automatically.
- Grant acquisition is an explicit creation plus bounded polling workflow.
  Never cache or replay creation, persist grant URLs, or poll after cancellation,
  expiry or terminal completion.
  `BaiduGrantPreparationOptions` requires `signal`; `maxPolls` defaults to 10
  and `pollIntervalMs` to 1,000. Invalid limits fail before creation. One creation
  is followed by at most the selected poll count, with expiry checked before
  each poll. A pending result at expiry/limit rejects as `protocol`; `ready` or
  `failed` ends the workflow. Logout/source change disposes its signal.

## 4. Validation & Error Matrix

The backend retains `{ error: { code, message } }`. `HoukagoHttpError` retains
kind, message, HTTP status, domain code and request/response metadata.

| Condition | Resource behavior |
| --- | --- |
| HTTP 401/403/409/422 or another 4xx | Reject with retained status/code; no automatic retry |
| Transient network or HTTP 5xx read failure | At most one retry when its resource policy allows |
| Abort | Reject as `aborted`; no retry |
| Missing success body / invalid transport protocol | Reject; no successful empty fallback or retry |
| Non-idempotent command/grant creation failure | Reject without automatic replay |
| Unclassified/missing route or stale generated artifact | Fail export/verification/drift check |

Set stale windows, enabled conditions, abort, focus/reconnect and purge behavior
explicitly through `RESOURCE_POLICIES`; do not inherit Query defaults or poll
WS-owned fields.
Current page success DTOs are JSON objects or arrays. Reject malformed JSON,
`null`, primitive JSON, empty objects, HTTP 204 and zero-length success bodies
as protocol errors; empty arrays remain valid. This guard does not replace each
operation's canonical backend schema or imply full runtime DTO decoding.
Only `fetchSiteConfig` distinguishes a true zero-byte/204 success with protocol
code `EMPTY_RESPONSE`. It captures configured fetch and supplies a per-call
response-clone check; the original response still reaches the generated parser.
Literal `{}`, JSON null/primitive and malformed JSON remain ordinary protocol
errors. `normalizeHttpError` preserves an existing typed kind/code/status and
metadata, filling absent Request/Response metadata from the SDK result. Abort
takes precedence over empty-response classification. The pure config loader may
default on `EMPTY_RESPONSE`, HTTP or network failure; no generated parser/global
interceptor or generic protocol fallback is changed.
Identity restoration and sign-in/register/sign-out commands are enabled before a
known session (`enabledWhen: "always"`); gating restoration on identity would
prevent discovering a valid cookie session. Private provider resources require
their session/panel/workflow context.

## 5. Good / Base / Bad Cases

- Good: switch identity while room bootstrap is pending; abort the request,
  purge its private scope, and let the M1 controller reject old generations.
- Base: site configuration reads once with cookie credentials and keeps public
  policy; identity restoration reports an expired session as HTTP 401.
- Bad: return `{ data, error }` as successful query data, reuse another session's
  bootstrap key, retry an aborted command, or cache live queue as HTTP authority.

## 6. Tests Required

- Fake-fetch tests cover site configuration, identity, room queue acknowledgement,
  Baidu availability/grant unions and danmaku candidate cancellation. Assert
  origin, cookies, `AbortSignal`, status/domain code and response metadata.
  Include malformed/null/primitive/empty success and 204/zero-length responses;
  they must reject with protocol kind and retained response metadata.
  Site-config tests additionally distinguish actual empty success from literal
  empty-object/null/malformed JSON, preserve typed `EMPTY_RESPONSE` and abort
  metadata, and prove one response body is consumed without global fetch changes.
  M4 wrapper tests also cover room/queue reads, preview/create/delete, pending
  clear, member delete and move with path/body, credentials, abort and errors.
- Resource tests distinguish identity/room/source/search/cursor keys, purge
  private scope, disable auth/abort/protocol retries, and retain WS authority.
- Grant tests prove one creation, bounded polling, terminal stop and cancellation.
- Export tests compare registered operations to the contract and prove disposable
  DB/no listener/no provider calls. Verification includes every legacy alias.
- Drift tests reject stale artifacts, then prove two generations are identical;
  generated files carry their header and do not import server `App`.
- Core `typecheck` also runs `tsc --noEmit -p tsconfig.contract.json`
  for generated record values and grant union discriminants. Bun runtime tests
  alone do not prove compile-time DTO fidelity.
- Keep aggregate package tests and M1 generation/queue ordering regressions.

## 7. Wrong vs Correct

Wrong: treat the SDK result as successful resource data:

```ts
return identityMe({ signal })
```

Correct: use the adapter that rejects transport/domain failures:

```ts
return fetchIdentityMe({ signal })
```

Wrong: manually edit generated DTOs or derive live playback from cached queue.
Correct: update canonical schemas and route metadata, regenerate the SDK, and
read live playback/queue through room-session selectors.
