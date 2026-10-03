# React room screenshot layout refinement

## Goal

Align the admitted React room page with the layout intent marked in the supplied
3840×1960 screenshot: keep the player/番组表 as the primary workspace, keep the
chat dock on the far right, and remove the large misleading gap and duplicated
room actions.

## Confirmed facts

- The current React room renders a top `放課後 · 部室` kicker, room title/status,
  a top-level `复制房间链接` action, and a separate fixed `RoomSpeedDial`
  launcher near the bottom edge.
- On wide screens, `.room-page` reserves a right lane for the fixed chat dock;
  `.room-grid` also has a 1320px maximum. This combination can leave a large
  empty region between the main workspace and the right dock, matching the
  green-marked region in the screenshot. Once the dock is fixed, its `.room-side`
  wrapper must also stop occupying an otherwise empty in-flow grid column.
- The room dock is intentionally fixed on wide screens and contains attendance,
  danmaku settings, and chat. The lower `QueuePanel` owns the unified video
  source section.
- `RoomControls` already owns room information and copy-link actions for the
  floating launcher, so the top-level copy-link button duplicates an existing
  route to the same action.

## Requirements

- R1. Preserve the far-right fixed chat dock and its current attendance →
  danmaku settings → chat order.
- R2. Make the main room workspace use the available width up to the dock
  boundary, without introducing horizontal overflow or overlapping the dock.
- R3. Move room information and copy-link actions into the `+` menu, removing
  the duplicated top-level copy-link control and the redundant top kicker.
  Put `返回楼层` in the same menu for admitted viewers; retain an exit path
  on the admission gate where the floating menu is unavailable.
- R4. Make the `+` menu a viewport-level floating control that is visually
  above the room interface, can be dragged to a user-chosen position, and
  remains available in ordinary and cinema layouts. Hide it only while the
  player is in web or native fullscreen.
- R5. Preserve room authority, chat/danmaku behavior, queue/source behavior,
  admission gating, keyboard accessibility, and phone/cinema layouts.
- R6. Keep the repository's containerized browser validation reproducible by
  installing Chromium's system runtime libraries in the project development
  image and rebuilding that image through `dx` when requested.
- R7. At fixed desktop/cinema breakpoints, make ChatPanel fill all remaining
  dock height below attendance and danmaku. Keep its composer at the bottom
  and chat history internally scrollable. A full-height outer background with
  a capped chat card and unused space below it does not satisfy this requirement.

## Resolved decisions

- Persist the dragged launcher position in `localStorage` as a clamped
  viewport-relative position, and re-clamp it after resize or viewport changes.
  This preserves the user's placement while preventing a position saved on one
  screen from becoming unreachable on another.

## Acceptance Criteria

- [x] The screenshot-marked desktop layout has no unexplained large reserved
      blank lane between the main workspace and the fixed chat dock.
- [x] The player and 番组表 remain aligned, while the right dock remains clear
      and fixed at supported wide viewport sizes.
- [x] The fixed dock wrapper does not reserve an invisible desktop grid column;
      the main workspace reaches the dock boundary with the defined gap.
- [x] The chat card reaches the fixed dock's inner bottom edge without an
      unused region below it; the feed scrolls internally and phone flow works.
- [x] Admitted viewers find `返回楼层` in the `+` menu and can navigate home;
      the topbar contains no duplicate return action.
- [x] The final placement/visibility of the top kicker, top copy-link action,
      and `+` launcher matches the resolved UX decision and has browser geometry
      coverage.
- [x] The floating launcher is draggable without leaving the viewport, remains
      above ordinary room content, and is hidden only during actual player
      fullscreen (not merely cinema mode).
- [x] `dx` uses a rebuilt project development image containing Chromium's
      system runtime libraries, so the relevant browser checks can run in the
      repository's containerized environment.
- [x] Existing React typecheck, unit tests, build, lint, Trellis validation,
      and relevant browser layout checks pass; browser-environment limits are
      recorded separately from application failures.

## Notes

- This is a child of `09-28-m6-parity-cutover`; do not change backend,
  WebSocket, or legacy Vue behavior.
- The final planning summary was approved on 2026-10-01; implementation and
  validation are recorded in `validation.md`.
