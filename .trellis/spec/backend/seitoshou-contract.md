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
- Queue REST mutations require a resolved session, a currently admitted socket
  for that account, and host or `canPlaylist` authority. `addedBy` and source
  headers are not client mutation inputs.
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
