# Quality Guidelines

> Code quality standards for backend development.

---

## Overview

Stack: **Bun + Elysia.js**, TypeScript strict, `bun:sqlite`, TypeBox for
validation, Eden Treaty for compile-time contract sharing with the frontend
(design §8, Elysia spike). Quality here means: the contract is the single source
of truth, the sync core is correct, and the control plane never touches media.

---

## Build & Run (this project)

**The host has no `bun`.** All bun/bunx/test/dev commands run inside the
`oven/bun:1` container via the repo-root `./dx` wrapper (repo mounted at `/app`,
uid-mapped so artifacts stay owned by you):

```
./dx bun install
./dx bun run typecheck      # bun run --filter '*' typecheck
./dx bun run lint           # biome check .
./dx sh -c 'cd packages/housou && bun test'
```

`./dx` publishes ports 3000 (housou) and 5173 (kyoushitsu/vite), so **two `./dx`
invocations cannot run concurrently** — they would re-bind the same ports. When a
check needs a server plus a client (WS echo, REST round-trip), run both inside
one `./dx sh -c '...'`: background the server, run the driver/asserts, then kill.
Container services must listen on `0.0.0.0` to be reachable from the host
(`app.listen({ hostname: "0.0.0.0", port })`).

---

## Forbidden Patterns

- **CJK in identifiers.** Code identifiers are romaji ASCII; 汉字 only in comments
  and docs (design §12.1). `class Bushitsu // 部室`, never `class 部室`.
- **Synonym drift.** One concept, one name from the design §13 dictionary. Never
  introduce `Member`/`User` alongside `Buin`, or `Movie` alongside `Enmoku`.
- **Media bytes in housou.** The control plane must not proxy or buffer streams —
  that is `eisha`'s job (design §2). No fetch-and-pipe of media in housou.
- **`any` and unchecked casts** to bypass the TypeBox/Eden contract. If types
  fight you, fix the schema in `kousoku`, do not cast around it.
- **SQL string interpolation** with user input (see database-guidelines.md).
- **Redefining shared types locally** instead of importing from `houkago-kousoku`.
- **Empty `catch {}`** / swallowed errors (see error-handling.md).
- **Comment noise.** No restating-the-code comments, no commented-out blocks, no
  decorative banners. Comments explain *why* / non-obvious domain intent only.

---

## Required Patterns

- **Schema-first I/O.** Every REST body and the WS envelope is a TypeBox schema;
  the schema lives in or derives from `houkago-kousoku`. Handlers receive
  already-validated input.
- **Thin transport, fat domain.** Routes / WS handlers parse + delegate; logic
  lives in `domain/`, I/O in `db/`.
- **Room broadcast via Bun pub/sub topics** `room:<bushitsuId>`. From WS context
  use `ws.publish(topic, msg)`; from HTTP handlers use the destructured
  `server.publish(...)`; from timers/non-request context use
  `app.server?.publish(...)` (Elysia spike #781 PASS). Do not hand-maintain a
  per-room connection array for fan-out.
- **Export `type App = typeof app`** from housou so the frontend gets end-to-end
  types via `treaty<App>()`. Keep this export working — it is the contract.
- **Host-authority enforced server-side.** Only 部長 events mutate sync state;
  reject others (design §5). Never trust the client to self-limit.

---

## Testing Requirements

- The **sync state machine is the one true hard part** (design §5/§11) and must
  have unit tests: projected-progress math (`projected = currentTime +
  (isPlaying ? (now - shinkouServerTime) * rate : 0)`), drift tiers (>1.5s hard
  seek, 0.3–1.5s soft rate nudge, ≤0.3s ignore), and host-authority rejection.
- Use `bun test`. Domain logic must be testable without a live socket — keep
  sync math pure (input state → decision), separate from transport.
- WS contract behavior (validation → error event, room isolation, presence) is
  covered by integration tests against a running Elysia instance, mirroring the
  spike driver.

## Scenario: WebSocket Room Admission Gate

### 1. Scope / Trigger

- Trigger: any change to room entry, guest waiting, host approval, or room-level
  policy over the `/ws` transport.
- Admission is a **server-side gate before roster join**. A socket that is not
  admitted must not subscribe to `room:<bushitsuId>` and must not broadcast chat,
  playback, source, or heartbeat messages into the room.

### 2. Signatures

- Shared protocol source: `packages/kousoku/src/messages.ts`.
- `NYUUSHITSU` S→C payload:
  `{ mode: "open" | "approval" | "closed", status: "entered" | "waiting" | "rejected" | "closed", pending: { senderId: string, nickname: string, requestedAt: number }[] }`
- `NYUUSHITSU_SETTEI` C→S payload:
  `{ mode: "open" | "approval" | "closed" }`
- `NYUUSHITSU_HANTEI` C→S payload:
  `{ senderId: string, approved: boolean }`

### 3. Contracts

- `mode=open`: guest is admitted immediately, then receives `SHUSSEKI`,
  `KENGEN`, and `NYUUSHITSU(status="entered")`.
- `mode=approval`: guest remains pending and receives
  `NYUUSHITSU(status="waiting")`; the socket is kept alive but not subscribed to
  the room topic. The 部長 receives pending requests in `NYUUSHITSU.pending`.
- `mode=closed`: guest receives `NYUUSHITSU(status="closed")` and is not added
  to roster.
- The 部長 (`senderId === buchouId`) is always admitted and is the only actor
  allowed to send `NYUUSHITSU_SETTEI` or `NYUUSHITSU_HANTEI`.
- Room-level admission mode is in-memory per room id and is not tied to the
  部長's online status. Pending requests are removed when the waiting socket
  closes.

### 4. Validation & Error Matrix

- Malformed envelope -> `KEIHOU("invalid envelope")`, connection remains usable.
- Non-部長 sends `NYUUSHITSU_SETTEI` -> `KEIHOU` with `NotBuchou`.
- Non-部長 sends `NYUUSHITSU_HANTEI` -> `KEIHOU` with `NotBuchou`.
- Not-yet-admitted socket sends room action (`OSHABERI`, `SHINKOU`, `JOUEI`,
  `OIKAKE`, etc.) -> `KEIHOU` with `Forbidden`; do not broadcast.

### 5. Good/Base/Bad Cases

- Good: approval-mode guest waits, sends no room traffic, then receives
  `entered` + current room snapshots after host approval.
- Base: default `open` preserves current direct-link behavior.
- Bad: adding a pending guest to `SHUSSEKI` before approval, or subscribing them
  to `room:<id>`, leaks room state and allows unauthorized room actions.

### 6. Tests Required

- Unit-test the admission state module: default mode, set/clear, pending grouping,
  pending connection removal.
- WS e2e-test default open, closed rejection, approval wait, approval admit,
  host-offline pending visibility after reconnect, and non-host rejection.
- Frontend store test: applying `NYUUSHITSU` updates mode, own status, and
  pending request list.

### 7. Wrong vs Correct

#### Wrong

```ts
// Pending guest is treated like a room member.
ws.subscribe(roomTopic(bushitsuId))
join(bushitsuId, senderId, nickname)
```

#### Correct

```ts
// Pending guest gets a private admission status only; room join happens after
// the 部長 approves.
addPendingNyuushitsu(bushitsuId, ws.id, senderId, nickname)
ws.send(serverMsg("NYUUSHITSU", { mode: "approval", status: "waiting", pending: [] }))
```

---

## Code Review Checklist

- [ ] Identifiers romaji; domain terms match the §13 dictionary (no synonyms).
- [ ] Shared types imported from `kousoku`, not redefined.
- [ ] REST/WS input validated by TypeBox; no manual shape checks duplicating it.
- [ ] No media bytes / proxying in housou.
- [ ] Broadcast uses `room:<id>` pub/sub, correct publish path for the context.
- [ ] Sync changes come with tests for the affected drift/authority case.
- [ ] No secrets or user message content logged.
- [ ] Comments justify *why*; no noise (see `common` skill).
