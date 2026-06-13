# Error Handling

> How errors are handled in this project.

---

## Overview

Two distinct error channels, because the backend serves two transports:

1. **REST (Elysia HTTP)** — standard HTTP status + JSON body.
2. **WebSocket sync** — errors travel back as a `KEIHOU`（警報）envelope
   (design §4), never as a silent drop or a connection kill.

Validation is **schema-first**: REST bodies and the WS envelope are validated by
TypeBox before any handler logic runs. A malformed message produces a structured
validation error, not a thrown exception deep in domain code (proven in the
Elysia spike, P3).

---

## Error Types

- Define domain errors as classes extending `Error` in `src/lib/errors.ts`, each
  with a stable `code` string consumers can switch on:
  - `BushitsuNotFound`, `NotBuchou` (caller is not 部長 / lacks authority),
    `EnmokuNotFound`, `Unauthorized` (生徒証 invalid).
- Generic/unexpected failures stay as plain `Error` and become HTTP 500 /
  `KEIHOU` "internal error" — never expose internals to the client.

```ts
// src/lib/errors.ts
export class NotBuchou extends Error {       // 部長権限なし：only the host may drive sync
  code = "NOT_BUCHOU" as const
}
```

---

## Error Handling Patterns

- **Validate at the edge.** TypeBox schema on every REST route and on the WS
  `body`. Do not hand-roll `if (!field)` checks for shape — the schema is the
  contract (shared via Eden Treaty / kousoku).
- **Throw typed errors in domain code**, catch centrally. Use Elysia's
  `app.onError` to map error `code` → HTTP status / WS `KEIHOU`. Handlers and
  domain functions throw; they do not build response bodies.
- **Host authority is an error case, not a silent no-op.** A 部員 trying to drive
  playback gets a `NotBuchou` → `KEIHOU`, so the client knows the action was
  rejected (design §5).
- **Never swallow.** No empty `catch {}`. If you catch to add context, rethrow.

---

## API Error Responses

REST error body is uniform:

```json
{ "error": { "code": "NOT_BUCHOU", "message": "only 部長 may control playback" } }
```

Status mapping: `*_NOT_FOUND` → 404, `UNAUTHORIZED` → 401, `NOT_BUCHOU` /
permission → 403, validation → 422, anything unmapped → 500 (generic message).

WS errors use the `KEIHOU` envelope:

```ts
{ type: "KEIHOU", ts, senderId: "server", payload: { message } }  // 警報 = ERROR
```

---

## Common Mistakes

- Killing the WS connection on a bad message instead of returning `KEIHOU` — a
  late/buggy client should be told, not disconnected (design §4/§5).
- Leaking driver/stack details into client responses.
- Manually re-validating shapes already covered by the TypeBox schema → drift
  between the real check and the shared contract.
- Catching, logging, and continuing as if nothing failed — half-applied sync
  state is worse than a clean `KEIHOU`.
