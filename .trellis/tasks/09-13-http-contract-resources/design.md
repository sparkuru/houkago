# M2 technical design — HTTP contract and resources

## 1. Architecture and ownership

M2 adds a contract layer beside the current Eden client. Eden remains the
working compatibility path for the existing Vue app. The new path is:

1. housou route schemas and operation metadata;
2. an isolated OpenAPI export entry and authoritative JSON artifact;
3. a deterministic page-SDK input derived from the authoritative artifact;
4. a generated Hey API Fetch client;
5. framework-independent resource adapters, key builders and lifecycle policy.

The generated client owns transport typing. Resource adapters own domain
names, cache identity and lifecycle policy. Vue components, Pinia stores and
TanStack Query runtime wiring are later consumers, not M2 owners.

The server App type is intentionally not a frontend dependency of the
generated client. The existing Eden export remains available until M3 has
completed a feature-by-feature cutover.

## 2. Contract document boundaries

The authoritative OpenAPI document covers all JSON HTTP operations:

- public health and site configuration;
- identity and cookie-session operations;
- room, queue and membership operations;
- Baidu user/provider resources and grant workflows;
- danmaku catalog, resolution, defaults and proposal/admin operations;
- Eisha danmaku cue data;
- adaptor bearer-token operations, tagged separately from browser identity.

The document also records the compatibility surface for HTML callback,
WebSocket and media routes when OpenAPI can represent their content type
faithfully. Those routes are not emitted as page JSON SDK operations:

- OAuth callback remains a browser HTML/callback flow;
- media and DASH/proxy routes remain URL/stream contracts;
- WebSocket remains the room session transport;
- Baidu media remains a grant-backed media/sentinel route;
- adaptor operations remain a separate bearer-token boundary.

The page SDK input is generated deterministically from the authoritative
document by selecting the browser JSON tags and excluding adaptor, media,
HTML and WebSocket operations. The transform must fail on an unclassified
JSON operation rather than silently dropping it.

Every JSON operation gets a stable operation ID. Canonical and legacy aliases
are both represented; aliases may share response schemas but cannot be
silently removed or merged in the generated input.

## 3. Backend export mode

Use the maintained Elysia OpenAPI plugin after a compatibility spike against
the repository's Elysia and TypeBox versions. Register the plugin only in an
explicit contract-export path, with JSON output enabled and interactive UI
disabled unless needed for local inspection.

The export command must:

- select a disposable in-memory database configuration before importing the
  app;
- construct the app without calling listen;
- never invoke route handlers that call upstream services;
- avoid production credentials and persistent runtime data;
- request the OpenAPI JSON endpoint and write the artifact deterministically;
- fail if the export cannot be produced without importing a production
  database or starting a listener.

The smallest safe source change is preferred. If the current module shape
cannot provide this isolation cleanly, extract app construction into a
factory while retaining the existing App type/export compatibility. Do not
rewrite backend business logic as part of the export refactor.

Route modules remain thin. Response and input schemas should live with the
route or in canonical kousoku when shared; error schema and status
declarations must reuse the existing domain error code/status map.

## 4. Generated client and transport

Use Hey API's Fetch client generator with exact versions selected during the
spike. Output goes under the kyoushitsu API boundary and carries a generated
file header. No generated file is manually edited.

The runtime configuration must provide:

- the housou base URL;
- credentials include for browser cookie sessions;
- an injectable Fetch implementation for tests;
- AbortSignal propagation;
- typed success and non-success responses;
- one normalized error representation that retains HTTP status, stable domain
  code, message and response metadata.

The runtime must not turn a non-success response into a successful empty
value. It must distinguish validation/auth/permission/conflict/domain errors
from retryable transport or server failures.

If the Hey API TanStack Query plugin can emit pure operation keys/options
without adding an inappropriate UI/runtime coupling, enable deterministic
query-key output. Otherwise, define a small framework-independent key module
from generated operation IDs and resource dimensions, and record that
fallback in the task. In either case, DTOs and error shapes come only from
the generated contract.

## 5. Resource and Query policy

The following is the M2 policy contract. Numeric values are defaults for
implementation tests and can be named constants; they are not a reason to
poll live WS state.

| Resource | Key identity | Authority | Freshness and refetch | Error/retry | Mutation/lifecycle |
| --- | --- | --- | --- | --- | --- |
| Site config | site-config | HTTP | stale for the app lifetime; no focus/reconnect refetch; explicit reload only | one retry for a transient transport/5xx failure; no retry for 4xx | public, no logout purge |
| Identity me | identity/me plus session scope, never secret material | cookie-session HTTP | stale immediately; one restore request on app start; no focus polling | no retry for 401/403/422; at most one transient retry | sign-in/register/sign-out are commands; logout aborts and removes private keys |
| Room metadata | room/roomId | HTTP bootstrap, not live authority | short bounded stale window; no automatic focus polling | one retry for transient failures; no retry for domain/auth failures | invalidated by explicit room command acknowledgement only as a recovery hint |
| Bangumi bootstrap | room/roomId/bangumi | HTTP bootstrap, then room session/WS | no periodic refetch; refetch only on explicit bootstrap/recovery generation | one retry, generation-guarded | M1 room-session applies the snapshot before player use |
| Provider status/files | provider, identity/session and path/cursor dimensions | HTTP provider resource | bounded stale window; files only while the panel is active | no auth retry; one transient retry | private; abort on panel close and purge on logout |
| Baidu availability | source, room and identity/session dimensions | HTTP provider resource | explicit bounded refresh while an active playback workflow needs it; no global polling | no 4xx retry; one transient retry | private; never treated as WS room authority |
| Danmaku search/candidates | normalized query, room/enmoku/source dimensions | HTTP resource | bounded stale window; no focus refetch | no validation retry; one transient retry | private dimensions where applicable; cancel superseded searches |
| Grant | request/source/room workflow ID | explicit command/poll workflow | never general-purpose cached or replayed; poll only while preparation is active | no automatic mutation replay; bounded explicit poll | create once, poll with an AbortSignal, stop on ready/failed/cancel/logout |

Query keys must not contain access tokens, adaptor tokens, passwords or
upstream handles. Commands return acknowledgements and wait for WS authority
or a subsequent HTTP read rather than optimistically writing live room state.

## 6. HTTP and WebSocket boundary

HTTP resources provide identity, configuration, room bootstrap, provider
availability/files, danmaku catalog/candidate data and explicit command
acknowledgements. The room session/WS path owns admission, permissions,
roster, current playback, live queue and other revisioned room state. A field
cannot be authoritative in both Query and WS at the same time.

M1's framework-free fetchRoom/fetchBangumi ports remain the seam between
transport and room-session. M2 may add a Hey-backed adapter for those ports,
but it must not move WS ordering or generation checks into the HTTP client.

The Eisha cue endpoint is a browser HTTP read and may use the generated client
as a separate public resource; Eisha media/DASH/proxy URLs are not Query JSON
resources. The houkago-adapter runtime keeps its bearer contract and response
validation independent of page identity.

## 7. Drift and test evidence

Contract generation is a two-stage deterministic process:

1. export the full OpenAPI document from the isolated server entry;
2. derive the browser SDK input and generate the Hey client/query-key output.

The command compares generated output from two consecutive runs. Tests cover
the representative five-family proof, all relevant non-success status classes,
domain error code retention, cookie credentials, AbortSignal, union
responses, key dimensions, logout purge, grant non-replay and WS authority.

The existing repository checks remain the final compatibility gate. No
frontend browser behavior is intentionally changed in M2, so browser
validation is a smoke check only if the existing tooling makes it cheap; the
main M2 evidence is contract generation plus focused transport/resource
tests.

## 8. Rollback

The change is reversible by removing the export/generation entry, generated
client and resource-policy modules while retaining route schemas only if they
are still useful to Eden. Existing Eden call sites, M1 room-session ports and
the adaptor runtime remain the fallback. If the contract cannot preserve
error or union fidelity, do not cut over consumers; report the failing
operation and keep the M3 migration blocked.
