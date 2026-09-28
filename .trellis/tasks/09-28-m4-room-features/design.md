# M4 technical design — direct React room migration

## Boundary and delivery shape

M4 makes the React app the normal **local** frontend on port 5173. Its existing
`/bushitsu/$id` route renders a React room. Home create/join and direct room
links use that route without `location.replace`, a preview switch, or a Vue
fallback. The old Vue source may remain in the repository as a migration
reference; no Vue room parity or browser compatibility is an M4 gate. Production
deployment and final removal of Vue remain separate decisions.

The React room deliberately has no media player in M4. It displays the current
item and a visible playback-unavailable notice. A queue action may select or
clear the current item through the existing `JOUEI` command, but its label must
describe the state change rather than promise playback. M5 owns the player,
source/provider flows, subtitles/fullscreen and danmaku rendering. M4 does not
open a second Vue document to fill this gap.

## Architecture

```text
React Router /bushitsu/$id
  → existing AppRuntime identity epoch + QueryClient
  → one room-scoped RoomRuntime (identity + room ID)
       → M1 RoomSessionController
       → portable KousokuClient → Housou WebSocket
       → generated HTTP resource adapters → Housou REST
       → immutable room snapshot + command status
  → admission / queue / chat / governance components via selectors
```

The route validates the room ID and starts the existing identity restoration
once, including on a direct/deep link. A room runtime is created only after a
current identity is known. It is keyed by account epoch and room ID. Route
exit, logout, identity replacement, revocation and page disposal close its
transport and abort owned HTTP work; late callbacks are fenced by both the
M1 controller generation and the runtime's identity/room key. React StrictMode
effect replay must leave at most one live room transport and no duplicated
room command. No protected room read or mutation begins before the server's
`NYUUSHITSU entered` message.

The existing `RoomSessionController` remains the lifecycle authority. Export
it, `KousokuClient`, and only needed pure selectors through explicit portable
`houkago-kyoushitsu` subpaths. Replace its Vue-local alias import with a
relative pure import. The React module graph must still exclude Vue, Pinia,
Eden, Housou server modules and media engines. Do not copy the controller or
create a second socket implementation.

React's room snapshot is a small external store with stable immutable
`getSnapshot` values and `useSyncExternalStore` subscriptions. It owns
admission, connection state, room metadata, queue, current item, permission
snapshot, presence/roster, pending admission, and chat history. The session
controller writes accepted WebSocket messages before downstream feature
effects. Feature components read selectors and invoke typed commands; they do
not parse raw messages or own sockets. TanStack Query remains for HTTP
resources and identity, not a second owner of live room fields. HTTP room and
queue reads are guarded bootstrap/recovery seeds only. `BANGUMI` advances the
M1 revision so a delayed seed cannot overwrite it.

## Feature flows

1. **Admission:** show waiting/closed/rejected/entered states from server
   messages. On entered, the controller fetches room and queue metadata and
   decides whether to send `OIKAKE`. On revoked, dispose room work and
   navigate to the existing home `revoked=1` notice. Host controls send
   `NYUUSHITSU_SETTEI` and `NYUUSHITSU_HANTEI`; the UI follows server replies.
   Do not invent a guest password flow: the current server reports password
   mode as closed to new nonmembers.
2. **Queue:** list and identify the current item from the room snapshot.
   Generated SDK adapters cover public URL preview/create, delete, move, clear
   pending and member removal as needed. Commands are explicit, non-retried and
   report pending/error states. HTTP acknowledgements do not optimistically
   replace the queue; the accepted `BANGUMI` event does. `JOUEI` controls the
   current-item designation, not a React media player in M4. Baidu-specific
   source acquisition stays in M5.
3. **Chat and roster:** append `OSHABERI` and text `DANMAKU` events to a
   session-scoped feed, retaining sender display names for departed members as
   the Vue store does. Sending requires admitted status and current chat
   permission; server echo is the visible commit. The video overlay and
   timeline danmaku controls stay in M5.
4. **Governance:** derive host and guest abilities from server-authored
   `KENGEN`, `SHUSSEKI`, `MEIBO` and `NYUUSHITSU` messages. Host permission
   changes, admission decisions and member removal use the existing WS/HTTP
   commands. Denied actions show errors and never fabricate authority.

Reuse shared labels and Warm Club tokens; build the included controls for
keyboard focus, accessible status, and phone/desktop reachability. Full
player-first/cinema layout parity is deferred because there is no player in
this stage. A nonfunctional media frame may be used only as a clearly labeled
placeholder, not as a simulated player.

## HTTP and protocol contracts

Keep Housou routes, WebSocket message types, cookie handling and SQLite schema
unchanged. The generated OpenAPI SDK is the wire source. Add narrow handwritten
resource functions only for existing generated operations missing from the M2
barrel; keep generated DTO types, `credentials: include`, AbortSignal, typed
errors and no command retry. A new operation or protocol field is outside the
default plan and would require a contract review and deterministic regeneration.

Room/queue command acknowledgements are distinct from WebSocket authority.
Local pending status may clear on a matching authoritative event, explicit
server error, disconnect or disposal. Do not replay an uncertain mutation on
reconnect. Avoid provider-specific branches in the session core.

## Local launch and rollout

Change `dev.sh` and the React Vite/default browser test configuration so the
ordinary local frontend is React at 5173 with Housou at 3000. Update the
isolated memory runner and relevant tests to use Housou + React as the normal
pair. The Vue source remains available for migration reference but is not
launched as a fallback. No production deployment or data migration occurs in
M4. If M4 validation fails, the local launch change and React route can be
reverted without changing backend state or protocol.

The existing `.trellis/spec/frontend/react-entry-runtime.md` describes the M3
handoff and Vue default. After implementation, update that executable contract
to describe the actual React room/default and retain its identity/cache
invariants. Update `.trellis/mainline.md` only to reflect delivered work and
remaining M5/M6 scope, not to claim full frontend parity.

## Main risks and checks

- **Media gap:** direct React room navigation removes playback until M5.
  Validate the unavailable notice and honest queue labels in browser tests.
- **Session duplication and stale state:** verify StrictMode setup/cleanup,
  account/room switches, reconnect, revocation and delayed HTTP versus WS.
- **Authorization:** test two real browser clients, pending admission, host
  governance, guest denial, and no protected request before admission.
- **Portable imports:** inspect the built React module graph, not only source
  imports, for forbidden Vue/server/media dependencies.
- **Local switch:** smoke the actual `dev.sh` lifecycle and port 5173 path;
  retain isolated-memory browser fixtures and exact service teardown.
