# React Room Runtime

## 1. Scope / Trigger

Use this contract for `packages/kyoushitsu-react/src/routes/room.tsx` and
`src/features/room/room-runtime.ts`. M4 renders `/bushitsu/:id` directly in
React. The existing M1 room controller and Kousoku WebSocket protocol remain
the session authority. This scope includes admission, roster, chat, queue and
host governance. Media playback and provider controls belong to M5.

## 2. Signatures

```ts
new RoomRuntime(roomId, identityId, onRevoked, services?)
room.start()
room.reconnect()
room.subscribe(listener)
room.getSnapshot()
room.can("chat" | "playlist" | "playback")
room.chat(content)
room.select(enmokuId)
room.setPermissions(kengen)
room.setAdmission(mode, password?)
room.decide(senderId, approved)
room.preview(url, title?)
room.add(url, title?)
room.move(id, direction)
room.delete(id)
room.clearPending()
room.removeMember(id)
room.dispose()
```

`RoomRuntime` binds one `RoomSessionController` to one `KousokuClient`. Its
immutable `RoomState` is consumed through `useSyncExternalStore`. Generated
HTTP adapters are imported through `houkago-kyoushitsu/http`; the controller,
client and permission helper use explicit portable subpaths. The route keys a
session to the restored identity epoch and room ID.

## 3. Contracts

- Restore identity before constructing the room runtime. `start()` creates
  one live socket. A server `NYUUSHITSU` with `entered` status gates the room
  and queue HTTP bootstrap. Waiting, closed and rejected visitors get no
  protected room read. Dispose on route, room, identity or epoch change;
  StrictMode replay must close the first socket before the next starts.
  The route also checks the session's creation epoch during render. An epoch
  change for the same account ID must hide the old snapshot immediately,
  before effect cleanup constructs its replacement.
- Apply `NYUUSHITSU`, `KENGEN`, `BANGUMI`, `JOUEI`, `GENJOU`, `SHUSSEKI`,
  `MEIBO`, `OSHABERI`, `DANMAKU` and `KEIHOU` from WS. HTTP bootstrap is for
  initial/recovery data; delayed HTTP cannot overwrite a newer WS queue.
  Queue HTTP mutations acknowledge commands but do not write local queue
  state. Resolve current item from authoritative current ID and queue.
- Gate command controls on server admission, open connection and current
  permission/host role. Host governance sets admission mode, decides pending
  requests, changes permissions and removes members. Password mode is a host
  setting; the backend currently admits existing members and reports closed to
  new nonmembers. Do not invent a guest password handshake.
- Show pending command state and failures. Do not optimistically grant access,
  permissions, queue entries or current item. A disconnected command is not
  replayed on reconnect. A revoked visitor leaves the room and sees a notice
  on the home route; stale async completions cannot revive room state.
- The current item panel states that video playback is unavailable until M5.
  `JOUEI` designates a current item only. Do not mount players, media engines
  or provider workflows in this route, or describe designation as playback.
- Local development uses Housou at port 3000 and React at port 5173.
  `scripts/dev-react-preview.sh` provides an isolated memory setup for browser
  verification. Browser tests may use task-owned ports when defaults are
  occupied, and must exercise real cookies and WebSocket frames.

## 4. Validation & Error Matrix

| Condition | Observable result |
| --- | --- |
| Identity restore pending or failed | No socket; status or retry UI |
| Waiting/closed/rejected admission | Gate/status UI; no protected bootstrap or feature commands |
| Server enters | One guarded room/queue HTTP bootstrap; room controls become available according to role |
| HTTP completion after newer `BANGUMI` or disposal | No stale queue or disposed state revival |
| Identity epoch changes with the same account ID | Old room view is gated immediately; a fresh session owns later state |
| WS disconnect | Controls stop sending; reconnect requires fresh admission |
| `KEIHOU` or HTTP command error | Pending state clears and an actionable error is shown |
| Server revokes membership | Socket and pending reads close; home receives `revoked=1` |
| Invalid room ID | Safe route error; no socket or protected read |

## 5. Good / Base / Bad Cases

- Good: an approval visitor waits while the host receives the pending request;
  after approval, both clients see chat and queue broadcasts. Host removal
  redirects the visitor with a revocation notice.
- Base: a restored host opens a direct room URL, receives `entered`, reads
  room/queue once and uses WS controls. The current item title appears with
  the M5 playback notice.
- Bad: fetch the queue before admission, seed queue from a mutation response,
  create a second socket in a component effect, or claim that selecting an
  item starts video playback.

## 6. Tests Required

- Unit tests cover one socket, StrictMode-like dispose/recreate, admission
  gating, reconnect, stale HTTP versus WS, permission gates, command errors,
  revocation and cleanup.
- Fake-transport tests cover each new generated HTTP adapter's path/body,
  cookie credentials, abort signal and typed domain errors.
- Browser tests use real Housou cookies/WS with two clients for approval,
  entry, chat, queue/current broadcast and revocation. Check direct room URLs,
  desktop and 375px layout, focusable controls, error feedback and the M5
  notice. Record any environment limit explicitly; do not replace these checks
  with mocked admission alone. A deterministic preview response fixture may
  replace the external video's Range request; keep the actual add mutation and
  resulting WS `BANGUMI` broadcast on real Housou.
- Run React typecheck/build, package and root lint/tests, contract drift,
  module graph inspection and the local preview shell harness.

## 7. Wrong vs Correct

Wrong: write `queue = response.enmoku` after an add or move command, then
render it as the live queue.

Correct: await the HTTP acknowledgement, keep pending/error feedback, and
render the subsequent `BANGUMI` event from the room controller.

Wrong: mount a room socket while identity restoration is pending and fetch
`/bushitsu/:id` to infer admission.

Correct: restore identity, start one controller/socket, wait for server
`NYUUSHITSU entered`, then let the controller start guarded HTTP bootstrap.
