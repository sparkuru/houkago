# M2 contract inventory and technical research

## Status

Pre-implementation planning evidence for M2. This document preserves the
original repository facts and constraints. The completed, expanded operation
inventory, pinned dependency decisions and implementation proof are in
[implementation-evidence.md](implementation-evidence.md).

## Evidence and method

The inventory was built from the current route modules, the current
kyoushitsu callers, shared kousoku schemas, package manifests and lockfile.
The relevant accepted parent artifacts are:

- .trellis/tasks/09-12-frontend-refactor-plan/roadmap.md
- .trellis/tasks/09-12-frontend-refactor-plan/design.md
- .trellis/tasks/09-12-frontend-refactor-plan/spec.md
- .trellis/spec/backend/error-handling.md
- .trellis/spec/backend/seitoshou-contract.md
- .trellis/spec/frontend/quality-guidelines.md
- .trellis/spec/houkago-kyoushitsu/frontend/quality-guidelines.md

The current browser consumer entry points are
packages/kyoushitsu/src/api/index.ts, src/stores/seito.ts, src/main.ts,
src/views/HomeView.vue, src/views/BushitsuView.vue,
src/composables/useEnmokuPreview.ts, src/api/baidu.ts, src/api/danmaku.ts,
and src/composables/useTimelineDanmaku.ts.

## Pre-implementation dependency snapshot

| Area | Current evidence | M2 implication |
| --- | --- | --- |
| Backend runtime | elysia 1.4.28, @elysiajs/eden 1.4.9 | Eden remains the compatibility client during M2 |
| Canonical schemas | @sinclair/typebox 0.34.49 in kousoku | New response/request schemas must reuse or extend kousoku |
| OpenAPI | No OpenAPI plugin is installed | The export path is a bounded backend contract spike |
| Generated client | No Hey API package is installed | Pin compatible versions after the spike, then record them in the lockfile |
| Query runtime | No TanStack Query package is installed | M2 defines framework-independent keys and policy; it does not bind the current Vue app |

The repository's supported development commands run through ./dx. The
host-local node_modules snapshot is evidence only and is not a reason to
upgrade unrelated dependencies.

## HTTP route inventory

The authoritative contract must account for every JSON HTTP operation, even
when a route is not currently called by kyoushitsu. The following grouping is
the implementation inventory.

| Family | JSON operations to account for | Current consumer or owner | Contract class |
| --- | --- | --- | --- |
| Health and site | GET /health; GET /site-config | app bootstrap and health checks | public read |
| Identity | POST /seitoshou/register; POST /seitoshou/sign-in; POST /seitoshou/sign-out; GET /seitoshou/me | src/stores/seito.ts | cookie session; commands and session read |
| Room creation and metadata | POST /bushitsu; GET /bushitsu/:id | HomeView.vue, BushitsuView.vue | room read plus authenticated command where enforced |
| Room queue | GET /bushitsu/:id/bangumi; POST /bushitsu/:id/enmoku/preview; POST /bushitsu/:id/enmoku; DELETE /bushitsu/:id/enmoku/:enmokuId; POST /bushitsu/:id/bangumi/:enmokuId/move; DELETE /bushitsu/:id/bangumi/pending | BushitsuView.vue, useEnmokuPreview.ts, api/baidu.ts | resource read and acknowledged mutation |
| Room membership | DELETE /bushitsu/:id/meibo/:seitoId | BushitsuView.vue | acknowledged command; authority comes from room WS |
| Baidu connection and OAuth | GET /baidu/status; POST /baidu/oauth/start; GET /baidu/oauth/callback; DELETE /baidu/connection | api/baidu.ts and browser callback | JSON reads/commands plus HTML callback |
| Baidu adaptor session | POST /baidu/adaptor/pairing; POST /baidu/adaptor/pair; POST /baidu/adaptor/heartbeat; DELETE /baidu/adaptor/session; POST /baidu/adaptor/oauth/handoff; POST /baidu/adaptor/oauth/refresh | houkago-adapter runtime | separate bearer-token integration contract |
| Baidu adaptor DLink handoff | GET /baidu/adaptor/dlink-requests; POST /baidu/adaptor/dlink-responses | houkago-adapter runtime | separate bearer-token workflow |
| Baidu files and sources | POST /baidu/files/list; POST /baidu/sources; GET /baidu/sources/:sourceId/availability | api/baidu.ts, useBaiduSource.ts | private provider resources |
| Baidu playback grants | POST /baidu/sources/:sourceId/grants; GET /baidu/grants/:requestId | useBaiduPlayback.ts | non-cacheable grant workflow; poll only by explicit preparation state |
| Baidu media | GET /baidu/media/:grantId | media playback URL | sentinel/media route, not a JSON SDK operation |
| Danmaku catalog | GET /danmaku/episodes; POST /danmaku/episodes; POST /danmaku/matches; POST /danmaku/alignments; GET /danmaku/policy; POST /danmaku/policy | api/danmaku.ts and admin tools | public/private reads and admin commands |
| Danmaku resolution | GET /danmaku/bushitsu/:bushitsuId/enmoku/:enmokuId; legacy GET /danmaku/candidates/:bushitsuId/:enmokuId | api/danmaku.ts | room-scoped candidate resource; legacy alias must remain documented |
| Danmaku defaults | POST, PUT, and DELETE on /danmaku/bushitsu/:bushitsuId/enmoku/:enmokuId/default; legacy default aliases; GET /danmaku/bushitsu/:bushitsuId/defaults | api/danmaku.ts and room tooling | explicit command/read resource; canonical route and legacy alias |
| Danmaku proposals | proposal create/list, decision, revision disable/rollback/pin routes | public/admin tooling | review workflow; no optimistic authority |
| Eisha cue data | GET /eisha/danmaku/:ref | useTimelineDanmaku.ts | public JSON cue resource, separate media domain |

The implementation inventory must expand the grouped danmaku proposal/admin rows into
one operation per route and preserve every legacy alias. Route discovery and
the exported document are checked against each other so a newly added JSON
route cannot silently bypass the contract.

## Boundary findings

1. packages/housou/src/index.ts imports ./db/client at module load. The current
   module also exports App and only listens under import.meta.main. Contract
   export must therefore use an explicit non-listening entry mode and an
   in-memory or otherwise disposable database configuration. It must not
   import the production database, invoke upstream providers, load credentials,
   or start a listener.
2. Only packages/housou/src/routes/site-config.ts currently declares an
   explicit success response schema. The remaining route families need
   response schemas and operation metadata for faithful OpenAPI output.
3. The central error handler already emits the stable shape
   { error: { code, message } }, with domain status mapping and validation
   handling. The OpenAPI document must declare that error shape for relevant
   non-success responses rather than inventing a second runtime format.
4. packages/kyoushitsu/src/api/index.ts currently uses Eden with credentials:
   include; the generated client must preserve that cookie behavior and expose
   AbortSignal and typed non-success responses.
5. packages/houkago-adapter/src/runtime.ts uses a bearer adaptor token and
   performs its own response validation. It is not the same browser session
   boundary as kyoushitsu and must not be folded into page identity state.
6. Room live state is already owned by the M1 room-session/WS boundary:
   admission, permissions, roster, current playback and queue snapshots must
   not be duplicated as Query authority. HTTP room and bangumi reads are
   bootstrap/recovery resources only.
7. GET /eisha/proxy/:token, GET /eisha/dash/:token, and GET
   /baidu/media/:grantId are media or sentinel routes; the OAuth callback is
   HTML. They remain part of the compatibility inventory but are excluded from
   the JSON page SDK.

## Technical research and decision

The official Elysia OpenAPI documentation confirms that the supported plugin
is imported from @elysia/openapi, registers with openapi(), and exposes an
OpenAPI JSON endpoint. The official Hey API documentation confirms that its
Fetch client supports typed responses/errors, runtime configuration and normal
Fetch options, while its TanStack Query plugin can generate query keys and
query options from an OpenAPI document.

M2 will use those documented capabilities only after a local compatibility
spike against the repository's Elysia and TypeBox versions. The exact package
versions are an implementation result, not a user-owned product decision:
choose the smallest compatible exact versions, record them in the lockfile,
and stop if generated output contains unknown or unsafe casts that lose
response/error fidelity.

References:

- Elysia OpenAPI pattern: https://elysiajs.com/patterns/openapi
- Elysia OpenAPI plugin: https://elysiajs.com/plugins/openapi
- Hey API Fetch client: https://heyapi.dev/docs/openapi/typescript/clients/fetch
- Hey API TanStack Query plugin: https://heyapi.dev/docs/openapi/typescript/plugins/tanstack-query

## Planned representative proof

Before broad migration, a fake-fetch contract test must exercise five
representative families:

1. site config public read;
2. identity cookie session, including sign-in and 401 behavior;
3. room queue mutation with a typed domain error;
4. Baidu availability and grant workflow, including cookie/abort behavior;
5. danmaku candidate query with room/source identity in its key.

The proof is accepted only when status, domain error code, response union,
credentials, AbortSignal and mutation acknowledgement remain observable.
