# React room layout refinement design

## Ownership and boundaries

This task changes presentation and layout in `packages/kyoushitsu-react` only.
`RoomRuntime`, Kousoku WebSocket messages, permissions, the backend, and the
legacy Vue room remain unchanged. The floating control calls the existing room
actions and does not become a second command or socket owner.

## Layout shape

- Keep the right room dock as the only fixed room column: attendance → danmaku
  settings/source → chat. Keep its safe-area inset and make the chat card take
  the remaining height using a flexible final column item. Place the composer at
  the chat card's bottom, with history using the flexible scrollable space.
  Remove the old 60vh/560px cap; expanded settings remain reachable through
  dock scrolling when their content exceeds a short viewport.
- At wide non-cinema widths, let the header and main grid use the content width
  left after the dock lane instead of stopping at the old 1320px cap. The grid
  continues to place the queue immediately below the player and must remain
  aligned with the header. Because the dock is fixed, its `.room-side` wrapper
  must not remain as an in-flow grid track at this breakpoint.
- Remove the redundant top kicker and top copy-link control. The existing room
  information, copy-link, and `返回楼层` actions live in the `+` action menu.
  Gated viewers keep a return link because they have no floating menu.
- Keep the launcher visible in ordinary and cinema layouts. Web fullscreen and
  native fullscreen are the only hidden states; cinema mode alone must not hide
  it.

## Floating control state and data flow

- `RoomControls` remains the presentation boundary for the action list and
  room-information dialog. It receives a fullscreen-hidden flag from the room
  view and continues to call `onCopyRoomLink` / existing room information UI.
- Render the floating layer through a body-level portal so it is not constrained
  by room grid stacking contexts. Give the layer a high, bounded z-index and
  keep the action menu/backdrop semantics accessible.
- Track the launcher anchor as viewport-relative percentages or normalized
  coordinates, not document coordinates. A small room-local helper owns:
  `load`, `save`, `clamp`, and `restore-on-resize` behavior.
- Persist one browser-level position under a versioned `localStorage` key. On
  load, invalid or malformed data falls back to a safe lower-right position; on
  resize or viewport changes, clamp the launcher rectangle back inside safe-area
  and viewport bounds before saving.
- Dragging uses pointer capture on the launcher, supports mouse and touch, and
  prevents a drag release from accidentally toggling the menu. Keyboard users
  retain a normal button activation path; arrow-key nudges and an accessible
  drag hint provide a non-pointer way to reposition it.
- The player reports web/native fullscreen state to the room view. The floating
  layer is removed from the accessibility tree and visual tree while either
  fullscreen state is active, then restored at the clamped saved position after
  exit. Cinema state is not part of this hidden predicate.

## Compatibility and rollback

- The position key is versioned and contains only bounded UI coordinates; a
  parse failure or storage access failure must not block room rendering.
- Do not persist room identity, chat content, provider data, or credentials.
- If browser fullscreen APIs are unavailable, keep the normal/cinema control
  usable and rely on the player's existing fullscreen state/error handling.
- Rollback is limited to the React room layout, floating-control, player state
  callback, styles, and focused browser/unit tests; no protocol or persisted
  domain state migration is required.

## Verification shape

- Unit-test position parsing, default placement, clamping, invalid storage, and
  resize-safe bounds without a browser.
- Browser-test the screenshot-sized wide layout, dock clearance, queue/player
  alignment, absent top duplicate controls, menu actions, pointer drag,
  persistence after reload, viewport resize clamping, phone flow, cinema
  visibility, web-fullscreen hiding, and full-height fixed-dock geometry. Cover
  native fullscreen where the browser runner permits it and record environment
  limits otherwise.
