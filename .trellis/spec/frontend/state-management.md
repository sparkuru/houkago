# Frontend State Ownership

## 1. Scope / Trigger

Use for room snapshots, reconnect, identity/session replacement, playback or
local display state. React application state and core controllers have distinct
owners; there is no separate UI-framework store.

## 2. Signatures

```ts
room.subscribe(listener)
room.getSnapshot()
room.reconnect()
room.dispose()
client.connect(bushitsuId)
client.close()
```

The detailed commands and payloads are in
[room runtime](../houkago-kyoushitsu-react/frontend/room-runtime.md) and
[core](../houkago-kyoushitsu-core/frontend/shared-core.md).

## 3. Contracts

- Immutable runtime snapshots consumed with `useSyncExternalStore` are the
  room truth. WS writes queue, current item, playback, presence and permissions;
  delayed initial HTTP cannot overwrite newer WS state. Mutations acknowledge
  commands; they never seed an optimistic authoritative queue.
- Local React state owns drafts, dialog/menu visibility, cinema, source/subtitle
  selection and danmaku preferences. Router owns room ID; identity epoch scopes
  runtime and private Query entries. Theme is a local root `data-theme` and
  semantic core CSS tokens, never WS state.
- Unexpected socket close uses bounded retry. Explicit close/dispose/revocation
  cancels retry and queued sends. Browser offline drops the live socket; online
  reconnects the same current session. Admission snapshots are required again;
  non-host catch-up uses the existing `OIKAKE` path.
- `OSHABERI` adds chat only. `DANMAKU` adds its overlay stream and a chat entry
  marked `kind: "danmaku"`. A chat notification is not flying danmaku. Timeline
  file/fetched cues and selection are local and never mutate parser metadata.
- Keep last server playback plus timestamp; derive projected progress instead
  of storing a ticking truth. Remote apply suppresses automatic echoes; a
  currently permitted explicit gesture still follows the guarded user path.
- Presence is an immutable server-timestamp projection: retain continuing join
  time, departed name/last seen and fresh arrival on rejoin; reset per session.

## 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Old HTTP completes after a newer queue frame or disposal | Ignore it |
| Offline, revoked or deliberate close | No replay or duplicate socket |
| Reconnect | Fresh admission/permissions and follower catch-up |
| Permission removed | Stop commands, retain remote following |
| Room/identity epoch replacement | Hide/dispose old state immediately |

## 5. Good / Base / Bad Cases

Good: two admitted clients converge from WS after a host command.
Base: a restored user starts one room controller and one socket.
Bad: a component creates its own retry socket, appends an HTTP response to the
queue, applies presets before echo or polls presence.

## 6. Tests Required

Core transport/session tests assert retries, explicit close, offline/online and
queued-send clearing. React runtime tests assert admission, newer WS versus
HTTP, permission gates, stream separation and session disposal. Real-cookie
browsers verify two-client convergence and revocation on desktop/phone.

## 7. Wrong vs Correct

Wrong: `new WebSocket(...)` inside a chat component or write local queue after POST.
Correct: call the existing runtime command and render its next server snapshot.
