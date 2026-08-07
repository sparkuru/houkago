# Baidu Page and Desktop Adapter Contract

## Scenario: capability-gated Baidu browsing and direct playback

### 1. Scope / Trigger

- Trigger: any change to the Baidu connection/file dialogs, provider playback
  gating, `houkago-adapter` page protocol, extension origins/permissions, or
  Firefox/Chromium network ports.
- Ordinary sources, room entry, chat, and queue visibility remain usable when
  the Baidu capability is absent. Mobile Baidu playback is intentionally
  unavailable until a separate companion is delivered.

### 2. Signatures

- Shared protocol version: `HOUKAGO_ADAPTER_PROTOCOL_VERSION`.
- Handshake: `HELLO -> { protocolVersion, clientVersion, browser, deviceId,
  capabilities[] }`.
- Capabilities: `baidu.account.user-held`, `baidu.files.read`, and
  `baidu.media.request-headers`, each with its own `schemaVersion` and readiness.
- Page requests: `PAIR`, `OAUTH_HANDOFF`, `BAIDU_LIST`, `BAIDU_PERMIT`,
  `BAIDU_MEDIA_PREPARE`, and `BAIDU_REVOKE`; every envelope has exact `source`,
  protocol version, nonce, and no extra properties.
- Production build requires both exact origins:
  `HOUKAGO_ADAPTER_ORIGIN` (page) and `HOUKAGO_ADAPTER_SERVER_ORIGIN` (API).
  Development without these values deliberately injects into every HTTP/HTTPS
  page and permits every HTTP/HTTPS server so separate LAN hosts, names, and
  ports can be tested. This build is restricted to a trusted development
  profile and must never be distributed.

### 3. Contracts

- `window.postMessage` accepts only the same window and exact current origin;
  shared TypeBox schemas and the request nonce validate both directions.
- WebExtension match patterns cannot encode a port. Therefore the background
  runtime independently validates the exact configured page origin for every
  production request, including `HELLO`; manifest scoping alone is never an
  authority check. The unconfigured development runtime intentionally accepts
  any syntactically valid HTTP/HTTPS page and server origin.
- A production build replaces development page/server patterns rather than
  retaining `http://*/*` or `https://*/*`. It keeps only the configured page
  match, configured server host permission, and approved Baidu hosts. Both
  configured origins must be exact HTTPS origins, except exact loopback HTTP
  origins remain valid for a local deployment.
- The stable device id, adaptor Bearer token, refresh token, selections,
  source/room permits, and media grants remain extension-owned. Pairing a new
  account or revoking Baidu clears old credentials, permits, selections, and
  browser rules. Remote revoke is best-effort; local cleanup still runs after a
  remote 401/failure.
- User-held file listing records only handles returned by the current listing.
  `BAIDU_PERMIT` consumes one selected video handle and stores the exact
  `{sourceId, bushitsuId, upstreamHandle}` binding. Polling can resolve dlinks
  only for such a permit.
- The page receives a Houkago grant sentinel, not a dlink. The viewer extension
  privately claims the one-use dlink, validates the shared host policy, and
  installs a tab- and expiry-scoped redirect/header rule. On that active media
  grant only, the rule sets `User-Agent: pan.baidu.com`, removes `Referer`
  case-insensitively, and leaves `Range` and all unrelated headers unchanged.
  Firefox tracks the exact request/redirect chain with blocking WebRequest;
  Chromium binds its DNR session rule to the exact dlink and tab. The private
  raw-dlink `HEAD` exchange preserves `redirect: "manual"`, sets only the
  provider UA, and does not inherit the media grant's Referer removal. Firefox
  observes the exact URL/method/request id while its blocking listener injects
  the UA. Chromium uses DNR as the only header modifier and ordinary,
  non-blocking WebRequest listeners to bind the exact request id to the real
  3xx/Location. Same-URL exchanges are serialized in both ports so concurrent
  observers cannot consume one another's redirect; listener, fetch, and DNR
  failures remove temporary state and fail closed. Firefox may seed a fresh segmented-media
  request id only from the active grant's exact dlink and tab, then tracks and
  validates that request's redirect chain; an unapproved Location is cancelled
  while processing response headers, before the browser follows it. Chromium's
  automated port/build is delivered, but installed production support must not
  be claimed before its separate real-browser smoke/hardening task passes.
- `BushitsuView` mounts `EnmokuPlayer` for a Baidu source only after availability,
  grant, and `BAIDU_MEDIA_PREPARE` succeed. Async request identity prevents a
  stale source from becoming playable after a switch. Ordinary player paths do
  not call the adaptor.
- Personal Baidu connection management remains reachable for every authenticated
  room member, independently of playlist-write permission. File browsing and
  source insertion remain playlist-gated. Moving from the file browser to
  connection management closes the first native dialog before opening the next
  and restores focus to the initiating control on keyboard dismissal.
- Page-initiated revoke first requires the authenticated server DELETE to
  succeed. Failure preserves the visible connection and local credentials;
  success asks a ready extension to clear its local authority, clears the page's
  pairing state, re-detects/re-pairs, and returns immediately to an unselected
  retention choice so reauthorization can start without a reload.
- User-held source creation is provisional until the extension stores its exact
  permit. Permit failure performs a best-effort DELETE of only the newly created
  Enmoku and preserves the original permit error for the UI.
- A user-held upstream-resolution failure is reported as the fixed,
  secret-free terminal state `upstream-resolution-failed`; it never contains a
  token, dlink, file id/path, or nonce. Control-plane transport/auth failures
  remain retryable and are not relabelled as upstream resolution. Chromium
  polls through a persistent 30-second alarm (with an immediate startup poll),
  while Firefox retains its 3-second path. The server's 90-second pending
  expiry is the page polling deadline, and the page visibly says it is waiting
  for the owner's device during that interval.

### 4. Validation & Error Matrix

| Condition | Result |
| --- | --- |
| Message source/origin/schema/version/nonce mismatch | ignore or fail the requested capability; expose no device id or secret |
| Configured page origin has the wrong scheme, host, or port | reject every request, including HELLO |
| Unconfigured development page/server uses HTTP or HTTPS | accept for trusted-profile LAN testing |
| Unconfigured development page/server uses another protocol | reject |
| Production origin pair missing/incomplete/unsafe | build fails |
| Required capability missing or incompatible | disable only Baidu action/playback |
| Mobile viewer | explain desktop requirement; ordinary sources remain usable |
| Authenticated member lacks playlist-write permission | allow personal connection management; hide/deny browse and source insertion |
| User-held owner/adaptor offline | playback action disabled with owner-offline state |
| Private HEAD is non-3xx, lacks Location, crosses request ids, or resolves to an unsafe/credential-bearing host | reject without following or exposing the target; remove observers/rules |
| User-held resolver returns a terminal failure | consume once as `upstream-resolution-failed`; continue processing other pending requests |
| Grant dlink/redirect host outside shared policy | refuse/cancel the browser rule |
| Permit persistence fails after create | delete only that new Enmoku best-effort; report original failure |
| Authenticated page `DELETE /baidu/connection` fails | preserve the visible connection and local authority; show a retryable error and do not pretend revoke succeeded |
| Server revoke succeeded but the extension's best-effort adaptor-session DELETE fails | still clear local tokens, permits, selections, pairing, and browser rules before re-detection |

### 5. Good/Base/Bad Cases

- Good: Firefox on the exact configured page claims one Bob-scoped grant,
  injects `User-Agent: pan.baidu.com`, removes the Houkago page Referer,
  preserves Range and unrelated headers, and removes rules on expiry/revoke.
- Good: the read-only modal navigates folders, disables unsupported files, and
  makes one selected video the explicit user-held room permit.
- Base: an unadapted/mobile viewer enters the room and plays an ordinary URL.
- Bad: trust a manifest match as an origin check, expose a dlink to Vue state,
  apply UA to every Baidu request, or mount the player before preparation.

### 6. Tests Required

- Shared/page unit tests: strict envelopes, source/window/origin/nonce, protocol
  capability negotiation, current-user pairing, OAuth popup, availability,
  stale playback requests, and provisional-create rollback.
- Extension unit/build tests: wrong-port rejection including HELLO, token
  non-export, selection consumption, exact permit, re-pair/revoke cleanup,
  private raw-dlink HEAD, shared final-host policy, tab/expiry grant behavior,
  exact request-id correlation, same-URL concurrency serialization, terminal
  resolution failure and listener/fetch/DNR cleanup,
  development HTTP/HTTPS wildcard manifests, production manifests with no
  development wildcard anywhere, exact runtime deployment origins, loopback
  deployment validation, and Firefox/Chromium builds.
- Playwright controlled fixtures: unselected retention choice and risk copy,
  keyboard dialog close/focus restore, read-only folder/file states, mobile
  desktop-only explanation, and ordinary source composer availability.
- Installed Firefox is the reference smoke for this delivery, covering real
  redirect, UA, Range/seek, direct playback, and lifecycle revocation. Chromium
  keeps an independent installed-browser smoke/hardening gate before any
  production-support claim; current shared automation is not a substitute.

### 7. Wrong vs Correct

#### Wrong

```ts
// A content-script match is not exact-port authorization.
if (manifestMatched) return adapterHello(deviceId)
```

#### Correct

```ts
if (!isAllowedPageOrigin(sender.url)) return undefined
if (!Value.Check(AdapterPageRequestSchema, message)) return undefined
return handleCapability(message)
```
