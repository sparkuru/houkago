# M2 implementation evidence

## Contract snapshot

The authoritative artifact is `packages/housou/openapi.json`; its page-only
projection is `packages/kyoushitsu/openapi.json`. Runtime app-route comparison
and source metadata classification run during export, before writing either
artifact. This snapshot contains 59 operations: 46 browser JSON, 8 adaptor
JSON and 5 compatibility boundaries. The current artifacts retain the legacy
danmak​​u candidate/default aliases and all admin/proposal/revision operations.
Cookie security is described by `cookieSession`; adaptor bearer security by
`adaptorBearer`. Pair redemption is anonymous and uses its pairing body, while
pairing creation is a browser-cookie operation. Sign-out accepts an optional
cookie and remains idempotent at the server session boundary.

The request and response schemas for each operation are in the authoritative
artifact. JSON errors reuse the canonical `{ error: { code, message } }` schema;
the common status list is a conservative superset of domain, validation,
authorization and upstream failures, rather than a promise that every route
produces each status. Eisha cues keep their narrower status annotation.

| Method/path | Stable operation ID | Boundary | Authentication | Input dimensions | Declared response statuses |
| --- | --- | --- | --- | --- | --- |
| GET `/health` | `health` | browser-json | anonymous | none | 200,400,401,403,404,409,422,428,500,502,503 |
| GET `/site-config` | `siteConfig` | browser-json | anonymous | none | 200,400,401,403,404,409,422,428,500,502,503 |
| GET `/eisha/proxy/{token}` | `eishaProxy` | media | anonymous | path:token | 200 |
| GET `/eisha/dash/{token}` | `eishaDash` | media | anonymous | path:token | 200 |
| GET `/eisha/danmaku/{ref}` | `eishaDanmaku` | browser-json | anonymous | path:ref | 200,400,422,500,502 |
| POST `/seitoshou/register` | `identityRegister` | browser-json | anonymous | cookie:houkago_seitoshou; JSON body | 200,400,401,403,404,409,422,428,500,502,503 |
| POST `/seitoshou/sign-in` | `identitySignIn` | browser-json | anonymous | cookie:houkago_seitoshou; JSON body | 200,400,401,403,404,409,422,428,500,502,503 |
| POST `/seitoshou/sign-out` | `identitySignOut` | browser-json | anonymous / cookieSession | cookie:houkago_seitoshou | 200,400,401,403,404,409,422,428,500,502,503 |
| GET `/seitoshou/me` | `identityMe` | browser-json | cookieSession | cookie:houkago_seitoshou | 200,400,401,403,404,409,422,428,500,502,503 |
| GET `/baidu/status` | `baiduStatus` | browser-json | cookieSession | none | 200,400,401,403,404,409,422,428,500,502,503 |
| POST `/baidu/oauth/start` | `baiduOAuthStart` | browser-json | cookieSession | JSON body | 200,400,401,403,404,409,422,428,500,502,503 |
| GET `/baidu/oauth/callback` | `baiduOAuthCallback` | html-callback | anonymous | query:code; query:state | 200,400,401,403,404,409,422,428,500,502,503 |
| DELETE `/baidu/connection` | `baiduConnectionDelete` | browser-json | cookieSession | none | 200,400,401,403,404,409,422,428,500,502,503 |
| POST `/baidu/adaptor/pairing` | `baiduAdaptorPairing` | browser-json | cookieSession | JSON body | 200,400,401,403,404,409,422,428,500,502,503 |
| POST `/baidu/adaptor/pair` | `baiduAdaptorPair` | adaptor-json | anonymous | JSON body | 200,400,401,403,404,409,422,428,500,502,503 |
| POST `/baidu/adaptor/heartbeat` | `baiduAdaptorHeartbeat` | adaptor-json | adaptorBearer | none | 200,400,401,403,404,409,422,428,500,502,503 |
| DELETE `/baidu/adaptor/session` | `baiduAdaptorSessionDelete` | adaptor-json | adaptorBearer | none | 200,400,401,403,404,409,422,428,500,502,503 |
| POST `/baidu/adaptor/oauth/handoff` | `baiduAdaptorOAuthHandoff` | adaptor-json | adaptorBearer | none | 200,400,401,403,404,409,422,428,500,502,503 |
| POST `/baidu/adaptor/oauth/refresh` | `baiduAdaptorOAuthRefresh` | adaptor-json | adaptorBearer | JSON body | 200,400,401,403,404,409,422,428,500,502,503 |
| GET `/baidu/adaptor/dlink-requests` | `baiduAdaptorDlinkRequests` | adaptor-json | adaptorBearer | none | 200,400,401,403,404,409,422,428,500,502,503 |
| POST `/baidu/adaptor/dlink-responses` | `baiduAdaptorDlinkResponse` | adaptor-json | adaptorBearer | JSON body | 200,400,401,403,404,409,422,428,500,502,503 |
| GET `/baidu/adaptor/grants/{grantId}` | `baiduAdaptorGrantClaim` | adaptor-json | adaptorBearer | path:grantId | 200,400,401,403,404,409,422,428,500,502,503 |
| POST `/baidu/files/list` | `baiduFilesList` | browser-json | cookieSession | JSON body | 200,400,401,403,404,409,422,428,500,502,503 |
| POST `/baidu/sources` | `baiduSourceCreate` | browser-json | cookieSession | JSON body | 200,400,401,403,404,409,422,428,500,502,503 |
| GET `/baidu/sources/{sourceId}/availability` | `baiduSourceAvailability` | browser-json | cookieSession | path:sourceId; query:bushitsuId | 200,400,401,403,404,409,422,428,500,502,503 |
| POST `/baidu/sources/{sourceId}/grants` | `baiduPlaybackGrantCreate` | browser-json | cookieSession | path:sourceId; JSON body | 200,400,401,403,404,409,422,428,500,502,503 |
| GET `/baidu/grants/{requestId}` | `baiduPlaybackGrantPoll` | browser-json | cookieSession | path:requestId | 200,400,401,403,404,409,422,428,500,502,503 |
| GET `/baidu/media/{grantId}` | `baiduMedia` | media | anonymous | path:grantId | 400,401,403,404,409,422,428,500,502,503 |
| POST `/bushitsu` | `roomCreate` | browser-json | cookieSession | JSON body | 200,400,401,403,404,409,422,428,500,502,503 |
| GET `/bushitsu/{id}` | `roomGet` | browser-json | anonymous | path:id | 200,400,401,403,404,409,422,428,500,502,503 |
| GET `/bushitsu/{id}/bangumi` | `roomBangumiGet` | browser-json | anonymous | path:id | 200,400,401,403,404,409,422,428,500,502,503 |
| POST `/bushitsu/{id}/enmoku/preview` | `roomEnmokuPreview` | browser-json | cookieSession | path:id; JSON body | 200,400,401,403,404,409,422,428,500,502,503 |
| POST `/bushitsu/{id}/enmoku` | `roomEnmokuCreate` | browser-json | cookieSession | path:id; JSON body | 200,400,401,403,404,409,422,428,500,502,503 |
| DELETE `/bushitsu/{id}/enmoku/{enmokuId}` | `roomEnmokuDelete` | browser-json | cookieSession | path:id; path:enmokuId | 200,400,401,403,404,409,422,428,500,502,503 |
| POST `/bushitsu/{id}/bangumi/{enmokuId}/move` | `roomBangumiMove` | browser-json | cookieSession | path:id; path:enmokuId; JSON body | 200,400,401,403,404,409,422,428,500,502,503 |
| DELETE `/bushitsu/{id}/bangumi/pending` | `roomBangumiPendingClear` | browser-json | cookieSession | path:id | 200,400,401,403,404,409,422,428,500,502,503 |
| DELETE `/bushitsu/{id}/meibo/{seitoId}` | `roomMemberDelete` | browser-json | cookieSession | path:id; path:seitoId | 200,400,401,403,404,409,422,428,500,502,503 |
| GET `/danmaku/episodes` | `danmakuEpisodeSearch` | browser-json | cookieSession | query:q | 200,400,401,403,404,409,422,428,500,502,503 |
| POST `/danmaku/episodes` | `danmakuEpisodeCreate` | browser-json | cookieSession | JSON body | 200,400,401,403,404,409,422,428,500,502,503 |
| POST `/danmaku/matches` | `danmakuMatchCreate` | browser-json | cookieSession | JSON body | 200,400,401,403,404,409,422,428,500,502,503 |
| POST `/danmaku/alignments` | `danmakuAlignmentCreate` | browser-json | cookieSession | JSON body | 200,400,401,403,404,409,422,428,500,502,503 |
| GET `/danmaku/policy` | `danmakuPolicyGet` | browser-json | cookieSession | none | 200,400,401,403,404,409,422,428,500,502,503 |
| POST `/danmaku/policy` | `danmakuPolicyUpdate` | browser-json | cookieSession | JSON body | 200,400,401,403,404,409,422,428,500,502,503 |
| GET `/danmaku/bushitsu/{bushitsuId}/enmoku/{enmokuId}` | `danmakuCandidatesResolve` | browser-json | cookieSession | path:bushitsuId; path:enmokuId; query:releaseId; query:duration; query:fingerprint; query:fingerprintBytes | 200,400,401,403,404,409,422,428,500,502,503 |
| GET `/danmaku/candidates/{bushitsuId}/{enmokuId}` | `danmakuCandidatesResolveLegacy` | browser-json | cookieSession | path:bushitsuId; path:enmokuId; query:releaseId; query:duration; query:fingerprint; query:fingerprintBytes | 200,400,401,403,404,409,422,428,500,502,503 |
| POST `/danmaku/bushitsu/{bushitsuId}/enmoku/{enmokuId}/default` | `danmakuEnmokuDefaultCreate` | browser-json | cookieSession | path:bushitsuId; path:enmokuId; JSON body | 200,400,401,403,404,409,422,428,500,502,503 |
| PUT `/danmaku/bushitsu/{bushitsuId}/enmoku/{enmokuId}/default` | `danmakuEnmokuDefaultUpdate` | browser-json | cookieSession | path:bushitsuId; path:enmokuId; JSON body | 200,400,401,403,404,409,422,428,500,502,503 |
| DELETE `/danmaku/bushitsu/{bushitsuId}/enmoku/{enmokuId}/default` | `danmakuEnmokuDefaultDelete` | browser-json | cookieSession | path:bushitsuId; path:enmokuId | 200,400,401,403,404,409,422,428,500,502,503 |
| POST `/danmaku/defaults/{bushitsuId}/{enmokuId}` | `danmakuDefaultCreate` | browser-json | cookieSession | path:bushitsuId; path:enmokuId; JSON body | 200,400,401,403,404,409,422,428,500,502,503 |
| PUT `/danmaku/defaults/{bushitsuId}/{enmokuId}` | `danmakuDefaultUpdate` | browser-json | cookieSession | path:bushitsuId; path:enmokuId; JSON body | 200,400,401,403,404,409,422,428,500,502,503 |
| DELETE `/danmaku/defaults/{bushitsuId}/{enmokuId}` | `danmakuDefaultDelete` | browser-json | cookieSession | path:bushitsuId; path:enmokuId | 200,400,401,403,404,409,422,428,500,502,503 |
| GET `/danmaku/bushitsu/{bushitsuId}/defaults` | `danmakuRoomDefaultsGet` | browser-json | cookieSession | path:bushitsuId | 200,400,401,403,404,409,422,428,500,502,503 |
| POST `/danmaku/proposals` | `danmakuProposalCreate` | browser-json | cookieSession | JSON body | 200,400,401,403,404,409,422,428,500,502,503 |
| GET `/danmaku/proposals` | `danmakuProposalList` | browser-json | cookieSession | query:status | 200,400,401,403,404,409,422,428,500,502,503 |
| POST `/danmaku/proposals/{proposalId}/decision` | `danmakuProposalDecision` | browser-json | cookieSession | path:proposalId; JSON body | 200,400,401,403,404,409,422,428,500,502,503 |
| POST `/danmaku/tracks/{trackId}/revisions/{revisionId}/disable` | `danmakuRevisionDisable` | browser-json | cookieSession | path:trackId; path:revisionId; JSON body | 200,400,401,403,404,409,422,428,500,502,503 |
| POST `/danmaku/tracks/{trackId}/revisions/{revisionId}/rollback` | `danmakuRevisionRollback` | browser-json | cookieSession | path:trackId; path:revisionId; JSON body | 200,400,401,403,404,409,422,428,500,502,503 |
| POST `/danmaku/revisions/{revisionId}/pin` | `danmakuRevisionPin` | browser-json | cookieSession | path:revisionId; JSON body | 200,400,401,403,404,409,422,428,500,502,503 |
| GET `/ws` | `roomWebSocket` | websocket | cookieSession | query:bushitsuId | 101 |

## Tested dependency and generator choices

- Existing Elysia is 1.4.28 and canonical TypeBox is 0.34.49.
- `@elysiajs/openapi` is pinned to 1.4.16; `@hey-api/openapi-ts` to 0.99.0.
- The 0.99.0 generator embeds the Fetch client plugin/runtime and emits local
  `generated/client/` and `generated/core/` imports. The unused separately
  installed `@hey-api/client-fetch` runtime package was removed.
- TanStack Query is deliberately not installed in M2. Pure key roots are
  generated operation IDs, checked through `keyof typeof sdk.gen`, with
  additional session/room/source/search/cursor/generation dimensions.
- TypeBox catch-all `patternProperties: { "^(.*)$": schema }` records without
  named properties are exported as equivalent `additionalProperties: schema`.
  This prevents Hey API widening headers/subtitles to `unknown`; constrained
  patterns and required/property constraints are retained. Generated HTTP DTOs
  are checked for `unknown`/`any`, while generic generated transport internals
  retain their upstream-owned implementation types.

## Runtime and compatibility proof

The existing Vue/Eden call sites and M1 room/WS controller remain intact.
HTTP room/queue responses seed guarded bootstrap only; no resource adapter
writes live room authority. Room command acknowledgement produces optional
bootstrap recovery keys, not a live optimistic snapshot.

Export forces an in-memory DB and test environment before app imports, clears
production provider/credential/admin configuration, never invokes provider
handlers, and never listens. Export commands disable automatic .env loading.
The isolation test protects a production-path sentinel, fails on any upstream
fetch or Bun listener, and checks that no accounts were bootstrapped.

OpenAPI postprocessing describes WS as GET/101 with `x-transport: websocket`,
OAuth callback as text/html, proxy bytes as application/octet-stream, and DASH
as application/dash+xml. Baidu media has error responses only because housou
always emits its adaptor-required sentinel. These are contract-only changes;
media/HTML/WS handlers retain their behavior and are excluded from the page SDK.

The configured generated client includes cookie credentials, injectable fetch,
base URL and AbortSignal. Errors retain status/code/message/response/request
metadata; invalid JSON and empty success objects are protocol failures.
Aborted/protocol failures do not retry. Reads allow one transient retry; identity
and room commands never replay. Identity restoration is enabled before a known
session, so it can restore the cookie on application startup.

`prepareBaiduGrant` creates once and polls only while pending, with default ten
polls separated by one second, capped by server expiry and the caller's signal.
Ready/failed stops the workflow; cancellation, expiry, exhausted polls and
transport/domain failures never replay creation. Superseded candidate searches
abort their prior request and reject late completion even if a fetch ignores
cancellation. Logout cancels private work before removing private cache keys;
public site configuration remains.

## Validation

Implementation checks on 2026-09-26, run through the repository wrapper:

- `./dx bun run contract:generate`: passes; 59 authoritative operations,
  46 browser JSON operations. Export compares the actual runtime route set.
- `./dx bun run contract:drift`: passes; 18 artifact/generated files unchanged
  against the checked baseline and between consecutive generation runs.
- `./dx bun test packages/housou/test/http-contract.test.ts packages/kyoushitsu/test/http-contract.test.ts packages/kyoushitsu/test/http-contract-types.test.ts packages/kyoushitsu/test/resources.test.ts`:
  42 passed, zero failures, 213 assertions.
- `./dx bun run typecheck`: all six packages pass. Kyoushitsu now also checks
  `test/http-contract-types.test.ts` through `tsconfig.contract.json`; the
  standalone equivalent is `./dx bunx tsc --noEmit -p packages/kyoushitsu/tsconfig.contract.json`.
- `./dx bun run lint`: passes; 265 files checked. Targeted Biome formatting
  was applied only to M2 implementation files.
- `git diff --check`: passes.

Earlier focused checks found and resolved security-array inference, export
classification parameter typing, protocol-validator return typing and an
incorrect type-test fixture field. A failed isolation assertion also proved
that the plugin initially labeled HTML as text/plain; export postprocessing
now declares text/html and the isolation test passes.

The later independent review and full existing repository compatibility gate
are recorded in `check-evidence.md` and `../validation.md`. It also declares
Eisha's existing central HTTP 500 and rejects null/primitive success JSON.
The counts above retain the implementation-stage check history. No browser/UI migration was performed.
Pre-existing dev.sh URL edits were preserved and excluded from M2 ownership.
