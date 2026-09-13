# M1 executable contracts

This file narrows the parent S1/S2/S4 contracts to the Vue-preserving M1
implementation. It is not a new protocol or product specification.

## Session lifecycle

- One RoomSessionController owns one room/account session and one live
  transport.
- start() and dispose() are idempotent. dispose() invalidates callbacks,
  closes the transport, and clears room-scoped state while preserving account
  and nickname.
- A session must observe NYUUSHITSU with status: "entered" before starting
  protected HTTP bootstrap, sending OIKAKE, or accepting room commands.
- Revocation invalidates pending work, closes the session, and leaves routing to
  the existing Vue flow.
- Incoming messages are applied to the snapshot writer before sync/player or
  current-item side effects.

## Queue and current-item ordering

- The controller tracks sessionGeneration, connectionEpoch, and queueRevision.
- A queue HTTP request captures all three values. It may call setBangumi only
  if all three still match at completion.
- Every accepted WS BANGUMI increments queueRevision; a newer WS snapshot
  always wins over an older HTTP request.
- Current-item resolution captures the requested enmokuId and its own request
  token. A late response cannot publish another item's result or another
  room's result.
- No HTTP cache or component-local queue is an additional authority in M1.

## Sync/player boundary

- Framework-free sync code consumes only callbacks and PlayerHandle; it does
  not import Vue, Pinia, DOM, ArtPlayer, HLS, or DASH.
- PlayerHandle retains apply, alignTransport, setRate, and snapshot.
- Local SHINKOU is emitted only when the authority callback allows control.
- Remote SHINKOU is applied for host and guests; host skips its periodic GENJOU
  self-follow; echo suppression remains active.
- Player media setup, pending seek, subtitle/fullscreen controls, and cleanup
  remain inside EnmokuPlayer.vue.

## Feature ownership

- Session: transport, admission, room reset, snapshot writer, queue/current-item
  ordering, and the admitted command port.
- Sync: playback authority decisions and projection/drift behavior.
- Player: imperative media engine and typed local event bridge.
- Existing page/features: presentation, labels, provider/danmaku orchestration,
  and command intent through the session port.

No dependency, protocol, backend, database, visual, or deployment change is
part of these contracts.
