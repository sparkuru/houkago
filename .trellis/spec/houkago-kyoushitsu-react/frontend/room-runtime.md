# React Room Runtime

## 1. Scope / Trigger

Use this contract for `packages/kyoushitsu-react/src/routes/room.tsx` and
`src/features/room/room-runtime.ts`. M4 renders `/bushitsu/:id` directly in
React. The existing M1 room controller and Kousoku WebSocket protocol remain
the session authority. This scope includes admission, roster, chat, queue,
host governance, playback snapshots and room danmaku defaults. Media feature
details are in [React Media and Danmaku](./media-provider-danmaku.md).

## 2. Signatures

```ts
new RoomRuntime(roomId, identityId, onRevoked, services?)
room.start()
room.reconnect()
room.subscribe(listener)
room.getSnapshot()
room.can("chat" | "playlist" | "playback")
room.attachPlayer(player)
room.localPlayback(state)
room.userPlayback(state)
room.catchUpPlayback()
room.danmaku(content)
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
HTTP adapters are imported through `houkago-kyoushitsu-core/http`; the controller,
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
- Apply `NYUUSHITSU`, `KENGEN`, `BANGUMI`, `JOUEI`, `GENJOU`, `SHINKOU`,
  `DANMAKU_DEFAULT`, `SHUSSEKI`, `MEIBO`, `OSHABERI`, `DANMAKU` and `KEIHOU` from WS. HTTP bootstrap is for
  initial/recovery data; delayed HTTP cannot overwrite a newer WS queue.
  Queue HTTP mutations acknowledge commands but do not write local queue
  state. Resolve current item from authoritative current ID and queue.
- Gate command controls on server admission, open connection and current
  permission/host role. Host governance sets admission mode, decides pending
  requests, changes permissions and removes members. Password mode is a host
  setting; the backend currently admits existing members and reports closed to
  new nonmembers. Do not invent a guest password handshake.
- Queue add/select and single-item deletion follow playlist permission. An
  admitted guest with `canPlaylist` may delete an item added by the host or
  another member; item authorship adds no restriction. Queue reordering and
  clearing all pending items remain host-only. Apply the same permission split
  in presentation, runtime commands and backend authorization. The owner
  clarified this existing rule during real-environment acceptance on 2026-10-04;
  the previous host-only single-delete wording was erroneous. See backend
  [session authority](../../backend/seitoshou-contract.md).
- Permission presets call `setPermissions` with shared `KENGEN_PRESETS`; their
  selected state and custom summary derive from server `KENGEN`, just like the
  individual checkboxes. Guests receive the read-only summary.
- `SHUSSEKI` projects an immutable `presenceById` through core
  `projectMemberPresence` using server timestamps. Retain departures and their
  names, restart arrival time on rejoin, and reset history with the session.
  The information dialog shows online duration and departed-member last seen.
  Its one-second display clock runs only while the dialog is open and clears
  on close, fullscreen hiding or unmount; do not poll REST for attendance.
- Show pending command state and failures. Do not optimistically grant access,
  permissions, queue entries or current item. A disconnected command is not
  replayed on reconnect. A revoked visitor leaves the room and sees a notice
  on the home route; stale async completions cannot revive room state.
- `JOUEI` designates a current item and resets the previous playback snapshot
  to paused at 0 seconds. `GENJOU` and `SHINKOU` write the last
  server-authored playback state before the M1 controller applies player
  effects. `DANMAKU_DEFAULT` writes a room-scoped authoritative snapshot;
  candidate HTTP cannot overwrite it. The player attaches through one port
  and is disposed with the route. Host and permitted guests can send playback;
  all others follow only.
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
| Guest without playback permission | Control inputs disabled; remote playback still applies |
| Admitted guest without playlist permission deletes an item through HTTP | HTTP 403; authoritative queue unchanged |
| Admitted guest with playlist permission deletes a host-added item through HTTP | HTTP 200; item removed and `BANGUMI` reaches both clients |
| Playlist-enabled guest reorders or clears all pending items | HTTP 403; those placement operations remain host-only |
| Manual control within remote echo-suppression window | `userPlayback` sends a permitted gesture; automatic player events remain suppressed |
| `KEIHOU` or HTTP command error | Pending state clears and an actionable error is shown |
| Server revokes membership | Socket and pending reads close; home receives `revoked=1` |
| Invalid room ID | Safe route error; no socket or protected read |

## 5. Good / Base / Bad Cases

- Good: an approval visitor waits while the host receives the pending request;
  after approval, both clients see chat and queue broadcasts. Host removal
  redirects the visitor with a revocation notice.
- Good: a playlist-enabled guest deletes a host-added item and both clients
  receive the updated authoritative queue; authorship does not change permission.
- Base: a restored host opens a direct room URL, receives `entered`, reads
  room/queue once and uses WS controls. A selected item mounts one player.
- Bad: fetch the queue before admission, seed queue from a mutation response,
  create a second socket in a component effect, or treat local player time as
  authoritative room state.

## 6. Tests Required

- Unit tests cover one socket, StrictMode-like dispose/recreate, admission
  gating, reconnect, stale HTTP versus WS, permission gates, command errors,
  revocation and cleanup.
- Fake-transport tests cover each new generated HTTP adapter's path/body,
  cookie credentials, abort signal and typed domain errors.
- Browser tests use real Housou cookies/WS with two clients for approval,
  entry, chat, queue/current broadcast and revocation. Check direct room URLs,
  desktop and 375px layout, focusable controls and error feedback. Record any environment limit explicitly; do not replace these checks
  with mocked admission alone. A deterministic preview response fixture may
  replace the external video's Range request; keep the actual add mutation and
  resulting WS `BANGUMI` broadcast on real Housou.
- Assert single-item DELETE is 403 before playlist permission, then 200 after
  permission, with unchanged/removed queue respectively and both clients
  receiving the removal. Keep guest move and pending-clear expectations at 403.
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

Wrong: infer that single-item deletion is host-only from the host-only rules
for reorder/clear, or treat a hidden guest button as backend permission policy.

Correct: use `host || canPlaylist` for single-item deletion, regardless of
`addedBy`; retain exact host authority for reorder/clear.

## Room Controls Presentation

- `RoomControls` and `RoomSpeedDial` own presentation state only. Build the
  speed-dial actions from `{ id, label, icon, onActivate, selected?,
  opensDialog? }`; callbacks continue to call the existing room/runtime
  actions. Do not add a second socket, command owner, or optimistic room state
  in the dial.
- Keep room identity, connection/admission status, presence, and the read-only
  permission summary available to every admitted viewer. Render governance
  forms only for `room.isHost`; existing room command and `room.can(...)`
  permission checks remain authoritative.
- Admitted viewers access `返回楼层` from the `+` menu. Navigate with the
  existing TanStack route to `/` and clear the `revoked` search field. Keep the
  topbar return link only for gated viewers, whose floating menu is unavailable.
- A closed dial action list must be both `aria-hidden` and `inert`. Its launcher
  exposes `aria-expanded` and `aria-controls`, opens focus on the first action,
  and restores focus to the launcher after Escape, backdrop dismissal, toggle,
  or action activation. Give every icon-only button an accessible name and at
  least a 44px target.
- Use a labelled native `<dialog>` for the room information/governance sheet.
  Open it with `showModal()`, provide an explicit close button, retain native
  Escape behavior, dismiss only on a backdrop click, and return focus to the
  speed-dial launcher when it closes. CSS that displays it must target
  `dialog[open]`; keep it within safe-area-adjusted viewport bounds and center
  it horizontally.
- On desktop, keep `QueuePanel` in the room grid directly below the player in
  the main column. When the room dock is fixed at the viewport edge, its
  `.room-side` wrapper must not reserve an in-flow grid column; the main/queue
  grid reaches the dock boundary with the defined gap, while the fixed dock
  remains independent of the grid. At the phone breakpoint, restore normal
  flow and stack main, sidebar, then queue, keeping the queue title above its
  wrapping action shelf. The floating room launcher must not reserve an in-flow
  column. Render it through a `document.body` portal so its stacking and
  viewport position are independent of the room grid.
- Compose the right room dock in this order: attendance roster,
  `DanmakuFeature` source/settings, then `ChatPanel`. In normal rooms at 1200px
  and wider, fix the whole dock to the viewport's right edge and reserve a
  matching page lane. In cinema mode, fix it at 851px and wider. Keep the
  attendance and danmaku sections above chat; let expanded danmaku settings
  scroll within the dock and chat history scroll within its card. ChatPanel
  fills the remaining vertical space below the roster and settings and its
  composer sits at the inner bottom. A full-height outer surface with unused
  space below a capped chat card does not satisfy this layout contract.
  Below those breakpoints, keep the dock in the room sidebar; the unified
  video-source controls, including the Baidu provider, belong inside `QueuePanel`'s lower
  番组表 section rather than as a separate middle-column panel. On phones the
  sidebar still follows the main content and precedes the queue.
- Keep one composer in `ChatPanel` with two independent send buttons in the
  order `弹幕`, `发送`. The first calls `room.danmaku(content)` and the second
  calls `room.chat(content)`; both use the existing `chat` permission and
  command gate. Apply the 500-character maximum only to the danmaku action.
  `DanmakuFeature` continues to receive room chat events for overlays and keeps
  its overlay portal attached to the player even though its source/settings
  controls live in the dock.
- The closed launcher must clear the player, queue controls, and shared composer. In
  phone cinema, keep the composer compact enough to clear the fixed launcher
  while retaining its accessible labels and 44px controls. When the action
  menu is open it is a deliberate overlay: its backdrop blocks pointer access
  to the page until the menu closes, so open menu actions may cover content.
- In normal, non-cinema room layouts at 1200px and wider, let the shared header
  and grid use the full content width left after the fixed dock lane; the
  grid-to-dock gap is 16px and must not leave the old centered 1320px blank
  lane. Below that breakpoint, retain the responsive room-grid cap/flow. Give
  an empty waiting stage a 16:9 ratio and vertically center its content so it
  matches the active player's screen. Cinema keeps its viewport row; the
  active player's screen continues to use the player component's 16:9 ratio.
- The room launcher stores a normalized `{ x, y }` viewport position under
  `houkago.kyoushitsu.room-floating-position.v1`. Convert it to pixels using
  the current viewport and launcher size, clamp it inside 16px safe insets and
  the fixed dock boundary, and re-clamp it on resize. Pointer drag supports
  mouse and touch; a drag must not accidentally toggle the menu. Arrow keys
  nudge the focused launcher (Shift doubles the step) and the accessible hint
  explains the movement. Keep the launcher visible in ordinary and cinema
  modes; remove it from the visual/accessibility tree only while the player
  reports web or native fullscreen.
- On desktop/cinema, keep the fixed room dock 16px from the right safe-area
  edge, size it with `clamp(280px, 24vw, 400px)`, and reserve enough room to
  clear the player/queue and speed dial. The dock's outer surface fills the
  viewport-height span between its top and bottom insets. Use a flex-column
  dock with chat `flex: 1 0 240px`, feed `flex: 1 1 0; min-height: 0` and
  internal `overflow-y: auto`; do not apply the old 60vh/560px chat cap.
  Attendance/settings may shrink and scroll independently; the outer dock
  can scroll at very short heights to keep the minimum chat/composer reachable.
  At intermediate fixed-dock widths, if the
  launcher remains in the dock lane, open menu actions must be offset to the
  dock's left edge so they do not cover the chat composer. At the phone cinema
  breakpoint, the dock returns to flow and its chat feed may shrink while
  scrolling internally so the composer stays clear of the fixed launcher.
- Reserve a clear placement for the closed launcher in normal desktop and
  cinema layouts, and add `env(safe-area-inset-*)` to viewport-edge spacing.
  Honor `prefers-reduced-motion` for the dial and action transitions. Do not
  hide the launcher for cinema mode; only the actual fullscreen state may hide
  it.
- Treat stored coordinates as the preferred location. After safe-area/dock
  clamping, `findClearRoomFloatingPosition` chooses the nearest valid position
  at least 8px from the player, queue interactive controls and whole composer.
  Re-measure on room content mutations, observed layout resize, viewport resize
  and captured scroll. Automatic avoidance must not overwrite the stored
  preference; drag/nudge starts from the actual rendered location. If no clear
  location exists, retain the safe clamped launcher rather than hiding it.

### Room Control Browser Assertions

- Cover host and guest information views, host-only governance, hidden-action
  inertness, launcher labels/state, keyboard and touch opening, Escape,
  backdrop/outside dismissal, and focus entry/return.
- Assert interior dialog padding clicks leave the dialog open; dismiss on a
  click outside its bounding rectangle. Verify presets/custom combinations
  through two-client server echo, and duration/departure/rejoin history without
  removing retained chat names.
- Measure closed-launcher overlap against the player, queue buttons/inputs/links,
  and shared chat
  composer; drag it and verify normalized localStorage persistence, keyboard
  nudges, resize clamping, and open actions against the viewport. Verify
  backdrop pointer blocking, queue alignment below the main column/title
  wrapping, the 16px dock gap without a blank workspace lane, horizontal
  overflow, dock order/pinning/flow, composer routing and length mode, phone
  cinema clearance, actual-fullscreen hiding, and reduced motion. Open menu
  actions may overlap content because the active backdrop prevents interaction
  underneath. Wait for dial transitions to settle before recording screenshots.
- Assert ChatPanel's bottom equals the fixed rail's inner bottom, and the
  composer's bottom equals ChatPanel's inner bottom, within 1px after padding
  and border adjustment. Cover ordinary/cinema tall and normal desktop sizes;
  outer-rail height alone cannot detect unused space beneath chat. Test the
  menu return action and gated return link through actual home navigation.
- Exercise playback permission through `+` → room-control dialog. Click the
  server-controlled checkbox and wait for its echoed checked state before
  testing guest authority; an immediate `check()` postcondition can precede
  the WebSocket update. Exit native fullscreen through the player toggle and
  assert `document.fullscreenElement === null` before checking launcher
  restoration; synthetic Escape alone is not proof of browser fullscreen exit.
