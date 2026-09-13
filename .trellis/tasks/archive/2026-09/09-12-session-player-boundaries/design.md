# M1 technical design — session and player boundaries

## Design intent

M1 is a responsibility extraction inside the existing Vue application. It does
not create a new frontend workspace or change the wire protocol. The extracted
modules are dependency-injected so a later React client can consume the same
session and player contracts, while the current Vue page remains the only
composition root during this stage.

The target flow is:

    BushitsuView (Vue adapter / presentation)
      ├─ RoomSessionController
      │    ├─ KousokuClient transport
      │    ├─ room + bangumi HTTP adapters
      │    └─ Pinia snapshot writer
      └─ ShinkouController (framework-free)
           └─ PlayerHandle / PlayerDriver port
                └─ EnmokuPlayer (ArtPlayer/HLS/DASH adapter)

The page may compose these objects and pass feature commands to the session,
but it must not implement transport lifecycle, bootstrap ordering, stale-result
checks, or imperative media calls.

## Module placement and contracts

Use the existing packages/kyoushitsu/src/lib/ location for framework-free
contracts and controllers. Keep the existing src/composables/ location for Vue
adapters. The expected implementation shape is:

- src/lib/player.ts — PlayerHandle and any minimal PlayerDriver lifecycle type.
  It may reference playback/domain types, but not Vue, Pinia, ArtPlayer, HLS,
  DASH, or DOM objects.
- src/lib/shinkou-controller.ts — pure synchronization controller. It accepts
  callbacks such as getPlayer, canControl, isBuchou, senderId, and
  getAuthoritativeState; it returns onLocalShinkou, handleRemote, catchUp, and
  dispose. Time and timer behavior remain injectable or deterministic enough for
  unit tests.
- src/composables/useShinkou.ts — thin compatibility adapter that supplies
  Pinia getters and a Vue Ref<PlayerHandle | null> to the pure controller. It
  must not duplicate sync math or authority branches.
- src/lib/room-session.ts — RoomSessionController plus transport/API dependency
  types. It owns the room session generation, connection/admission epoch, queue
  revision, guarded bootstrap, current-item request identity, start/dispose,
  and the admitted command port.
- test/room-session.test.ts and a focused framework-free sync/player test —
  fake dependencies, fake transport, and player spies. Existing
  client.test.ts and use-shinkou.test.ts remain or are adapted without
  weakening their assertions.

Names may be adjusted to the repository's existing conventions during
implementation, but the dependency direction and public responsibilities above
are fixed by this task.

### Session ports

The session controller should depend on narrow ports rather than Eden or
Pinia. The concrete shape may follow the repository's response wrappers, but
the semantics are:

    type RoomSessionTransport = {
      connect(roomId: string): void
      send(message: KousokuMessage): void
      close(): void
    }

    type RoomSessionDeps = {
      roomId: string
      identityKey: string
      createTransport: (
        onMessage: (message: KousokuMessage) => void,
        onStatus: (status: KousokuConnectionStatus) => void,
      ) => RoomSessionTransport
      fetchRoom: () => Promise<RoomResult>
      fetchBangumi: () => Promise<BangumiResult>
      applyMessage: (message: KousokuMessage) => void
      setRoom: (room: Bushitsu | null) => void
      setBangumi: (items: readonly Enmoku[]) => void
      getBangumi: () => readonly Enmoku[]
      getCurrentEnmokuId: () => string | null
      onCurrentEnmoku: (enmoku: Enmoku | null) => void
      onStatus: (status: KousokuConnectionStatus) => void
      onAdmission: (status: NyuushitsuStatus | "idle") => void
      onRevoked: () => void
      onError?: (error: unknown) => void
    }

RoomResult and BangumiResult are normalized boundary results, so the
controller does not know Eden's generated data/error shape. The controller's
send returns a boolean and only forwards room commands while the current
admission is entered; the server remains the final permission authority.

The store adapter must provide a room reset operation that preserves account
and nickname while clearing room-scoped state. The controller calls it before
starting a new identity/room session and invalidates work on dispose.

## Lifecycle and ordering

1. start is idempotent for an active controller. It resets the room-scoped
   projection, creates exactly one transport, and calls connect(roomId).
2. On every active transport connecting/replacement boundary, increment the
   connection/admission epoch and mark bootstrap as not started. Old bootstrap
   completions must fail the epoch check even if the overall controller remains
   alive for reconnect.
3. On every message, first call applyMessage(message). This preserves the
   existing store-before-playback rule. Then handle session side effects:
   BANGUMI advances the local queue revision, NYUUSHITSU entered starts
   bootstrap, NYUUSHITSU revoked invalidates and closes, and JOUEI/GENJOU
   request guarded current-item resolution.
4. Bootstrap begins only once per admission epoch. Start room and queue reads
   after admission. Capture the session generation, connection epoch, and
   queue revision before starting them. Apply room metadata only when the
   session/epoch is still current. Resolve host identity before deciding to
   send OIKAKE, preserving the current late-join sequence.
5. Apply an HTTP queue result only when the captured generation, epoch, and
   queue revision still match. If a newer WS BANGUMI arrived, discard the HTTP
   result rather than merging or replacing the authoritative snapshot.
6. Current-item resolution captures a monotonically increasing request token
   and requested enmokuId. A fallback queue fetch may seed the queue only
   through the same guarded path; it may publish a resolved item only if the
   controller, epoch, request token, and requested ID remain current.
7. dispose increments the session generation, invalidates request tokens,
   clears the transport, closes it, and is safe to call more than once. No
   callback after disposal may reach the store, player, router, or provider
   preparation path.

The transport itself also checks active socket identity for message, open,
error, and close callbacks. This closes the gap where a late message from a
socket replaced during reconnect could otherwise enter the current callback.

## Authority ownership

| Responsibility | M1 owner | Explicit non-owner |
| --- | --- | --- |
| Admission, reconnect, bootstrap, room reset | Room session controller | Vue page lifecycle |
| Room snapshot writes and queue revision observation | Session's injected store writer | HTTP cache / component-local queue |
| Permission/current-item/playback authority | Server-authored WS snapshot | Optimistic HTTP/UI state |
| Sync projection, drift correction, echo suppression | Framework-free sync controller | Vue watcher or page branch |
| ArtPlayer/HLS/DASH operations, pending seek, media cleanup | EnmokuPlayer adapter | Session/sync controller |
| Chat/governance/queue feature labels and command intent | Existing feature/page UI | Session core provider branches |

The page's feature functions may build a typed Kousoku command and call the
session command port. They must not construct another client or bypass
admission. Provider and danmaku composables remain feature-owned and are not
pulled into the session controller.

## Compatibility and rollback

Keep room URLs, cookies, Kousoku message shapes, Eden client, Pinia store
identity, ArtPlayer options, player events, provider calls, local preferences,
and CSS unchanged. No package manifest or lockfile edit is expected.

The safe rollback points are:

1. restore the old BushitsuView lifecycle wiring while retaining the new pure
   unit tests if the controller adapter is not ready;
2. restore the old useShinkou body while retaining the extracted PlayerHandle
   type if sync parity fails;
3. revert the session/player source and tests as one bounded M1 slice before
   any M2 HTTP/client work.

M1 completion does not imply React readiness or browser parity. It supplies
the contracts and evidence required for those later stages.
