# Seitoshou Authentication and Room Authority

## Scenario: self-hosted account sessions

### 1. Scope / Trigger

- Trigger: any change to account registration, session resolution, room REST
  mutation, or WebSocket connection identity.
- `Seito` is the durable account; `Seitoshou` is a revocable, expiring server
  session. Browser-generated ids are never authority inputs.

### 2. Signatures

- `POST /seitoshou/register { username, password } -> Seito`
- `POST /seitoshou/sign-in { username, password } -> Seito`
- `POST /seitoshou/sign-out -> { ok: true }`
- `GET /seitoshou/me -> Seito`
- `POST /bushitsu { name } -> Bushitsu`
- `POST /bushitsu/:id/enmoku/preview`, `POST /bushitsu/:id/enmoku`, and
  `DELETE /bushitsu/:id/enmoku/:enmokuId` derive their actor from the session.
- `GET /ws?bushitsuId=<id>` has no client identity query fields.

### 3. Contracts

- Register/sign-in set `houkago_seitoshou` as an HttpOnly, `SameSite=Lax`,
  path-root cookie. JSON responses contain only the public `Seito` summary.
- SQLite stores Argon2id password hashes and SHA-256 session-token digests;
  neither raw passwords nor raw tokens belong in shared contracts, logs, or
  room data.
- Registration currently accepts any password content from 8 to 128 characters;
  letter-only and digit-only passwords are valid. The length bounds live in the
  authentication service so a future administrator configuration can replace
  them without changing route or client contracts.
- `NODE_ENV=development` with no `HOUKAGO_CORS_ORIGIN` accepts every frontend
  Origin for local/LAN development. `./dev.sh` and the housou `dev` script use
  this mode by default. Setting `HOUKAGO_CORS_ORIGIN` always restores a single
  exact credentialed origin; non-development startup defaults to
  `http://127.0.0.1:5173`. WebSocket and state-changing REST use the same rule.
- Source creation/deletion require a resolved session, a currently admitted
  socket for that account, and host or `canPlaylist` authority. Queue placement
  mutations (move and clear) are owner-only. `addedBy` and source headers are
  not client mutation inputs.
- WebSocket presence names, role checks, and client-originated envelope sender
  ids are derived/restamped from the authenticated account.

### 4. Validation & Error Matrix

| Condition | Result |
| --- | --- |
| Missing, malformed, expired, or revoked cookie | `UNAUTHORIZED` / 401; WS closes with policy violation |
| Wrong state-changing Origin outside open development | `FORBIDDEN` / 403; WS closes with policy violation |
| Any Origin in development without `HOUKAGO_CORS_ORIGIN` | Credentialed CORS preflight and REST/WS origin validation accept it |
| Duplicate normalized username | `SEITO_CONFLICT` / 409 |
| Invalid username/password shape | `SEITO_INVALID` / 422 |
| Password shorter than 8 or longer than 128 characters | `SEITO_INVALID` / 422 |
| Authenticated but not admitted queue actor | `FORBIDDEN` / 403 |
| Admitted guest without playlist permission | `FORBIDDEN` / 403 |

### 5. Good / Base / Bad Cases

- Good: a signed-in host creates a room, opens its authenticated socket, then
  queues a public URL; the server writes the host account id as `addedBy`.
- Base: an authenticated visitor can read public room metadata before entering,
  but cannot mutate its queue until admission succeeds.
- Bad: a request sends `buchouId`, `addedBy`, `senderId`, `nickname`, or an
  `Authorization` source header and the server treats it as authority.

### 6. Tests Required

- Backend E2E: registration/sign-in/me/sign-out, expiry/revocation helpers,
  duplicate usernames, 8-character letter-only and digit-only password
  acceptance, too-short password rejection, untrusted Origin, REST
  admission/playlist gates, and WebSocket sender restamping.
- Origin tests must prove both modes: an explicit origin accepts only that exact
  value, while development with no configured origin reflects any frontend
  origin with credentials.
- Existing room/sync/admission E2E fixtures must create real cookie accounts;
  never restore a query-string identity shortcut for tests.
- Frontend: login/register, page-reload restoration, account-gated room entry,
  and WebSocket reconnect URL lacking identity fields.
- Playwright: registration, reload restoration, room creation, and the
  responsive authenticated room path at supported desktop and mobile projects.

### 7. Wrong vs Correct

#### Wrong

```ts
client.connect(roomId, localStorage.getItem("houkago.buinId") ?? "anon", nickname)
await housou.bushitsu.post({ name, buchouId })
```

#### Correct

```ts
await housou.bushitsu.post({ name })
client.connect(roomId) // browser sends the HttpOnly session cookie
```

#### Wrong: restore an undocumented composition rule

```ts
if (password.length < 12 || !/[A-Z]/.test(password)) reject()
```

#### Correct: keep the current operator-changeable boundary in one place

```ts
if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) reject()
```

#### Wrong: open credentialed CORS outside development

```ts
cors({ origin: true, credentials: true }) // when NODE_ENV is production
```

#### Correct: open only the development startup path, or configure production

```sh
./dev.sh # accepts all development origins
HOUKAGO_CORS_ORIGIN=https://houkago.example.test bun run start
```

## Scenario: durable room membership and owner roster

### 1. Scope / Trigger

- Trigger: changing room admission, membership, owner-only management, the
  `MEIBO` protocol, or the membership SQLite schema.
- Membership is durable authorization; presence, admission configuration, and
  guest permission switches remain process-local realtime state.

### 2. Signatures

- SQLite: `bushitsu_buin(bushitsu_id, seito_id, joined_at)` with composite
  primary key and foreign keys to `bushitsu` and `seito`.
- `DELETE /bushitsu/:id/meibo/:seitoId -> { ok: true }`.
- `MEIBO { members: Array<{ id, username, joinedAt, yakuwari }> }` is a
  server-to-owner WebSocket envelope.
- `NYUUSHITSU` may carry `status: "revoked"`; that literal belongs to the
  status schema, never the admission-mode schema.

### 3. Contracts

- Creating a room inserts its owner and durable membership in one database
  transaction. Successful admission `ensureBuin`s the authenticated account.
- A durable owner/member reconnects regardless of the current first-entry
  admission mode. An unknown account still follows open/approval/closed/password
  admission; removal is not a ban, so open mode may admit that account again.
- `MEIBO` is targeted only to admitted connections for the room owner, never
  published on `room:<id>`. It refreshes after admission and removal.
- An owner removal derives both actor and target from the authenticated REST
  request/path, sends the target `NYUUSHITSU/revoked`, closes every matching
  room socket with code `1008`, then refreshes `SHUSSEKI` and the owner roster.

### 4. Validation & Error Matrix

| Condition | Result |
| --- | --- |
| Missing session or untrusted mutation Origin | `UNAUTHORIZED` / 401 or `FORBIDDEN` / 403 |
| Authenticated actor is not the room owner | `FORBIDDEN` / 403 |
| Owner tries to remove self | `FORBIDDEN` / 403 |
| Target is not a durable member | `BUIN_NOT_FOUND` / 404 |
| Revoked online member | `NYUUSHITSU { status: "revoked" }`, then WS close 1008 |

### 5. Good / Base / Bad Cases

- Good: the owner removes a connected member; remaining viewers receive a fresh
  `SHUSSEKI`, and only the owner receives the reduced `MEIBO` snapshot.
- Base: an owner can reconnect and receive its current private roster; a member
  reconnects directly because membership is durable.
- Bad: broadcasting `MEIBO` to the room, trusting a client sender id, or deleting
  the owner membership and leaving an orphaned room.

### 6. Tests Required

- Database/domain: owner creation is atomic, membership checks are scoped by
  room, and deletion reports a missing target.
- WS/REST E2E: prove owner-only roster privacy, non-owner rejection, owner-self
  rejection, post-removal `MEIBO`/`SHUSSEKI` refresh, `revoked` before close, and
  close code 1008. Include multi-connection and open-mode re-entry when those
  paths change.
- Frontend store: applying `MEIBO` records the typed durable roster; revoked
  routing must deliberately close the reconnecting client.

### 7. Wrong vs Correct

#### Wrong

```ts
server.publish(roomTopic(roomId), serverMsg("MEIBO", { members }))
```

#### Correct

```ts
for (const ownerSocket of admittedOwnerSockets(roomId)) {
  ownerSocket.send(serverMsg("MEIBO", { members: fetchMeibo(roomId) }))
}
```

## Scenario: owner-managed queue placement

### 1. Scope / Trigger

- Trigger: changing queue order, clearing, `BANGUMI`, or queue-placement
  persistence.
- `Enmoku` remains the reusable playable-source record; its placement belongs to
  `bangumi_entry` so a later member-collaboration policy can govern placement
  without changing the shared `Enmoku`/`BANGUMI` shape.

### 2. Signatures

- SQLite: `bangumi_entry(enmoku_id PRIMARY KEY, bushitsu_id, sort_key)` and
  `bangumi_entry_room_order(bushitsu_id, sort_key, enmoku_id)`.
- `POST /bushitsu/:id/bangumi/:enmokuId/move { direction: "up" | "down" } -> { ok: true }`.
- `DELETE /bushitsu/:id/bangumi/pending -> { ok: true, removed: number }`.
- Successful mutation publishes `BANGUMI { enmoku: Enmoku[] }` to every admitted
  room socket; it is a full ordered snapshot, not a queue patch.

### 3. Contracts

- Bootstrap backfills one placement per legacy `enmoku` using
  `(created_at ASC, id ASC)`. Every new source write inserts its source and
  placement in one transaction.
- Move swaps the target with its immediate ordered neighbour. Moving past either
  boundary is a successful no-op that still publishes the authoritative snapshot.
- Clear deletes every non-current source. Current means
  `shinkouSeigyo.genjou(roomId).enmokuId`; it may be moved but is never removed
  by this endpoint, so playback continues uninterrupted.
- REST has no source WebSocket: publish through one admitted room socket and
  explicitly echo that publisher once. Do not keep a second ad-hoc fan-out list.

### 4. Validation & Error Matrix

| Condition | Result |
| --- | --- |
| Missing session | `UNAUTHORIZED` / 401 |
| Untrusted Origin or admitted non-owner | `FORBIDDEN` / 403 |
| Target room or enmoku does not exist | `BUSHITSU_NOT_FOUND` or `ENMOKU_NOT_FOUND` / 404 |
| Move at first/last position | `200 { ok: true }` plus unchanged `BANGUMI` snapshot |
| Clear with no current source | All entries removed; `removed` equals prior queue length |

### 5. Good / Base / Bad Cases

- Good: the owner moves a source; both owner and admitted member render the same
  snapshot immediately, while only the owner sees management controls.
- Base: clearing a queue with no selected current source removes all entries.
- Bad: storing order on `enmoku`, deleting the current source on clear, trusting
  a client role flag, or applying an optimistic client reorder as final truth.

### 6. Tests Required

- DB bootstrap: a pre-placement database backfills deterministic source order.
- REST/WS E2E: unauthenticated, unadmitted, and non-owner mutations reject;
  owner move/clear send one full snapshot to owner and member; boundary moves
  remain no-ops; clear preserves `GENJOU.enmokuId` and playback state.
- Playwright at phone and desktop breakpoints: owner controls reorder and clear;
  members never receive those controls; both views converge after each snapshot.

### 7. Wrong vs Correct

#### Wrong

```ts
enmoku.sortKey = index
await moveRequest()
store.bangumi = locallyReorderedQueue
```

#### Correct

```ts
moveEnmoku(roomId, enmokuId, direction) // swaps bangumi_entry.sort_key atomically
broadcastRoom(roomId, serverMsg("BANGUMI", { enmoku: fetchBangumi(roomId) }))
// clients accept the full BANGUMI snapshot as final truth
```
