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
- Capabilities: `baidu.account.user-held`, `baidu.files.read`,
  `baidu.media.request-headers`, and optional `baidu.media.fingerprint`, each
  with its own `schemaVersion` and readiness.
- Page requests: `PAIR`, `OAUTH_HANDOFF`, `BAIDU_LIST`, `BAIDU_PERMIT`,
  `BAIDU_MEDIA_PREPARE`, optional `BAIDU_MEDIA_FINGERPRINT`, and
  `BAIDU_REVOKE`; every envelope has exact `source`, protocol version, nonce,
  and no extra properties. The fingerprint request carries `sourceId`,
  `bushitsuId`, `grantUrl`, `expiresAt`, and `bytes <= 16777216`.
- The optional fingerprint result is
  `BAIDU_MEDIA_FINGERPRINT_RESULT` with `{ algorithm: "md5", scope: "prefix",
  bytes, value }`; the page never receives the private dlink or media bytes.
- `useBaiduPlayback` requests that optional capability only after a ready
  playback grant. A successful fingerprint operation also installs that same
  claimed grant for playback; `fingerprintsBySourceId` then lets
  `useTimelineDanmaku` forward the digest and byte count to candidate
  resolution. If the read fails, the page requests a fresh grant and falls
  back to ordinary media preparation, so matching remains optional and video
  playback remains available.
- Production build requires both exact origins:
  `HOUKAGO_ADAPTER_ORIGIN` (page) and `HOUKAGO_ADAPTER_SERVER_ORIGIN` (API).
  Development without these values deliberately injects into every HTTP/HTTPS
  page and permits every HTTP/HTTPS server so separate LAN hosts, names, and
  ports can be tested. This build is restricted to a trusted development
  profile and must never be distributed.
- Chromium manifest minimum: `minimum_chrome_version: "120"`.
- Chromium durable media-grant state:
  `baidu.chromium-grants.v1 -> { version: 1, grants: ChromiumGrantRow[] }` in
  trusted `chrome.storage.session`, where each row contains exact grant id,
  paired DNR rule ids, tab id, sentinel, validated dlink, and expiry.
- Chromium-owned DNR ranges are disjoint: media grants use `20000..39999` in
  even/odd pairs and private-HEAD rules use `40000..49999`.

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
- Baidu's `category=1` and the adapter's `mediaType: "video"` classify a file as
  a provider video candidate; they do not prove that the browser's native
  `HTMLMediaElement` can demux or decode its container, video codec, and audio
  codec. Credential retention mode, dlink preparation, and request-header
  enforcement must not be inferred from a native playback compatibility
  failure. Direct-play validation uses a known browser-compatible source and
  compares successful versus failing Range progression before changing the
  control plane.
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
- Chromium's same exact case-sensitive dlink + exact tab + media/XHR header
  rule sets request `Cache-Control: no-cache` and replaces the granted
  response's `Cache-Control` with `no-store`. Request `no-cache` is the active
  cache-bypass mechanism: Baidu partial responses can otherwise be reused from
  Chrome's disk cache, and cache hits bypass network-stage UA/Referer mutation.
  Response `no-store` remains defense-in-depth and exposes the intended policy
  to clients, but Chrome processes response cache directives before the late
  response-header DNR edit, so it is not sufficient alone. Neither operation
  matches the sentinel, another tab, URL, or ordinary request; Range and every
  request header other than UA, Referer, and Cache-Control remain unchanged.
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
- User-held OAuth redemption starts only after the script-opened authorization
  popup reports closed; an earlier main-window focus cannot consume or exhaust
  the not-yet-created one-time handoff. Public `ADAPTER_ERROR` failures retry
  within a bounded attempt/deadline window; bridge timeout and invalid-response
  failures stop immediately. Exhaustion remains visible and preserves a later
  focus retry, while new authorization, revoke, and unmount cancel pending waits
  and stale flow completion. A successful handoff is never redeemed twice.
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
- Chromium MV3 global memory and `setTimeout` are never grant authority. The
  worker reconciles the strict session registry against `getSessionRules()` on
  startup and before every alarm-driven poll. Expired, malformed, duplicate,
  altered, missing, and orphaned owned rules/rows are removed; foreign rule ids
  are untouched. A valid row is retained only when both exact case-sensitive
  DNR rules match its expected structure.
- Chromium installation is serialized and transactional. It rechecks expiry
  after acquiring the transaction lock, allocates a free owned pair, installs
  DNR, then writes the registry. Partial install or registry failure rolls back
  the attempted rules. Replacement and revoke remove DNR first and registry
  second, so a rule-removal failure retains durable recovery state for the next
  worker wake. Private-HEAD rules use an escaped anchored case-sensitive regex
  and are excluded from orphan cleanup only while their in-worker reservation
  is active.
- Native worker timers must be wrapped before constructor injection, for
  example `(handler, delay) => setTimeout(handler, delay)`. Storing native
  `setTimeout` directly and later calling it as `this.timer(...)` supplies an
  illegal receiver in Chromium's `WorkerGlobalScope`, even after DNR and
  registry installation have succeeded.
- Logical expiry rejects new installation and renewal. A live worker's timer
  requests prompt removal; alarms/startup reconciliation provide durable
  cleanup after worker suspension. This does not claim recall of an already
  delivered dlink or media bytes.
- The fingerprint path first claims and validates the one-use server grant by
  exact sentinel URL, source id, room id, paired adaptor, page origin, and
  nonce. The content script then requests only `Range: bytes=0-(N-1)` from the
  sentinel, hashes the bounded response locally, and returns lowercase MD5
  metadata. A failed or unavailable fingerprint is an optional matcher
  degradation, not a playback failure.

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
| Chromium registry row is malformed, duplicated, expired, or differs from live rules | remove the owned rules/row on reconciliation; never restore authority from it |
| Owned DNR rule exists without a valid registry row | remove it as an orphan on startup/alarm; leave foreign rules unchanged |
| DNR installation or registry write fails partway | remove attempted rules, preserve prior valid rows, and fail without new authority |
| Replacement/revoke DNR removal fails | preserve the registry row, report a stable cleanup failure, and retry reconciliation on the next wake |
| Serialized install expires while waiting for ownership | reject as expired before allocating or installing any rule |
| Chromium native timer is invoked through an object receiver | never store it directly; call through an arrow wrapper so successful grant preparation is not reported as a generic adapter failure |
| A granted Chromium target already has a reusable cached 206 | set request `Cache-Control: no-cache` on the exact dlink/tab rule so Chrome returns through DNR/network; retain response `no-store` as defense-in-depth |
| Provider marks a file as video, but native playback repeatedly restarts the same initial Range after a valid 206 | treat as a media compatibility/pipeline failure until browser diagnostics prove a transport defect; do not blame retention mode or weaken grant rules |
| Fingerprint request has wrong source/room, sentinel, origin, or bound grant | reject with a stable adapter error and install no additional grant |
| Fingerprint response is too large, empty, non-web, or request fails | return `Media fingerprint unavailable`; expose no bytes or private URL |

### 5. Good/Base/Bad Cases

- Good: Firefox on the exact configured page claims one Bob-scoped grant,
  injects `User-Agent: pan.baidu.com`, removes the Houkago page Referer,
  preserves Range and unrelated headers, and removes rules on expiry/revoke.
- Good: the read-only modal navigates folders, disables unsupported files, and
  makes one selected video the explicit user-held room permit.
- Base: an unadapted/mobile viewer enters the room and plays an ordinary URL.
- Good: a Chromium worker restarts, validates its `storage.session` rows against
  live DNR, restores only exact unexpired grants, and removes orphaned owned
  rules without touching another extension rule id.
- Good: after an unadapted request has populated Chrome's cache, the first and
  repeated same-tab granted requests for the exact dlink both reach the
  provider with request `no-cache` plus UA/Referer/Range enforcement.
- Good: a paired desktop adaptor hashes only the bounded sentinel prefix and
  returns typed MD5 scope metadata; the server can use it as release evidence
  without ever receiving media bytes.
- Base: an empty Chromium registry is removed and no rules are installed.
- Bad: trust a manifest match as an origin check, expose a dlink to Vue state,
  apply UA to every Baidu request, or mount the player before preparation.
- Bad: make fingerprint capability mandatory, send the raw dlink to Vue, or
  treat a fingerprint as proof of canonical episode identity.
- Bad: rely on an in-memory map/timer after MV3 suspension, delete registry
  state before confirming DNR removal, or use a case-insensitive private-HEAD
  filter.
- Bad: allow a multi-day provider 206 cache entry to bypass DNR on later media
  retries, or disable caching on an entire host/origin instead of the exact
  granted dlink and tab.
- Bad: treat Baidu `category=1`, a `.mp4` suffix, or successful playback in a
  native Baidu client as proof that Chrome/Firefox can natively play the same
  bytes. Provider clients may use a different media pipeline; MP4 is a
  container and does not guarantee supported internal codecs.

### 6. Tests Required

- Shared/page unit tests: strict envelopes, source/window/origin/nonce, protocol
  capability negotiation, current-user pairing, OAuth popup, availability,
  handoff unavailable-then-success, bounded exhaustion, cancellation, no calls
  after success, stale playback requests, and provisional-create rollback.
- Extension unit/build tests: wrong-port rejection including HELLO, token
  non-export, selection consumption, exact permit, re-pair/revoke cleanup,
  private raw-dlink HEAD, shared final-host policy, tab/expiry grant behavior,
  exact request-id correlation, same-URL concurrency serialization, terminal
  resolution failure and listener/fetch/DNR cleanup,
  development HTTP/HTTPS wildcard manifests, production manifests with no
  development wildcard anywhere, exact runtime deployment origins, loopback
  deployment validation, Chromium minimum 120, and Firefox/Chromium builds.
- Chromium lifecycle tests: strict registry parsing, exact live-rule equality,
  startup/alarm recovery, expired/orphan/altered/duplicate cleanup, disjoint
  owned ranges, foreign-rule preservation, case-sensitive private-HEAD filter,
  same-URL reservation, partial install and storage rollback, failed
  replacement/revoke recovery, queued expiry recheck, idempotent clear, and
  worker-restart timer reconstruction.
- Controlled installed-Chromium Playwright: load the real unpacked extension
  and exact service worker in a temporary profile; prove HELLO/pairing, session
  DNR grant installation, provider UA, Referer removal, Range, 206 direct
  approved-host traffic, exact-tab isolation, revoke cleanup, ordinary-request
  non-interference, and cleanup of all temporary processes/sockets/files. Keep
  this behind its dedicated config so ordinary page suites are unaffected.
- Cache regression: before installing the grant, populate and prove reuse of a
  cacheable exact-target response. Then assert the installed rule's request
  `no-cache` forces the same target back to the provider with grant headers and
  preserved Range, repeated granted requests remain network-backed, response
  `no-store` is visible, another tab reaches the 428 sentinel, and revoke
  removes both session rules.
- Playwright controlled fixtures: unselected retention choice and risk copy,
  keyboard dialog close/focus restore, read-only folder/file states, mobile
  desktop-only explanation, and ordinary source composer availability.
- Installed Firefox is the reference smoke for this delivery, covering real
  redirect, UA, Range/seek, direct playback, and lifecycle revocation. Chromium
  keeps an independent installed-browser smoke/hardening gate before any
  production-support claim; current shared automation is not a substitute.
- Real-account direct-play diagnosis must compare at least one known-good and
  one failing source without retaining private URLs. Assert whether the browser
  advances to a later Range or repeatedly restarts the same initial Range, and
  record only safe container/MIME, status, cache, cancellation, and media-pipeline
  categories. A source-specific decode/demux failure is not an adapter transport
  regression when both retention modes and an independent direct-link client
  reproduce it under the same browser media pipeline.

- Fingerprint tests must assert the exact Range bound, lowercase MD5, explicit
  algorithm/scope/byte count, source/room/grant binding, schema rejection of
  oversized or secret-bearing payloads, and playback-safe failure fallback.

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

#### Wrong — Chromium lifecycle

```ts
// MV3 can discard both of these while DNR session rules remain active.
active.set(grant.id, ruleIds)
setTimeout(() => removeRules(ruleIds), ttl)

// Native timer becomes an illegal WorkerGlobalScope receiver when called as a property.
const port = new ChromiumGrantPort(browser, setTimeout)
```

#### Correct — Chromium lifecycle

```ts
await reconcileSessionRegistry(await dnr.getSessionRules())
await dnr.updateSessionRules({ addRules })
await chrome.storage.session.set({ [registryKey]: nextRegistry })
const timer = (handler: () => void, delay: number) => setTimeout(handler, delay)

// Keep a short-lived exact capability out of Chrome's reusable media cache.
requestHeaders: [{ header: "cache-control", operation: "set", value: "no-cache" }]
responseHeaders: [{ header: "cache-control", operation: "set", value: "no-store" }]
```

#### Wrong — media compatibility diagnosis

```ts
// Provider classification is not a native browser capability probe.
const browserPlayable = baiduEntry.category === 1
```

#### Correct — media compatibility diagnosis

```ts
// Keep provider eligibility separate from observed native playback support.
const directPlayCandidate = baiduEntry.category === 1
// Diagnose native compatibility from the media pipeline/codec outcome; do not
// change OAuth, dlink, or DNR policy solely because one candidate cannot decode.
```
