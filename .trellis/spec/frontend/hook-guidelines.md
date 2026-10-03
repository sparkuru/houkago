# React Hook and Lifecycle Guidelines

Keep React hooks in application features; pure functions and transport/controllers
belong to core. Existing `useBaiduPlayback` and `useTimelineDanmaku` own scoped
requests, timers and cancellation. Hook effect cleanup must close/dispose its
resource, cancel pending work and ignore stale completions after room/item/identity
replacement. StrictMode replay cannot leave duplicate sockets, players or timers.

Consume immutable `RoomRuntime` snapshots through `useSyncExternalStore`.
A view hook never becomes a second room-state writer. Identity commands and
private Query entries follow [React entry](react-entry-runtime.md).
HTTP flows use [generated resource adapters](http-contract-resources.md), with
cookies, AbortSignal and typed domain failures; do not add raw component fetches.

Realtime playback, presence, chat and queue arrive by WS; do not poll REST.
Keep player progress and online-duration display clocks local/derived. Member
information ticks only while its dialog is shown and cleans up on close/hide/unmount.
Pure calculations can be unit tested without mounting React or a player.
