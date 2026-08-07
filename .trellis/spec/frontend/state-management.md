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
- **Room layout modes are local UI state:** `cinemaMode` / chat-open flags live
  in `BushitsuView` as refs. ArtPlayer's `fullscreenWeb` is pure-player
  fullscreen and intentionally does not include the chat panel; any "video left,
  chat right" mode must be a room layout mode that emits from `EnmokuPlayer` and
  is applied by the parent view.
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
  envelopes (`GENJOU`, `SHINKOU`, `JOUEI`, `BANGUMI`, `SHUSSEKI`, `MEIBO`,
  `OSHABERI`, `DANMAKU`) are decoded and committed to stores via store actions. UI never
  writes server-truth fields directly.
- `BANGUMI` is a full queue snapshot, not a patch. Commit it into
  `useBushitsuStore.bangumi`; room views keep it authoritative rather than
  finalizing a local reorder, so host and guest converge without refresh.
- `BANGUMI` / `setBangumi` must normalize by `Enmoku.id` at the store boundary.
  REST create/delete can race with WS snapshots, and dev/manual source flows may
  be tempted to append locally after a POST. Deduping by id in the store prevents
  transient duplicate rows while preserving the first occurrence order.
- Parser-produced `Enmoku` metadata is server state, but per-client source
  selection is not. Until the protocol grows a room-authoritative source-track
  field, `sources` selection stays local component state and only changes the
  URL passed into the local `EnmokuPlayer`; it must not mutate `Enmoku`, write to
  Pinia, or emit `JOUEI`/`SHINKOU` by itself.
- `Enmoku.sources` may contain legacy duplicate codec variants for the same
  quality. The source-choice view model should collapse labels that differ only
  by trailing codec (`avc1`/`hev1`/`hvc1`/etc.) and keep the first source index.
  It should hide explicit non-AVC video choices such as `hvc1`/`hev1`, so old
  queued Bilibili items do not expose audio-only codec variants.
- **Host-authority on the client:** only the 部長's player events emit `SHINKOU`.
  When applying a remote `SHINKOU`, set `tsuijuuChuu`（追従中）to suppress the echo
  for ~200ms so the resulting local player event is not re-broadcast (design §5).
- **Projected progress is derived, not stored as a ticking value:** compute
  `projected = shinkou.currentTime + (isPlaying ? (now - shinkouServerTime) *
  rate : 0)` on read. Store the last `Shinkou` + its server time, not a value you
  have to keep updating every frame.
- REST-fetched data (room metadata, enmoku details) flows through the Eden client
  into stores; realtime updates then mutate the same store.
- When an initial REST queue read races a later `BANGUMI` frame, do not let the
  older HTTP result overwrite the received snapshot. Capture the current queue
  array before starting the read and commit its response only if that reference
  has not changed while awaiting it.
- Parser-produced `Enmoku.provider` is server state and arrives through the same
  `BANGUMI` snapshots as playback metadata. UI-specific provider popover/dialog
  open state stays local to the route component.
- Fetched danmaku cues derived from `Enmoku.danmaku` are local view state until a
  dedicated `useDanmakuStore` exists. Cache them by `Enmoku.id` in the room view
  or future danmaku store; do not write fetched cues back into `Enmoku` or
  broadcast them over `BANGUMI`.

### WebSocket Reconnect Recovery

#### 1. Scope / Trigger

- Trigger: any change to `src/ws/client.ts`, room connection status, browser
  online/offline handling, manual retry UI, or reconnect-time room/bootstrap
  behavior.
- Reconnect is frontend-owned transport recovery around the existing `/ws`
  protocol. It must not introduce a second room-state source of truth.

#### 2. Signatures

- `KousokuClient.connect(bushitsuId: string)` stores the latest room id for
  same-tab reconnect. The browser cookie authenticates every handshake; no
  sender id or nickname belongs in the URL.
- `KousokuClient.close()` is deliberate shutdown: it cancels retry timers, clears
  pending sends, and must not reconnect.
- Connection status remains the existing
  `"connecting" | "open" | "closed" | "error"` union.

#### 3. Contracts

- Unexpected socket `close` schedules bounded backoff reconnect with the same
  `bushitsuId` and the current authenticated cookie.
- Browser `offline` actively drops the current socket and reports closed; browser
  `online` reconnects immediately when the room view is still mounted.
- A successful reconnect relies on the existing server `open`/`admit` snapshots:
  `SHUSSEKI`, `KENGEN`, `NYUUSHITSU`, plus private `MEIBO` only for the owner.
- `NYUUSHITSU { status: "revoked" }` is deliberate access revocation, not a
  transient close: call `client.close()` to cancel automatic reconnect, then
  route home with an explanatory local notice. Do not retain or locally edit the
  durable roster; wait for the server's next `MEIBO` snapshot.
- Room information and connection status must be visible to all admitted
  viewers. Host-only settings such as admission mode, guest permissions, and
  pending approvals remain gated by `isBuchou`.
- Non-host room views must repeat the existing `OIKAKE -> GENJOU` catch-up after
  reconnect. Do not invent a parallel playback recovery path in components.
- The send queue only covers the active socket's `CONNECTING -> OPEN` window.
  If that socket closes before opening, queued sends are dropped; offline command
  replay is out of scope.

#### 4. Validation & Error Matrix

- Malformed or rejected room actions still travel over WS as `KEIHOU`; reconnect
  must not mask domain errors.
- Manual route unmount / `close()` -> no reconnect, no replay.
- Browser offline -> socket is deliberately closed locally; playback controls
  from peers must not continue to arrive over a stale socket.
- Dead server / network failure -> capped retry delay, no hot loop.

#### 5. Good/Base/Bad Cases

- Good: HMR or a transient network drop closes the socket; the client reconnects,
  receives admission/permission/presence snapshots, then a viewer catches up via
  `OIKAKE`.
- Good: non-hosts can see room name/link/status in the shared room information
  panel without receiving host-only controls.
- Base: initial connect behavior and `CONNECTING` send buffering remain intact.
- Bad: a component creates its own WebSocket for manual retry, bypassing the
  store writer and duplicating room state.
- Bad: queued playback/chat commands are replayed after a reconnect and surprise
  the room.

#### 6. Tests Required

- Frontend unit: unexpected close reconnects with the same room identity.
- Frontend unit: manual `close()` cancels reconnect and clears queued sends.
- Frontend unit: browser `offline` drops the active socket and `online`
  reconnects immediately.
- Backend e2e: reconnecting with the same sender receives admission, permission,
  and roster snapshots.

#### 7. Wrong vs Correct

Wrong:

```ts
// A room component starts a second socket for retry.
new WebSocket(roomUrl)
```

Correct:

```ts
// Retry stays inside the single WS writer; identity comes from the cookie.
client.connect(bushitsuId)
```

### Realtime Chat vs Danmaku Streams

- `OSHABERI` and `DANMAKU` are separate realtime streams even though they share
  the same websocket transport and the same room-level `chat` permission gate.
- `useBushitsuStore.chat` stores chat-panel lines from `OSHABERI` and a marked
  mirror of `DANMAKU`. The mirror must carry `kind: "danmaku"` (and optional
  color) so the chat UI can badge/style it differently from normal speech.
- `useBushitsuStore.danmaku` stores realtime overlay lines from `DANMAKU` only.
- `DanmakuOverlay` reads `bushitsu.danmaku`; it must not watch `chat` as a
  shortcut. `DANMAKU -> chat mirror` is allowed for history visibility, but
  `OSHABERI/chat -> danmaku overlay` remains forbidden unless the product
  explicitly changes that direction.
- Timeline/file/fetched danmaku is separate from realtime chat danmaku. The
  current priority chain is local file cues > fetched cues from
  `Enmoku.danmaku` > future danmubox/search, while live `DANMAKU` continues to
  render as its own overlay stream.
- A failed fetched-danmaku request must not affect playback, source switching,
  or room state. Treat it as an empty optional source for that viewer.

```ts
// Good: each envelope commits to its own server-truth stream.
case "OSHABERI":
  chat.value.push({ senderId: msg.senderId, content: msg.payload.content, ts: msg.ts, kind: "oshaberi" })
  break
case "DANMAKU":
  danmaku.value.push({ senderId: msg.senderId, content: msg.payload.content, ts: msg.ts })
  chat.value.push({ senderId: msg.senderId, content: msg.payload.content, ts: msg.ts, kind: "danmaku" })
  break
```

**Tests required:** store tests must assert that applying `OSHABERI` does not
append to `danmaku`, and applying `DANMAKU` appends both a `danmaku` overlay line
and a `chat` line marked `kind: "danmaku"`. Backend WS tests should cover
`DANMAKU` room broadcast and the shared chat-permission rejection path.

### Application Theme Boundary

- The active application theme is a root `data-theme` attribute set by
  `applyTheme()` from `lib/theme.ts`; the current default is `warm-club`.
  Theme identity is local presentation state, never room/session truth, so it
  must not enter `useBushitsuStore` or travel through WebSocket messages.
- Shared palette values live only in `assets/theme.css` as semantic tokens.
  Components consume tokens such as `--color-surface`, `--color-text`,
  `--color-border`, and `--color-accent`; component-local variables may derive
  from them but may not introduce a second literal palette.
- `houkago:chat-theme` remains readable as a legacy local-storage value for a
  future migration, but the current UI does not apply it and has no chat-only
  theme prop, class, or toggle. A future selectable theme adds another root token
  block under the same contract rather than branching component selectors.

---

## Common Mistakes

- Treating the client as the source of truth for playback — leads to fights with
  the authority state. The client follows; only the host drives.
- Keeping 番組表 as a component-local `ref` only. A REST delete by another client
  will not reach that component unless `BANGUMI` is committed into the room store.
- Appending a just-created manual `Enmoku` after POST without considering the
  incoming `BANGUMI` snapshot. If the snapshot arrives before the POST promise
  resolves, a later local append can duplicate the same id in the visible queue.
  Prefer letting the WS snapshot write the queue; keep store-level id
  normalization as a defense.
- Letting an in-flight initial `GET /bangumi` overwrite a `BANGUMI` received
  after that request started. The queue can appear to roll back even though the
  server and socket are correct; guard the REST commit against a changed store
  snapshot.
- Forgetting `tsuijuuChuu` echo suppression → applying a remote `SHINKOU` fires a
  local seek/play event that gets broadcast back, causing oscillation.
- Storing a continuously-incremented `currentTime` in a store instead of deriving
  projected time on read → drift and extra reactivity churn.
- Putting transient UI flags in a global store → unnecessary cross-component
  coupling and re-renders.
- Rendering chat messages as realtime danmaku by watching `chat` in
  `DanmakuOverlay` → the product loses the ability to distinguish chat history
  from actual `DANMAKU` events. Mirroring `DANMAKU` into chat is fine only when
  the mirrored line is marked and `DanmakuOverlay` still reads `danmaku`.
- Mutating `Enmoku.danmaku` or `Enmoku.provider` in the client to represent
  local fetch state → parser metadata is server truth; loading/error state for
  fetched cues is local UI state.
