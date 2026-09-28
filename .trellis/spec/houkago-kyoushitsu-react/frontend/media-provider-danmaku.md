# React Media, Baidu and Danmaku

## 1. Scope / Trigger

Use this contract when changing `features/player`, `features/baidu`,
`features/danmaku`, or their bindings in `room-contents.tsx`. The room runtime
owns the only socket and the server snapshots. React media features own local
engines, transient provider grants, cue reads and presentation state.

## 2. Signatures

```ts
room.attachPlayer(player: PlayerHandle): () => void
room.localPlayback(state: Shinkou): void
room.userPlayback(state: Shinkou): void
room.catchUpPlayback(): void
room.danmaku(content: string): boolean
new PlayerDriver(container, url, type, events)
useBaiduPlayback(roomId, enmoku): { state, grantUrl, fingerprint, retry }
```

`PlayerStage` keys the driver by item ID and passes current media time to
`DanmakuFeature`. Only the active `PlayerDriver` creates ArtPlayer and its
HLS/DASH engine. Portable helpers are exported through explicit
`houkago-kyoushitsu/*` subpaths; React never imports the Vue package root.

## 3. Contracts

- `RoomState.playback`, `playbackServerTime`, and `danmakuDefaults` are written
  from Kousoku `SHINKOU`/`GENJOU`/`DANMAKU_DEFAULT`. Apply the snapshot before
  player effects. `DANMAKU_DEFAULT` is authoritative for the matching room;
  candidate HTTP may fill only non-authoritative selection data.
- The M1 `createShinkouController` is the only sync algorithm. Its ordinary
  `onLocalShinkou` suppresses player echoes for about 200 ms after remote apply.
  Explicit play, pause, seek and rate controls call `onUserShinkou` through
  `room.userPlayback`, which still checks current admission and playback
  permission. This preserves a user's immediate gesture in that interval.
- A guest starts audible playback in the join click stack, then calls
  `catchUpPlayback`. Unpermitted guests have disabled custom controls but
  still receive remote `SHINKOU`. A new item, room, identity or route disposes
  the old driver and invalidates its callbacks. Source changes stay local to
  the same programme; subtitle, cinema and web fullscreen are local choices.
- Baidu connection/status and file browsing use generated HTTP adapters with
  cookie credentials and abort signals. Any admitted member may manage a
  personal connection; browsing/source creation require playlist permission.
  One-use playback grants stay in memory. On optional fingerprint failure,
  request one fresh grant before playback. Abort or ignore old grants when
  room/item scope changes. Failed revoke retains local authority; successful
  revoke clears it.
- Live `DANMAKU` is sent through `RoomRuntime` and displayed only after WS
  echo. Timeline cues follow local media time and local display preferences.
  Personal override, room default and fallback selection stay separate from
  room authority. Portals place both overlays inside `.player-screen`, which
  remains inside the player fullscreen subtree.
- The React production graph may contain ArtPlayer, HLS and DASH. It must
  exclude Vue, Pinia, Eden and Housou server modules. When installing package
  dependencies, keep `@types/bun` peer versions aligned between Kyoushitsu
  and Housou so TypeScript sees one nominal Elysia type instance.

## 4. Validation & Error Matrix

| Condition | Result |
| --- | --- |
| No current item or failed Baidu grant | No player for that item; room controls remain usable |
| Missing/incompatible adapter, owner offline, revoked connection, or mobile Baidu | Named status and recovery where possible; ordinary media stays available |
| Permission revoked or socket closed | Playback and danmaku commands stop; follower sync and room state remain server-authored |
| Remote apply followed by immediate permitted manual control | Manual command is sent; automatic echo remains suppressed |
| Stale grant, cue, default or file response after scope change | Ignore result and keep current item/room state |
| Media or subtitle load failure | Visible scoped feedback without mutating room authority |

## 5. Good / Base / Bad Cases

- Good: two admitted clients play a fixture; host grants playback permission;
  guest immediately pauses and both pause. A live danmaku appears for both,
  including within the web fullscreen player.
- Base: MP4, HLS and DASH fixtures mount one driver per selected item and
  dispose it on item change. A local file or selected candidate renders at
  the current video time.
- Bad: query-cache a one-use Baidu URL, let candidate HTTP replace a newer
  `DANMAKU_DEFAULT`, mount another socket, or relay every media time tick as
  room authority.

## 6. Tests Required

- Unit: controller permission, remote echo suppression, immediate manual
  action, player/room disposal, Baidu grant count/cancel/fingerprint recovery,
  typed HTTP paths and errors, danmaku scope and selection precedence.
- Browser: real-cookie two-client play/pause and permission at desktop and
  375px; local MP4/HLS/DASH fixtures; live danmaku echo and fullscreen subtree;
  existing room admission/queue/chat/governance regressions. Use fixture
  adapter and candidate data for provider/danmaku interaction states.
- Gate: root lint/typecheck/tests and `contract:drift`, React production build
  and `dist/module-graph.json` inspection. Record browser launch restrictions
  separately from application failures.

## 7. Wrong vs Correct

Wrong: rely on a player `pause` event during the remote suppression timer to
send a newly permitted guest's manual pause. The timer can discard it.

Correct: route the explicit button gesture through `room.userPlayback`, while
the controller continues to suppress automatic player event echoes.
