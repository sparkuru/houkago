# Same-origin API preview design

Status: approved by the owner with `可以；开始实施`; development preview only.

## Entry and service boundary

Keep the existing Housou and React containers. Add a repository-owned Docker
network and stable backend alias, using exact ownership checks for creation,
reuse and teardown. Publish only React's configurable port. Housou remains a
separate process/container with an internal configurable listener.

Use the existing Vite development server as the preview entry: `/api` and
`/api/...` proxy to Housou with WS upgrades enabled. Keep the prefix intact at
the backend, and mount its application routes under `/api`. This avoids a
third gateway container and avoids making response-body rewriting the source
of correctness. This is a development entry, not a production-hosting design.

| Public entry | Handling |
| --- | --- |
| `/`, existing room deep links and assets | React/Vite |
| `/api/health`, identity, rooms, config, provider JSON | Housou HTTP |
| `/api/ws?...` | Housou WS upgrade |
| `/api/eisha/...`, `/api/baidu/media/...` | Existing streaming/provider handling |
| `/api/baidu/oauth/callback` | Existing OAuth callback |
| `/api/openapi/json` | Existing opt-in OpenAPI document |

Match the `/api` path boundary exactly; `/apix` is not an API route. Missing
API routes must reach backend error handling rather than Vite's SPA fallback.

## Client and generated contracts

Use one browser API-base resolver derived from the current page's scheme and
host, including its actual port, plus `/api`. Room WS must reuse it and append
`ws` without replacing the base pathname. HTTPS becomes WSS. Normalize joining
once so trailing slashes cannot drop or duplicate the prefix.

Choose one prefix owner in the generated SDK: full `/api/...` paths
in exported OpenAPI and an origin-only SDK transport base. Handwritten provider
and extension consumers use the path-bearing API base. Generate artifacts via
the existing pipeline; never hand-edit generated SDK files. Generator URL
joining is verified by the API resource tests and browser acceptance.

Retire the browser's default separate-port derivation and backend-publication
injection. Preserve local private settings; flag old `VITE_HOUSOU_*` and
`PREVIEW_BACKEND_PORT` values for migration rather than silently deleting them.
The Vite proxy target is server configuration and must not expose private
backend environment variables through `VITE_*`.

## Returned URLs, trust and provider integration

Audit every application-created URL, including room source resolution,
HLS/DASH manifests, Baidu source references, grants and sentinels. Generate
public paths with `/api`; persist new resolved queue media URLs as site-relative
paths so localhost and LAN visitors share the same queue safely. The HTTP
proxy must preserve the browser-facing Host for generated HLS/DASH manifests.
For this HTTP development preview, derive public origins from the incoming
request with the preserved Host. Do not accept arbitrary forwarded headers as
trusted public-origin configuration. Production TLS/proxy trust is excluded.

Separate extension trust comparison (`URL.origin`) from its canonical API
base (`origin` plus allowed `/api` pathname). Validate paths before retaining
them. Pairing, stored base comparison, request joining and grant parsing must
use the same contract without allowing arbitrary path or origin escapes.
Existing extension pairings may require explicit re-pairing; no silent unsafe
conversion. Keep browser session cookie flags/path and bearer isolation.

Retain actual Origin and authorization checks for HTTP and WS. Same-origin
routing is not a reason to remove them. OAuth callback configuration must use
the new public URL; changing a real provider registration is outside this task.

## Readiness, configuration and rollback

Reuse `dx`, `preview.sh`, service supervision and the existing configuration
loader. Probe Housou internally, React internally and the inspected public
site `/` plus `/api/health`. A missing backend publication becomes expected;
a missing public site mapping remains a failure. Do not depend on host access
to the old backend port to establish health.

Console output retains its required sections, prints API URLs under the site
entry, and records backend listeners as internal-only. Network ownership and
configuration must participate in reuse/failure cleanup. Remove only the owned
unused network after stopping its containers; retain databases and caches.

Adapt the isolated memory browser fixture to the same topology so browser
acceptance exercises the proxy. Keep the owner's current preview untouched.
Rollback stops task-owned services, restores the prior reviewed code/config
shape and restarts only when authorized; no data deletion or automatic route
fallback is involved.

## Verification boundary

Actual checks and fixture limits are recorded in `validation.md`. The owner's
existing database and private `.env` are not converted. Previously persisted
absolute proxy URLs targeting the old host/port may need re-resolving/re-adding
after cutover; arbitrary external media URLs are never automatically rewritten.
Real OAuth provider registration still requires the owner to use the new
callback URL. The original preview is not stopped/recreated by these tests.

## Owner configuration follow-up

The owner renamed listeners to `BACKEND_HOST`/`BACKEND_PORT` and
`FRONTEND_HOST`/`FRONTEND_PORT`, site publication to `FRONTEND_PUBLISHED_PORT`,
and discovery/deadline to `LAN_HOST`/`READY_TIMEOUT`. Manifest defaults are now
backend 8081 / frontend 8080; the explicit example/local publication remains
9999. Load, injection, app startup, supervision, health and summary must use
these names together; no legacy alias chain overrides the new values.

`HOUKAGO_BAIDU_REDIRECT_URI=/api/baidu/oauth/callback` resolves against the
validated OAuth-start request Origin (request URL fallback under existing
Origin-less development policy). Store the full callback URI with state and
reuse it when exchanging the code, so dynamic ports and concurrent site
hostnames do not depend on later configuration or another callback request.
Absolute configured HTTP(S) callback URLs remain usable. Only the complete
resolved URI is sent to Baidu; live provider registration remains owner-owned.
