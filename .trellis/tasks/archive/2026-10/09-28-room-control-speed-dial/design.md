# React room-control speed-dial design

## Ownership

The speed dial is a React presentation feature owned by
`packages/kyoushitsu-react`. It is not part of `houkago-kyoushitsu-core`: room
actions, command handlers, room authority, and permission checks remain in their
current application/runtime boundaries. The control only changes how those
existing actions are presented and reached.

The Firefly reference supplies interaction, focus, safe-area, and motion
guidance. Rebuild those behaviors with the existing React and CSS conventions;
do not import Firefly runtime code, styles, storage keys, or dependencies.

## Integration shape

- Build the action list from existing room information, actions, and permission
  state. Keep action identifiers stable and labels accessible.
- The speed dial owns its open/closed presentation, backdrop, focus movement,
  focus restoration, Escape handling, and reduced-motion behavior.
- Existing room components/handlers own business actions and authorization.
  Do not duplicate commands or move permission decisions into presentation.
- Move the attendance roster and `DanmakuFeature` controls into a single room
  dock, ordered attendance → danmaku settings/source → chat. Keep danmaku
  overlays attached to the player through the existing portal target.
- Put one message composer in `ChatPanel` with one shared draft and two
  accessible, independent actions in the order `弹幕`, `发送`. The first
  routes through `room.danmaku`; its server echo is rendered as a flying
  player danmaku and as a `[弹幕]` chat line. The second routes through
  `room.chat`; its server echo is rendered in the chat feed and as a transient
  lower-right player notification. Both use the existing chat permission.
  `DanmakuFeature` exposes only source/settings controls in the dock while
  keeping both server-echoed overlays attached to the player.
- Remove the room-control surface from normal layout flow. On desktop, place
  the anime playlist immediately below the player in the main column while the
  room sidebar spans both rows. On phones, stack main, sidebar, then playlist.
  Retain the existing queue data and interaction behavior.
- Keep supported desktop, portrait, and cinema layouts usable. Apply safe-area
  spacing, avoid the player/queue/chat controls, and prevent horizontal
  overflow.
- On wide desktop and cinema layouts, pin the full room dock to the viewport's
  right edge and reserve a matching right-side lane so it does not cover room
  content. Keep chat history scrolling inside its card; allow the dock itself
  to scroll if danmaku source settings expand beyond the viewport. At narrower
  and phone widths, render the dock in the room sidebar; keep the unified
  video-source controls, including Baidu, inside the lower 番组表 section
  rather than presenting Baidu as a separate middle-column panel.
- Keep the normal room header and grid aligned to a shared 1320px maximum
  width inside the space left of the dock lane. Align the desktop launcher to
  that workspace's right edge with a 16px inset. In normal, non-cinema layouts
  at 851px and wider, keep the empty waiting stage at a 16:9 ratio and vertically
  center its content so it matches the active video's player screen. Cinema
  mode retains its viewport-filling cinema row; its active player screen keeps
  the player component's 16:9 ratio.

## Parent M6 relationship

This child can be implemented independently of the shared-core extraction.
Parent M6 may perform that extraction in parallel, but must wait for this
child's A1–A5 acceptance before freezing the final React room-layout parity
baseline or removing `packages/kyoushitsu`. Passing this child does not authorize
the parent cutover or production deployment.
