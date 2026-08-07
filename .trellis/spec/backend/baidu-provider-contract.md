# Baidu Provider Credential and Playback Contract

## Scenario: direct Baidu Netdisk sources without a server media proxy

### 1. Scope / Trigger

- Trigger: any change to Baidu OAuth, file listing/selection, persisted Baidu
  sources, adaptor pairing, dlink resolution, playback grants, or room lifecycle
  cleanup.
- `housou` is the authorization/control plane. It may exchange OAuth tokens,
  call metadata APIs, and resolve a selected file capability, but it never
  relays media bodies.
- `eisha` owns the small official-API client and the single download-host
  policy. AList is research evidence only and is not a runtime dependency.

### 2. Signatures

- Environment:
  - `HOUKAGO_BAIDU_CLIENT_ID`, `HOUKAGO_BAIDU_CLIENT_SECRET`, and
    `HOUKAGO_BAIDU_REDIRECT_URI` enable OAuth as one complete set.
  - `HOUKAGO_CREDENTIAL_KEY` is a base64-encoded 32-byte AES key and enables
    `server-saved` mode.
  - `HOUKAGO_CREDENTIAL_KEY_VERSION` is a positive integer, default `1`.
- Room-safe provider:
  `{ kind: "baidu", sourceId, ownerName?, fileName, size? }`.
- Persistence: `baidu_connection`, `baidu_source`, and
  `baidu_adaptor_session`; raw OAuth and adaptor tokens are never primary-key
  values or room metadata.
- Page REST uses `/baidu/status`, `/baidu/oauth/*`, `/baidu/files/list`,
  `/baidu/sources*`, and `/baidu/grants/:requestId`.
- Adaptor Bearer REST uses `/baidu/adaptor/pair`, `heartbeat`, `session`,
  `oauth/handoff`, `oauth/refresh`, `dlink-requests`, `dlink-responses`, and
  `grants/:grantId`.
- `GET /baidu/media/:grantId` is a sentinel and always returns
  `428 Adaptor Required`; it never returns or proxies media.

### 3. Contracts

- The deployment client secret stays server-side. `server-saved` refresh tokens
  are AES-256-GCM encrypted with AAD bound to the user and authorization id.
  A source fsid uses separate source-id AAD. `user-held` refresh tokens persist
  only in extension storage, although code exchange and refresh pass through
  server memory because the official confidential-client flow needs the client
  secret.
- Pairing codes are one-use, TTL-bound, and bind the authenticated `seito` to
  one stable extension `deviceId`. Database sessions store only SHA-256 token
  digests. Handoff, refresh, pending dlink, and disconnect operations must match
  the connection's exact device.
- A `baidu_source` permanently binds `authorizationId`, retention mode, room,
  owner, and (for user-held mode) device. Reauthorizing never revives an old
  source under a new account/token.
- Server-saved source creation verifies the exact `fs_id` and video metadata
  upstream; client-supplied filename and size are display hints only for
  user-held mode. Generic/legacy Enmoku creation rejects a fabricated Baidu
  provider.
- Raw filemetas dlinks are private. `fetchBaiduDlink` appends `access_token`,
  performs one manual-redirect `HEAD` with `User-Agent: pan.baidu.com`, then
  accepts only the final `Location` when
  `isApprovedBaiduDlinkCapability(location)` succeeds. The final capability
  contains no username, password, fragment, access token, or refresh token.
- `isApprovedBaiduDlinkCapability` in `houkago-eisha` is the only final-dlink
  host/credential policy; `housou` and `houkago-adapter` import it rather than
  copying an allowlist.
- Playback checks room admission, source-room binding, current authorization,
  retention mode, exact device, and owner/adaptor presence where applicable.
  The final dlink is available only through a short, viewer-scoped, one-use
  adaptor claim. Page, Enmoku, BANGUMI, and WebSocket data never contain it.
- Enmoku removal, viewer eviction/departure, user-held owner departure,
  connection revocation/reauthorization, and bound-adaptor disconnect cancel
  applicable pending and unclaimed capabilities. Already delivered provider
  URLs can remain usable until their provider expiry; this is not DRM.
- Connection revocation is scoped by authenticated `seitoId`: it deletes only
  that user's connection, OAuth states, pairing codes, handoffs, adaptor
  sessions, owner/viewer pending requests, and unclaimed grants. Every transient
  structure therefore carries enough owner/viewer identity to remove the target
  user's authority without disturbing another user's connection or session.
- User-held dlink requests expire after 90 seconds and may complete exactly
  once as either a ready capability or the fixed terminal failure
  `upstream-resolution-failed`. Polling consumes either completion once and
  rechecks viewer admission and the source connection before issuing a grant;
  expiry, removal, departure, revoke, or admission loss deletes both pending
  and completed state. One failed request never blocks another pending request.

### 4. Validation & Error Matrix

| Condition | Result |
| --- | --- |
| OAuth env set is incomplete | integration unavailable; core app remains usable |
| Credential key absent/invalid | server-saved disabled; user-held may remain available |
| OAuth state missing, expired, or replayed | reject without token persistence |
| Pairing/adaptor token wrong, expired, or wrong device | 401/403; no handoff/list/dlink |
| Source authorization/mode/device differs from current connection | connection-required failure; never use the new token for the old source |
| Viewer not currently admitted | deny request/poll/claim and discard relevant capability |
| User-held owner or bound adaptor offline | source unavailable; no fallback credential |
| Adaptor reports `upstream-resolution-failed` for an active request | return the fixed secret-free terminal state once; issue no media grant |
| Raw/final dlink has wrong fsid, host, credentials, or redirect behavior | upstream/grant failure; do not broaden the host policy |
| Sentinel reached without interception | HTTP 428 with no media body |

### 5. Good/Base/Bad Cases

- Good: Alice saves credentials server-side, leaves the room, and admitted Bob
  receives a one-use final-file capability without receiving Alice's OAuth
  token or sending media through `housou`.
- Good: Alice chooses user-held mode; Bob can request the exact permitted source
  only while Alice and her bound device are present.
- Base: a Bilibili or ordinary URL never enters any Baidu route or adaptor path.
- Bad: append `access_token` to a URL returned to Bob, reuse a source after
  Alice reauthorizes another account, or add a media-proxy fallback.

### 6. Tests Required

- `eisha`: code/refresh parsing, sanitized listing, exact fsid metadata, private
  HEAD UA, manual redirect, and token-free final capability policy.
- `housou`: OAuth one-use state, encryption tamper/cross-context rejection,
  device pairing replacement, user-held handoff/refresh ownership, server-saved
  and user-held Alice-to-Bob grants, wrong viewer/device/room/nonce isolation,
  reauthorization invalidation, presence rechecks, removal/departure/revoke
  cleanup, and sentinel 428/no body proxying.
- Secret scans/assertions must cover page REST, Enmoku, BANGUMI, WebSocket, and
  callback HTML for authorization codes, client secret, OAuth tokens, raw
  dlinks, extension handles, and encryption envelopes.
- Fixture tests are not installed-browser evidence. Installed Firefox is the
  real-account reference gate for this delivery. Chromium's shared contracts,
  manifest checks, and builds do not establish installed production support;
  its real redirect hosts, UA, Range/seek, direct bytes, expiry, departure, and
  revoke behavior require the separate installed-Chromium follow-up.

### 7. Wrong vs Correct

#### Wrong

```ts
// The viewer receives an OAuth-bearing raw dlink or the server relays bytes.
return `${rawDlink}&access_token=${token}`
return fetch(mediaUrl)
```

#### Correct

```ts
const final = await fetchBaiduDlink(token, fsid) // private HEAD exchange
if (!isApprovedBaiduDlinkCapability(final.dlink)) throw new BaiduGrantInvalid()
return issueViewerScopedGrant(final.dlink)
```
