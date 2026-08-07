# Baidu Netdisk direct adaptor — technical design

## 1. Architecture and boundaries

The adaptor adds a provider control plane, not a server media proxy.

```text
Baidu OAuth / file API
        ▲
        │ metadata, token exchange, dlink only
        │
housou ─┼─ eisha Baidu REST client
  │     │
  │ grants / targeted dlink requests
  ▼     │
kyoushitsu page ⇄ houkago-adapter ⇄ Baidu media bytes
                         Firefox first
                         Chromium second
```

- `housou` owns authenticated OAuth orchestration, retention policy, encrypted
  server credentials, adaptor pairing, room/source authorization, grant state,
  and targeted dlink coordination.
- `eisha` owns a small injected-fetch Baidu REST client and strict response
  parsing for directory entries, file metadata, token responses, and dlinks.
  It does not own user sessions or store credentials.
- `kousoku` owns typed provider metadata and the page/adapter protocol.
- `kyoushitsu` owns connection/file-browser UI and composes a provider playback
  grant into `EnmokuPlayer`; it never sees OAuth tokens.
- `packages/houkago-adapter` is a generic desktop WebExtension with a versioned
  capability registry. The Baidu capability owns local tokens, selected-source
  permits, API calls in user-held mode, and request-header/redirect rules.
- `EnmokuPlayer` remains the only ArtPlayer owner. It receives a prepared local
  grant URL and does not learn OAuth/dlink semantics.

Normal direct/HLS/DASH/Bilibili paths do not call the adaptor.

### Adapter capability model

The adapter handshake reports `{protocolVersion, clientVersion, browser,
capabilities}`. Each capability declares its schema version and readiness;
examples for this task are `baidu.account.user-held`, `baidu.files.read`, and
`baidu.media.request-headers`. The page asks for a capability, never infers it
from “extension installed”.

The package separates:

- a small pairing/message/update core;
- independently registered capability modules with their own storage and host
  policy;
- Firefox and Chromium transport ports.

Adding a future capability must not grant it access to Baidu tokens or permits
by default. Host permissions should be capability-scoped and optional where the
browser permits runtime requests. Unknown capability and protocol versions fail
closed only for the requesting feature.

## 2. Provider and persistence contracts

Extend `Enmoku.provider` to a discriminated union. The room-safe Baidu member is
deliberately small:

```ts
type BaiduProvider = {
  kind: "baidu"
  sourceId: string
  ownerName?: string
  fileName: string
  size?: number
}
```

It contains no path, fsid, OAuth token, dlink, headers, retention mode, or
device identifier. `Enmoku.url` is a stable Houkago source reference, never a
Baidu URL.

Add database entities at the existing SQLite boundary:

- `baidu_connection`: one record per `seito`, with retention mode, display-safe
  Baidu identity, encrypted server-saved token bundle or null, timestamps, and
  key version.
- `baidu_source`: opaque source id, owner, room, display metadata, retention
  mode, and either an encrypted server-side fsid reference or an opaque
  extension handle. Removing the Enmoku removes/revokes the source.
- `baidu_adaptor_session`: digest of a separately scoped extension device
  token, owner, device id, expiry, and revocation time. It is not a Houkago
  account session and grants only adaptor endpoints.
- OAuth state/handoff and playback grants remain short-lived in memory. A
  restart safely requires reconnect/retry and never creates lasting authority.

Server-saved token bundles use authenticated encryption (AES-256-GCM) under a
base64 deployment key such as `HOUKAGO_CREDENTIAL_KEY`. Ciphertext stores key
version, nonce, and authentication tag. Missing Baidu app configuration disables
the integration; missing encryption configuration disables only server-saved
mode. Token refresh replacement is an atomic database update.

## 3. OAuth and adaptor pairing

One Baidu `client_id` / `client_secret` belongs to the deployment and remains in
server environment configuration.

1. An authenticated Houkago page detects `houkago-adapter` by a narrow
   `window.postMessage` handshake with origin, schema, and nonce validation.
2. The page creates a one-use adaptor pairing code. The extension redeems it
   for a raw adaptor token; the database stores only its digest.
3. `POST /baidu/oauth/start` validates retention mode, creates a random state
   digest bound to `seito`, adaptor device, redirect target, and a short TTL,
   then returns the official authorization URL.
4. Baidu redirects to a server callback. The callback validates state before
   exchanging the one-use code with the deployment client secret.
5. In server-saved mode the server encrypts and stores the returned token
   bundle. In user-held mode it creates a one-use in-memory handoff addressed
   to the paired adaptor; only that adaptor can redeem it, after which plaintext
   is discarded.
6. The extension keeps the user-held refresh token in extension-owned storage
   and access tokens in session memory where possible. Because official refresh
   requires `client_secret`, it submits the refresh token to a dedicated
   adaptor-authenticated server endpoint; the server returns the rotated bundle
   without storing or logging it.

No stronger PKCE/zero-observation claim is made because current official Baidu
documentation requires `client_secret` and does not document PKCE.

## 4. Directory browsing and source creation

Expose one frontend port with two implementations:

```ts
type BaiduFilePort = {
  list(path: string, cursor?: string): Promise<BaiduDirectoryPage>
  select(entry: BaiduFileEntry, roomId: string): Promise<BaiduSourceSelection>
}
```

- Server-saved calls authenticated `housou` REST; the server calls `eisha` with
  the stored token.
- User-held sends a typed request to the paired extension; the extension calls
  Baidu with its local access token and returns sanitized rows.

Rows contain only stable id/handle, name, directory flag, size, modified time,
and browser-playable media classification. Directories navigate; unsupported
files are visible but cannot be selected. Search, upload, rename, move, and
delete are absent.

Selecting a file and adding it to a room is the one explicit permit. In
user-held mode the extension stores `{sourceId, roomId, upstreamHandle}` and
will answer dlink requests only for that exact binding while the owner is
present in the room. The server stores only the opaque handle and safe metadata.
Existing playlist authorization still gates preview/add/delete.

## 5. Playback grant protocol

`final dlink + User-Agent: pan.baidu.com` is the viewer-side Baidu media
requirement. A raw filemetas dlink is not distributed: its OAuth-bearing
exchange remains private to the server or source owner's adaptor.

1. A viewer selects a Baidu Enmoku. The page first proves that its paired
   extension is ready, then requests a playback grant from `housou`.
2. `housou` checks authenticated viewer, current room admission, source-room
   binding, source existence, and connector availability.
3. Server-saved mode asks `eisha` to fetch the exact filemetas record, append
   the access token only to the raw dlink, and perform a manual-redirect `HEAD`
   with `User-Agent: pan.baidu.com`. User-held mode creates a nonce-bound
   pending request and targets the source owner's adaptor, which performs the
   same private exchange after verifying its exact local permit. Only the final
   redirect Location may be posted as `{requestId, nonce, dlink, expiresAt}`;
   it must match the approved download-host policy and contain no OAuth
   credential.
4. `housou` consumes the pending request once and returns a short viewer/file/
   room-scoped grant to the requesting extension. Dlinks exist only in memory
   and are redacted from all logging.
5. The extension installs a session-scoped redirect/header rule from the exact
   Houkago grant URL to the exact validated dlink. Firefox uses
   `webRequest.onBeforeRequest` / `onBeforeSendHeaders`; Chromium uses
   `declarativeNetRequest` session rules. Only the approved Baidu redirect-host
   policy receives `User-Agent: pan.baidu.com`.
6. ArtPlayer loads the Houkago grant URL; the extension redirects locally, so
   media and Range traffic go from viewer to Baidu. Without an extension the
   small Houkago endpoint returns `428 Adaptor Required` and never proxies.

Removal, revocation, loss of viewer admission, or user-held connector departure
immediately stops new grants/renewals and broadcasts source unavailability.
Already issued dlinks may remain usable until Baidu expires them; the product
does not promise DRM or retrieval of delivered bytes.

## 6. UI and interaction contract

Use existing Houkago theme tokens and native `<dialog>` focus management.

### Connection dialog

Three progressive steps:

1. Check Firefox/Chromium adaptor readiness and offer an installation/setup
   action when absent.
2. Present labelled retention cards. Server-saved explains offline playback,
   encrypted storage, and administrator trust. User-held explains local token
   storage, transient server exchange/refresh, and the online requirement.
3. Open Baidu authorization, show pending/success/error, and return focus to the
   launch control. Revocation is a separate clearly labelled action.

### File browser dialog

- Breadcrumb/back navigation, current folder heading, keyboard-operable rows,
  44px targets, visible focus, and one primary “add selected file” action.
- Defined loading skeleton/progress, empty folder, upstream error with retry,
  token-expired reconnect, adaptor-disconnected, unsupported-file disabled, and
  success states.
- No hover-only affordances, no color-only status, no new palette/font, and
  reduced-motion-safe transitions.

### Room/player states

- Missing adaptor disables only Baidu actions and shows a setup explanation.
- Mobile shows desktop-required for Baidu while room/ordinary playback remains
  usable and free of horizontal overflow.
- User-held connector offline disables the source with owner-offline text.
- Server-saved sources remain available after the owner leaves unless revoked.

## 7. Error and revocation matrix

| Condition | Observable result |
| --- | --- |
| Baidu integration config missing | Baidu entry reports unavailable; core app works |
| Server-saved encryption key missing | server-saved option disabled; user-held remains |
| OAuth state missing/expired/mismatched | reject callback, no token/handoff |
| Pairing/adaptor token invalid or revoked | 401/403; no handoff/list/dlink response |
| Refresh rejected/revoked | connection needs reconnect; no fallback credential |
| Directory API malformed/upstream failure | safe error + retry; no room mutation |
| File not selected for this room | extension rejects dlink request |
| Owner leaves in user-held mode | pending requests cancelled; source unavailable |
| Viewer loses admission | grants denied; existing Houkago session rules removed |
| Dlink/redirect host outside policy | extension refuses rule installation |
| Extension absent or wrong version | Baidu action disabled / grant endpoint 428 |
| Unsupported/mobile client | Baidu unavailable; ordinary sources unchanged |

Every error is stable and redacts client secret, authorization code, OAuth
tokens, dlink query material, pairing tokens, and encryption metadata.

## 8. Compatibility, rollout, and rollback

- Firefox is implemented and tested first using blocking WebRequest. Chromium
  follows with DNR behind the same typed provider core.
- Extension manifests request only the Houkago deployment and verified Baidu
  hosts. Browser-specific manifests/build outputs are separate artifacts.
- New database tables and provider union members are additive. Legacy Enmoku
  rows and all public providers remain unchanged.
- Feature availability is configuration- and adaptor-gated. Rollback disables
  Baidu routes/UI and extension publication without changing ordinary playback;
  encrypted connection/source rows can remain inert for later re-enable.
- Automated fixtures cover contracts without real credentials. Submit-ready
  requires a user-operated Firefox smoke against an approved Baidu application;
  Chromium real-account smoke follows before claiming Chromium production
  support.

## 9. Deferred work

- Filename-based danmaku lookup for Baidu files.
- Mobile provider companion and mobile Baidu playback.
- Upload, rename, move, delete, global search, bulk operations, and DRM.
