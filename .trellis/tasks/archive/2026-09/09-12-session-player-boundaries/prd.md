# M1 — Session and player boundaries

## Status and authorization

The user authorized the bounded M1 slice on 2026-09-12 after reviewing the
recommended scope. This task is the next child of the frontend migration plan
and depends on the archived M0 behavior baseline. The task may change
Kyoushitsu source and tests, but it does not authorize React migration,
dependency changes, backend/protocol changes, deployment, or automatic
continuation into M2.

Implementation starts only after this task's planning artifacts and manifests
have been reviewed through the normal Trellis gate.

## Goal and user value

Give the room page a stable, testable ownership boundary for admission,
reconnect, room bootstrap, queue authority, playback synchronization, and
player control. A future frontend framework or feature change should be able
to reuse these contracts without recreating a second WebSocket, queue writer,
or media lifecycle. The existing Vue application and visible behavior remain
the compatibility target throughout this slice.

## Confirmed repository facts

- packages/kyoushitsu/src/views/BushitsuView.vue:584-683 currently owns
  account restore continuation, WebSocket construction, admission gating,
  room/queue bootstrap, OIKAKE timing, current-item resolution, and teardown.
- packages/kyoushitsu/src/stores/bushitsu.ts:105-205 is the current room
  snapshot writer. WS messages are applied to the store before playback
  handling; the view still directly mutates some room identity fields.
- packages/kyoushitsu/src/ws/client.ts:47-190 owns reconnect/backoff and
  send buffering, but only its close callback rejects callbacks from an old
  socket. Message/open/error callbacks do not currently check active-socket
  identity.
- packages/kyoushitsu/src/composables/useShinkou.ts:1-158 contains the
  framework-independent synchronization ideas but imports Pinia state and a
  Vue Ref, so the contract cannot be consumed by another framework without
  an adapter.
- packages/kyoushitsu/src/components/player/EnmokuPlayer.vue:1-821 owns
  ArtPlayer, HLS/DASH engines, deferred seek, player events, and cleanup. It
  already exposes the narrow apply, alignTransport, setRate, and snapshot
  surface used by useShinkou.
- M0 recorded passing typecheck, lint, unit/integration tests, Kyoushitsu
  build, and adapter build. Chromium browser checks remain environment-blocked
  by missing libglib-2.0.so.0 / openssl; those results are pre-existing
  baseline limitations, not a reason to weaken M1 assertions.

## Requirements

### R1 — Room-session ownership

Create an injected, framework-independent room-session controller. It must
provide explicit start, dispose, send, and reconnect/transport seams so the
Vue view adapts to it rather than owning socket lifecycle and admission
callbacks. One live session has one transport; repeated cleanup is safe.

The controller must keep the existing sequence: connect first, wait for the
server-authored NYUUSHITSU entered state, fetch protected room data only
after admission, resolve the host before deciding whether to send OIKAKE,
and apply each incoming message to the room snapshot before downstream
playback/current-item effects.

### R2 — Queue and current-item authority

Keep WS BANGUMI as the authoritative live queue snapshot. HTTP bootstrap or
recovery may seed the queue only when the session generation, admission/
connection epoch, and local queue-event revision captured at request start
still match at completion. Every accepted BANGUMI advances that revision.

Current-item resolution must be guarded by the active session and requested
enmokuId. A late room/queue/current-item response from an old room, account,
socket, or item must not replace current state. Leaving or re-entering a room
must clear room-scoped chat, presence, queue, authority, and pending resolution
state without clearing the durable account/nickname.

### R3 — Sync and player seams

Move the PlayerHandle contract and synchronization controller behind
framework-free ports. Keep a small Vue composable adapter for Pinia/Ref
access so existing tests and the current view continue to work. Preserve
shared-control behavior, remote SHINKOU handling, host GENJOU self-follow
suppression, clock-offset projection, drift tiers, echo suppression, and
late-join catch-up.

The ArtPlayer/HLS/DASH instance remains exclusively owned by
EnmokuPlayer.vue in M1. The extracted sync/player contract must not import
Vue, Pinia, ArtPlayer, HLS, DASH, or DOM types. Media setup/cleanup and visual
controls remain in the component for the later player-binding stage.

### R4 — Feature ownership without UI migration

Make the boundary explicit in code and task-local documentation:

- session owns transport, admission, snapshot writes, queue ordering, and
  room-scoped lifecycle;
- sync owns authority decisions and calls only the player port;
- the player adapter owns media effects and emits typed local events;
- the existing page and feature components own presentation plus feature
  commands, using the session command port rather than opening another socket.

Do not introduce a generic registry, a second state library, a second queue
subscription, or provider-specific branches in the session/sync core.

### R5 — Compatibility evidence

Add focused fake-transport and framework-free unit tests for admission gating,
queue ordering, room/account disposal, stale callbacks, reconnect identity,
single-socket behavior, revocation, sync authority, and player-port
delegation. Preserve existing tests and assertions; do not delete browser
scenarios or loosen permission/sync checks to make the extraction pass.

## Acceptance criteria

- [x] A1. A framework-free session test proves that protected bootstrap and
      OIKAKE cannot run before NYUUSHITSU entered, while the accepted
      sequence remains room metadata → host decision → OIKAKE → guarded queue
      seed.
- [x] A2. Delayed HTTP queue/current-item results are ignored after a newer
      BANGUMI, room/account replacement, reconnect admission epoch, item
      change, revocation, or dispose; accepted WS snapshots remain the only
      newer authority.
- [x] A3. Session start/dispose/reconnect paths are idempotent, old socket
      callbacks cannot reach the current session, reconnect retains the room
      identity, and tests demonstrate one active socket at a time.
- [x] A4. The page no longer owns direct room-session bootstrap/socket cleanup;
      it adapts the session controller and keeps store-before-playback message
      ordering. Existing room, queue, chat, governance, provider, danmaku,
      subtitle, and layout wiring remains behaviorally intact.
- [x] A5. PlayerHandle and the sync controller are importable without Vue or
      DOM dependencies; the Vue adapter preserves existing shared-control,
      clock, drift, echo-suppression, and catch-up assertions.
- [x] A6. Room reset preserves account/nickname but clears room-scoped state;
      no old room chat, queue, authority, roster, or pending current-item work
      is visible after re-entry.
- [x] A7. ./dx bun run typecheck, ./dx bun run lint,
      ./dx bun run test, and the Kyoushitsu build pass. Any browser check
      attempted with the project-supported host profile is recorded honestly;
      the M0 container prerequisite block is not converted into a product
      regression or a weakened acceptance criterion.
- [x] A8. The final diff contains no package-manifest/lockfile dependency
      change, React workspace, backend/protocol/database edit, deployment
      change, or visual redesign.

## Out of scope

- React/Vite workspace creation, Vue replacement, Vue Router replacement,
  TanStack Query/Router, Hey API, Tailwind, shadcn/ui, or dependency updates.
- OpenAPI export, generated clients, cache policy, or HTTP resource migration;
  these belong to M2 after the ownership contracts are validated.
- Backend, database, WebSocket protocol, authentication, media URL, or
  adapter-contract redesign.
- Full provider/Baidu/danmaku feature extraction, subtitle/fullscreen UI
  redesign, responsive layout changes, visual rebrand, or new product
  behavior.
- Automatic replay of uncertain mutations, live-provider credentials, or
  deployment/cutover.

## Risks and deferred decisions

- The room page is a large integration hub; the first implementation should
  extract lifecycle seams incrementally and keep rollback points at the
  controller, sync adapter, and page wiring boundaries.
- Actual browser fullscreen/autoplay/media-engine behavior remains a later
  environment-sensitive verification. M1 must preserve the existing player
  component and run the available static/unit/build checks.
- The exact HTTP abort mechanism is deferred to M2. M1's correctness boundary
  is generation/epoch/revision invalidation; an injected transport may add
  cancellation without changing the server contract.

There are no unresolved product or scope questions blocking this bounded
slice.
