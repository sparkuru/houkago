# Frontend Component Guidelines

React components present typed props and wire existing feature/runtime actions.
Routes own identity/room epochs; `RoomRuntime` owns the socket and authoritative
snapshots. Presentation components must not create another socket or optimistically
write permissions, queue/current item or playback truth.

`PlayerStage` and `PlayerDriver` contain ArtPlayer/HLS/DASH lifecycles. Source,
subtitle and cinema choices are local. Danmaku portals stay in the player
fullscreen subtree. Source changes preserve subtitle selection within an item;
item/session changes dispose old resources and reset scoped local choices.

Use existing `Button`, `Alert`, form primitives, semantic labels and >=44px
interactive targets. Closed menus are inert; native dialogs open with
`showModal()`, close with Escape or a true outside-rectangle backdrop click,
and restore launcher focus. Keep theme values in core semantic tokens and
application CSS; honor safe insets and reduced motion.

The room grid, dock, shared chat/danmaku composer, launcher portal and automatic
obstacle clearance follow the executable
[room presentation contract](../houkago-kyoushitsu-react/frontend/room-runtime.md).
Do not recreate old layouts or confirmation components during unrelated work.
Native confirmations were accepted at M6 review.

Tests exercise visible behavior and final state: host/guest controls, real
server echo, keyboard/focus/dismissal and populated desktop/phone/cinema layout.
A screenshot or a component implementation mirror is insufficient.
