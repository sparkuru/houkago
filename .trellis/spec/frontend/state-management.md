# State Management

> How state is managed in this project.

---

## Overview

- **Library:** Pinia (Vue's standard store). synctv-web organizes room/movie
  state in stores (`stores/room.ts`) and that organization is the structural
  reference (design §3 part 3) — the code is not copied.
- The defining trait of this app is **server-authoritative realtime state**:
  playback progress, presence, chat, danmaku, and the 番組表 all originate from
  housou over WebSocket. The frontend's job is to *reflect* authority state, not
  to be the source of truth (design §5, host-authority model).

---

## State Categories

- **Server realtime state (Pinia, fed by WS):** current 演目 (上映中), authoritative
  `Shinkou`, presence count (出席数), 番組表 queue, member list. Updated by the WS
  client when envelopes arrive; components read it.
- **Local UI state (component `ref`):** open/closed panels, input drafts,
  selected danmaku source, hover state. Never promote to a store.
- **Cross-component derived state (`computed` / store getters):** e.g. "am I the
  部長", projected playback time. Derive, do not duplicate.
- **URL state (router):** current 部室 id, browse query.

---

## When to Use Global State

Promote to a Pinia store only when **both**: the state is shared by components
that are not in a parent/child line, **and** it represents room/session truth
(not transient UI). Concretely:

- `useBushitsuStore` — current room, members, host id, presence, 番組表.
- `useShinkouStore` (or inside bushitsu) — last authoritative `Shinkou` +
  `shinkouServerTime` for projected-progress and drift math.
- `useDanmakuStore` — merged danmaku tracks (live chat + file + fetched),
  current source selection (design §7 priority chain).

Anything that is purely one component's view concern stays a local `ref`.

---

## Server State

- The **WS client (`src/ws/`) is the writer.** Incoming `houkago-kousoku`
  envelopes (`GENJOU`, `SHINKOU`, `JOUEI`, `BANGUMI`, `SHUSSEKI`, `OSHABERI`,
  `DANMAKU`) are decoded and committed to stores via store actions. UI never
  writes server-truth fields directly.
- `BANGUMI` is a full queue snapshot, not a patch. Commit it into
  `useBushitsuStore.bangumi`; room views may optimistically set the same store
  after their own REST write, but must still accept the socket snapshot so host
  and guest stay in sync without refresh.
- **Host-authority on the client:** only the 部長's player events emit `SHINKOU`.
  When applying a remote `SHINKOU`, set `tsuijuuChuu`（追従中）to suppress the echo
  for ~200ms so the resulting local player event is not re-broadcast (design §5).
- **Projected progress is derived, not stored as a ticking value:** compute
  `projected = shinkou.currentTime + (isPlaying ? (now - shinkouServerTime) *
  rate : 0)` on read. Store the last `Shinkou` + its server time, not a value you
  have to keep updating every frame.
- REST-fetched data (room metadata, enmoku details) flows through the Eden client
  into stores; realtime updates then mutate the same store.

### Realtime Chat vs Danmaku Streams

- `OSHABERI` and `DANMAKU` are separate realtime streams even though they share
  the same websocket transport and the same room-level `chat` permission gate.
- `useBushitsuStore.chat` stores chat-panel lines from `OSHABERI` only.
- `useBushitsuStore.danmaku` stores realtime overlay lines from `DANMAKU` only.
- `DanmakuOverlay` reads `bushitsu.danmaku`; it must not watch `chat` as a
  shortcut. Chat may later be mirrored into danmaku by an explicit product
  decision, but the store streams remain separate.

```ts
// Good: each envelope commits to its own server-truth stream.
case "OSHABERI":
  chat.value.push({ senderId: msg.senderId, content: msg.payload.content, ts: msg.ts })
  break
case "DANMAKU":
  danmaku.value.push({ senderId: msg.senderId, content: msg.payload.content, ts: msg.ts })
  break
```

**Tests required:** store tests must assert that applying `OSHABERI` does not
append to `danmaku`, and applying `DANMAKU` does not append to `chat`. Backend
WS tests should cover `DANMAKU` room broadcast and the shared chat-permission
rejection path.

---

## Common Mistakes

- Treating the client as the source of truth for playback — leads to fights with
  the authority state. The client follows; only the host drives.
- Keeping 番組表 as a component-local `ref` only. A REST delete by another client
  will not reach that component unless `BANGUMI` is committed into the room store.
- Forgetting `tsuijuuChuu` echo suppression → applying a remote `SHINKOU` fires a
  local seek/play event that gets broadcast back, causing oscillation.
- Storing a continuously-incremented `currentTime` in a store instead of deriving
  projected time on read → drift and extra reactivity churn.
- Putting transient UI flags in a global store → unnecessary cross-component
  coupling and re-renders.
- Rendering chat messages as realtime danmaku by watching `chat` in
  `DanmakuOverlay` → the product loses the ability to distinguish chat history
  from actual `DANMAKU` events.
