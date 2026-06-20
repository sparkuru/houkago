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

## Scenario: Bangumi Queue and Source Switch Sync

### 1. Scope / Trigger

- Trigger: any change to 番組表 (`enmoku`) create/delete, `BANGUMI` realtime
  snapshots, or `JOUEI` source switching.
- 番組表 is server-authoritative realtime state: a REST write must update storage
  and broadcast the latest queue to every admitted socket in `room:<bushitsuId>`.

### 2. Signatures

- REST create: `POST /bushitsu/:id/enmoku` -> `Enmoku`
  - legacy body:
    `{ title: string, type: Enmoku["type"], url: string, headers?, subtitles?, sources?, danmaku?, live?, addedBy: string }`
  - resolver body: `{ sourceUrl: string, title?: string, headers?: Record<string, string>, addedBy: string }`
- REST delete: `DELETE /bushitsu/:id/enmoku/:enmokuId` -> `{ ok: true }`
- WS queue snapshot: `BANGUMI { enmoku: Enmoku[] }`
- WS source switch: `JOUEI { enmokuId: string }`, followed by
  `GENJOU { enmokuId, shinkou, serverTime }`

### 3. Contracts

- REST create/delete must call domain/db first, then broadcast
  `BANGUMI` with the full latest `fetchBangumi(bushitsuId)` result.
- Resolver-body create must call `houkago-eisha.resolveUrlWithMetadata`
  server-side and store the returned stable proxy URL plus any parser-produced
  metadata in the queued `Enmoku`. The frontend dev direct-link form submits
  `sourceUrl`; it must not infer HLS/DASH type, parse manifests, or build proxy
  tokens itself.
- Create/list/BANGUMI must preserve optional `Enmoku` metadata:
  `headers`, `subtitles`, `sources`, `danmaku`, and `live`. Missing metadata
  remains `undefined`, not empty containers or default `false`.
- Legacy create remains supported for internal tests and callers that already
  have a fully resolved `Enmoku` source.
- From HTTP handlers, `server.publish(topic, ...)` must send a serialized JSON
  string. Passing a raw object produces `"[object Object]"` for websocket clients.
- `JOUEI` resets authoritative transport to `{ isPlaying: false, currentTime: 0,
  playbackRate: 1 }` with a fresh `shinkouServerTime`, then broadcasts `JOUEI`
  and a server-stamped `GENJOU`. Do not reuse the previous source's play/time
  state for the new media.

### 4. Validation & Error Matrix

- Delete missing `enmokuId` in an existing room -> `ENMOKU_NOT_FOUND` / HTTP 404.
- Delete in a missing room -> `BUSHITSU_NOT_FOUND` / HTTP 404.
- Resolver-body create with non-http(s) `sourceUrl` -> `EISHA_BAD_REQUEST` /
  HTTP 400.
- Malformed create body -> validation error / HTTP 422.
- Unauthorized `JOUEI` -> `FORBIDDEN` / `KEIHOU`; do not update authority state
  or broadcast `JOUEI`/`GENJOU`.

### 5. Good/Base/Bad Cases

- Good: guest with playlist permission deletes an item; host and all guests
  receive the same `BANGUMI` snapshot without refreshing.
- Good: frontend dev form posts `{ sourceUrl }`, server returns an `Enmoku` whose
  `url` is `/eisha/proxy/:token`, and the same full `BANGUMI` snapshot reaches
  connected clients.
- Good: a parser-produced `Enmoku` with headers/subtitles/sources/danmaku/live is
  returned from create, survives `GET /bangumi`, and appears unchanged in the
  BANGUMI snapshot.
- Base: adding a manual source still returns the created `Enmoku`, broadcasts the
  updated queue, and may then `JOUEI` it.
- Base: legacy `{ title, type, url }` create still works for tests and already
  resolved sources.
- Bad: source switch preserves old `Shinkou` (`isPlaying=true`, old timestamp),
  causing followers to autoplay/seek in the new source while the driver is
  paused.
- Bad: frontend guesses `.m3u8` and submits the raw upstream URL directly,
  bypassing eisha's proxy and m3u8 rewrite.

### 6. Tests Required

- REST/e2e: create/delete updates DB and delete broadcasts `BANGUMI` to active
  host + guest sockets.
- REST/e2e: resolver-body create returns a stable eisha proxy URL and decodes to
  the original `sourceUrl`.
- REST/e2e: resolver-body create broadcasts the full `BANGUMI` snapshot.
- REST/e2e: extended `Enmoku` metadata survives create/list and BANGUMI broadcast.
- REST/e2e: old minimal enmoku rows do not gain empty optional metadata fields.
- Frontend typecheck: dev direct-link form posts `sourceUrl` via the Eden client.
- Sync unit: `ShinkouSeigyo.jouei` resets transport to paused start.
- WS/e2e: after prior playing `SHINKOU`, `JOUEI` broadcasts a `GENJOU` whose
  `shinkou` is paused at `0`.

### 7. Wrong vs Correct

#### Wrong

```ts
server?.publish(roomTopic(id), serverMsg("BANGUMI", { enmoku }))
```

#### Correct

```ts
const msg = serverMsg("BANGUMI", { enmoku })
server?.publish(roomTopic(id), JSON.stringify(msg))
```

#### Wrong

```ts
// Frontend bypasses resolver and stores upstream media URL directly.
await housou.bushitsu({ id }).enmoku.post({ title, type: "hls", url: sourceUrl, addedBy })
```

#### Correct

```ts
// Housou owns queue mutation; eisha owns source resolution.
await housou.bushitsu({ id }).enmoku.post({ title, sourceUrl, addedBy })
```

#### Wrong

```ts
state.set(room, { enmokuId, shinkou: prev.shinkou, shinkouServerTime: prev.shinkouServerTime })
```

#### Correct

```ts
state.set(room, { enmokuId, shinkou: DEFAULT_SHINKOU, shinkouServerTime: Date.now() })
```

---

## Scenario: Eisha Resolver And Proxy Skeleton

### 1. Scope / Trigger

- Trigger: any change to `houkago-eisha`, stable media proxy URLs,
  `/eisha/proxy/:token`, resolver output, or upstream Range/seek behavior.
- `eisha` owns media-plane logic. `housou` may mount eisha's route for the v1
  co-deployed process, but media fetch/proxy code must remain in
  `packages/eisha`.

### 2. Signatures

- `resolveUrl(input, options) -> ResolvedEnmokuSource`
- `resolveUrlWithMetadata(input, options, fetcher?) -> Promise<ResolvedEnmokuSource>`
- `parseHlsManifest(manifest, options) -> Pick<Enmoku, "sources" | "subtitles" | "live">`
- `encodeProxyRef(ref) -> token`
- `decodeProxyRef(token) -> ProxyRef`
- `proxyUpstream(ref, request) -> Response`
- `rewriteM3u8Manifest(manifest, options) -> string`
- HTTP route: `GET /eisha/proxy/:token`

### 3. Contracts

- `ProxyRef`: `{ url: string, headers?: Record<string, string> }`.
- `url` must be `http:` or `https:`; reject all other protocols.
- Stable proxy URL format is `<proxyBase>/eisha/proxy/<base64url-json-token>`.
- `resolveUrl` stays synchronous and only performs URL validation, title/type
  inference, and stable proxy URL construction. Use it for fallback/simple
  resolution that must not touch the network.
- `resolveUrlWithMetadata` wraps `resolveUrl`; for non-HLS inputs it returns the
  same result, and for HLS inputs it fetches the upstream manifest and merges the
  Generic HLS parser output.
- Resolver type inference:
  - path ending `.m3u8` -> `Enmoku.type = "hls"`
  - path ending `.mpd` -> `Enmoku.type = "dash"`
  - otherwise -> `Enmoku.type = "direct"`
- Generic HLS parser output:
  - `#EXT-X-STREAM-INF` plus the next URI line becomes a `sources` item;
  - source names use `RESOLUTION` and/or rounded `BANDWIDTH` kbit/s labels;
  - `#EXT-X-MEDIA:TYPE=SUBTITLES,...,URI="..."` becomes a `subtitles` record
    entry with `type: "hls"`;
  - child playlist/subtitle URLs resolve relative to the parent manifest URL,
    are wrapped in stable `/eisha/proxy/:token` URLs, and preserve parent
    headers in the decoded `ProxyRef`;
  - master playlists leave `live` undefined; media playlists set `live: true`
    when `#EXT-X-ENDLIST` is absent and `live: false` when it is present.
- The proxy forwards the caller's `Range` header to upstream and preserves
  seek-relevant response headers: `accept-ranges`, `content-length`,
  `content-range`, `content-type`, plus cache validators when present.
- The proxy must not expose arbitrary upstream response headers by default.
- Full m3u8 playlist responses are text-rewritten by `eisha`:
  - ordinary non-comment URI lines resolve relative to the upstream playlist URL
    and become new `/eisha/proxy/:token` URLs;
  - HLS `URI="..."` attributes, including key/map/media references, are
    rewritten the same way;
  - rewritten child `ProxyRef` values preserve the parent `headers`;
  - non-http(s) URI values such as `data:` remain unchanged.
- Do not rewrite partial playlist responses. If the caller sends `Range`, keep
  the existing byte proxy behavior.
- Rewritten playlist responses must not forward stale upstream byte/cache
  validators such as `accept-ranges`, `content-range`, or `etag`. A hosting
  layer may compute a fresh `content-length`; tests should assert it is not the
  upstream stale value, not that it is always absent.

### 4. Validation & Error Matrix

- Malformed token -> `EISHA_BAD_REQUEST` / HTTP 400.
- Token decodes but lacks string `url` -> `EISHA_BAD_REQUEST` / HTTP 400.
- Upstream URL has unsupported protocol (`file:`, `ftp:`, etc.) ->
  `EISHA_BAD_REQUEST` / HTTP 400.
- `resolveUrlWithMetadata` HLS manifest fetch throws or returns non-OK ->
  `EISHA_UPSTREAM_ERROR` / HTTP 502.
- Proxy upstream fetch throws -> `EISHA_UPSTREAM_ERROR` / HTTP 502.
- Upstream returns non-2xx/3xx -> preserve upstream status and allowed headers;
  do not rewrite it to 500.
- Playlist contains malformed or unsupported URI -> leave that URI unchanged;
  do not fail the whole manifest.

### 5. Good/Base/Bad Cases

- Good: `.m3u8` input resolves to a stable proxy URL with type `hls`; a browser
  seek sends `Range`, upstream responds `206`, and the route returns `206` with
  `content-range`.
- Good: resolver-body create for a local HLS master playlist returns and
  persists `sources`/`subtitles` whose decoded proxy refs point at absolute child
  playlist URLs.
- Base: direct `.mp4` input through `resolveUrlWithMetadata` does not fetch
  upstream and returns the same proxy result as `resolveUrl`.
- Good: a proxied m3u8 manifest containing `seg-1.ts` and
  `#EXT-X-KEY:URI="key.bin"` returns proxy URLs whose decoded refs point at the
  upstream absolute segment/key URLs.
- Base: direct `.mp4` input resolves to type `direct` and is proxied with
  `content-type: video/mp4`.
- Bad: route logic in `housou` hand-fetches upstream media or buffers bytes;
  this violates the media-plane boundary and makes later eisha service split
  harder.
- Bad: `housou` parses HLS manifests itself or stores raw child playlist URLs
  without eisha proxy tokens; this leaks media-plane behavior into the control
  plane and bypasses header preservation.
- Bad: a rewritten playlist forwards upstream `content-range` / `etag` from the
  original body after changing the body text.

### 6. Tests Required

- `houkago-eisha` unit tests:
  - token round-trip and invalid-token rejection
  - non-http URL rejection
  - resolver type inference for direct/HLS/DASH
  - Generic HLS parser converts master `#EXT-X-STREAM-INF` entries into
    `sources` with decoded child proxy refs
  - Generic HLS parser converts subtitle `#EXT-X-MEDIA` URI entries into
    `subtitles`
  - Generic HLS parser marks media playlists live based on `#EXT-X-ENDLIST`
  - `resolveUrlWithMetadata` fetches HLS manifests and wraps fetch/non-OK
    failures as `EISHA_UPSTREAM_ERROR`
  - `Range` forwarding and allowed response header preservation
  - m3u8 URI-line and `URI="..."` attribute rewriting, including relative URL
    resolution, child header preservation, and non-http URI passthrough
  - rewritten m3u8 response headers do not retain stale byte headers
- `houkago-housou` e2e test:
  - mount `/eisha/proxy/:token`, proxy to a local upstream server, assert `206`,
    forwarded range evidence, and seek headers.
  - fetch a proxied local m3u8, assert its segment URL is rewritten to the same
    route, then fetch that rewritten segment URL through the proxy.
  - resolver-body create from a local HLS manifest persists parser-produced
    `sources` and `subtitles` through create response and `GET /bangumi`.

### 7. Wrong vs Correct

#### Wrong

```ts
// housou route owns the media fetch directly.
app.get("/eisha/proxy/:token", ({ params }) => fetch(decode(params.token).url))
```

#### Correct

```ts
// eisha owns decode + proxy; housou only composes the route.
export const app = new Elysia().use(eishaRoutes).use(bushitsuRoutes)
```

#### Wrong

```ts
// Rewritten body, stale upstream byte metadata.
return new Response(rewrittenManifest, { headers: upstream.headers })
```

#### Correct

```ts
// Rewritten playlist only keeps safe text-response headers.
return new Response(rewrittenManifest, { headers: rewrittenPlaylistHeaders })
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
