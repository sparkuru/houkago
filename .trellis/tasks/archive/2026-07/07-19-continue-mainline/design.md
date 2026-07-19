# Design: Self-hosted identity and room authorization

## Scope

This slice replaces the browser-generated UUID authority model with a
Houkago-issued account and session. It covers open username/password
registration, sign-in, sign-out, session expiry, server-derived room actors,
and authorization for room mutation over REST and WebSocket.

It does not add Bilibili browse/search, new provider adapters, source-session
storage, OAuth, email, password recovery, invitations, administration, or any
third-party platform capability.

## Identity and session model

`Seito` is the durable Houkago account. A `seito` record stores a generated
string id, a normalized unique username, the display username, an Argon2id
password hash, and creation time. Usernames use a small documented ASCII
identifier policy; passwords currently accept any content from 8 to 128
characters and are never logged or
returned.

On a successful registration or sign-in, the server creates a `seitoshou`
session record. The browser receives only a high-entropy opaque token in an
`HttpOnly`, `SameSite=Lax`, path-root cookie; SQLite retains only a SHA-256
digest of the token, the owning `seitoId`, issue time, and expiry. The raw token
is not stored, logged, sent over WebSocket payloads, or returned in a JSON body.
Sign-out removes that session row; every authenticated request resolves the
cookie digest and rejects absent, expired, or revoked rows. This makes the
token a server-revocable `Seitoshou` without adding a JWT dependency.

`Bun.password.hash`/`verify` use Argon2id asynchronously. The built-in API
generates and embeds salts, so no custom password crypto or additional package
is needed. [Bun password hashing](https://bun.sh/docs/runtime/hashing)

## Database reset and schema boundary

Legacy room data is intentionally incompatible: its host and queue ownership
refer to forgeable browser UUIDs. It is not migrated or claimed. Operators must
start the authenticated version against a reset development database. Bootstrap
detects legacy room data without the authenticated schema and fails with a clear
reset instruction rather than silently deleting or retaining it.

The fresh schema adds `seito` and `seitoshou` tables and makes
`bushitsu.buchou_id` / `enmoku.added_by` refer to a `seito.id`. The obsolete
`buin` identity table is not reused as an account table. Query modules own row
mapping and prepared statements; domain services never expose database column
names.

## HTTP contract and authorization

`/seitoshou/register`, `/seitoshou/sign-in`, `/seitoshou/sign-out`, and
`/seitoshou/me` form a narrow typed REST boundary. Register/sign-in set the
cookie and return a public account summary; sign-out clears it; `me` restores a
page refresh without exposing session data.

All room mutations derive the actor from the resolved session:

| Operation | Authorization |
| --- | --- |
| Create room | authenticated actor becomes `buchouId`; request body has no actor id |
| Preview or enqueue URL | authenticated, admitted actor; host or current `canPlaylist` guest permission |
| Delete queue item | authenticated, admitted actor; host or current `canPlaylist` guest permission |
| Read room / queue | remains public metadata so a shared room URL can be opened before admission |

The server validates the request Origin before accepting credentialed,
state-changing REST calls. `NODE_ENV=development` with no configured origin is
deliberately open for local/LAN development; an explicit
`HOUKAGO_CORS_ORIGIN` or non-development startup uses an exact configured
Kyoushitsu origin with credentials enabled. The Eden client consistently uses
`credentials: "include"`. This follows Elysia's credentialed-CORS
configuration. [Elysia CORS](https://elysiajs.com/plugins/cors)

## WebSocket authority

The WebSocket handshake resolves the same cookie and validates its Origin.
`senderId` and `nickname` are removed from the connection query and are never
trusted from client envelopes. A connection owns a resolved `seitoId` and
username. The hub uses that server-derived actor to:

- decide host role and room admission;
- populate presence names and role snapshots;
- check `KENGEN`, `SETTEI`, `NYUUSHITSU_*`, `SHINKOU`, and `JOUEI` permissions;
- restamp client-originated chat/danmaku broadcasts with the authenticated id.

An authenticated actor becomes eligible for REST room mutations only after an
admitted socket for that actor is present in the room. This preserves the
existing admission model and prevents a logged-in but non-member account from
driving a room through REST. Reconnect continues to use the one WS client and
derives its new socket identity from the cookie.

## Frontend flow and UX

The entry route first resolves `/seitoshou/me`. Unauthenticated visitors see a
single-column sign-in form with a progressive-disclosure registration action;
authenticated visitors see the existing join/create room controls using their
account name. There is no account profile page in this slice.

Forms retain the warm semantic tokens and existing responsive shell, with:

- visible username and password labels, appropriate autocomplete values, and an
  accessible show/hide password button;
- 44px controls, keyboard-native submission, visible focus, disabled/loading
  submit state, and field-adjacent `role="alert"` errors;
- generic invalid-credential feedback, no account-enumeration disclosure, and
  a clear retry path;
- no new decorative motion; existing reduced-motion behavior remains intact.

The shared identity store owns only public account/session restoration state;
the room store receives the authenticated identity as server truth. `addedBy`
is removed from form props and composables because it is server derived.

## Compatibility, rollout, and rollback

- This is a deliberate development-data reset. No automatic migration, UUID
  claim, or silent deletion occurs. The operator resets the old database before
  starting the new version.
- Existing public source resolver/proxy contracts and URL-first boundary remain
  unchanged. Authentication cookies never flow to third-party upstreams.
- Rolling back code requires restoring a compatible pre-auth database; it is
  not safe to point older UUID-based code at a newly initialized auth database.
- Production deployment must set a stable allowed frontend origin and use HTTPS
  so the session cookie is `Secure`; development deliberately accepts all
  origins unless `HOUKAGO_CORS_ORIGIN` is set.

## Validation and security cases

- Registration stores an Argon2id hash and returns no password or raw session
  token; duplicate usernames fail without corrupting rows.
- Sign-in, sign-out, expired session, malformed cookie, and refresh restoration
  are covered.
- REST actor fields cannot be supplied or forged; unauthenticated,
  unadmitted, and playlist-forbidden actors cannot preview/enqueue/delete.
- A WebSocket query or envelope cannot impersonate another account; the server
  broadcasts the authenticated actor only.
- Browser coverage proves registration/sign-in, reload restoration, room create,
  and a forbidden queue mutation at desktop and phone widths.
