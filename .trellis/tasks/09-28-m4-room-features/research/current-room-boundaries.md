# Current room boundaries for M4 planning

Read-only source inspection on 2026-09-28. These are implementation facts, not
approval to change product code.

## Runtime and route

- `packages/kyoushitsu-react/src/app/router.tsx:29-45` has a lazy
  `/bushitsu/$id` route whose component is `room-handoff.tsx`.
- `packages/kyoushitsu-react/src/routes/room-handoff.tsx:1-34` uses
  `location.replace` to send that URL to Vue. The user's M4 decision supersedes
  this handoff and rejects a preview flag or fallback link.
- `dev.sh:8-9,65-78` still starts Vue at 5173 and Housou at 3000. React's Vite
  server is configured for 5174 in
  `packages/kyoushitsu-react/vite.config.ts:24-31`; the M3 isolated runner starts
  all three. M4 planning interprets the user's direct-migration decision as
  changing the default local entry to React at 5173. Final plan review confirms
  that interpretation before implementation.
- React's composition root creates one `AppRuntime`, QueryClient and Router
  outside render (`packages/kyoushitsu-react/src/main.tsx:1-28`). Its runtime
  manages identity epochs, cookie restoration and private cache cleanup.

## Session and state

- `packages/kyoushitsu/src/lib/room-session.ts:10-60,60-160` provides an injected
  `RoomSessionController` and transport/room/queue ports. The controller owns
  admission, reconnect, bootstrap ordering, stale-result fencing and disposal.
  It imports a pure resolver through a Vue-local `@/` alias at line 1; a
  portable subpath needs a relative import and an explicit package export.
- `packages/kyoushitsu/src/ws/client.ts:1-190` is a framework-free WebSocket
  client with bounded reconnect/backoff and an active-socket guard. It can be
  exported as a portable subpath after dependency inspection.
- The Vue room adapts those ports to Pinia and Eden at
  `packages/kyoushitsu/src/views/BushitsuView.vue:575-658`. Its Pinia store at
  `packages/kyoushitsu/src/stores/bushitsu.ts:56-205` owns the current realtime
  snapshot, chat, roster, queue, admission and permissions. React must bind the
  controller to one React-owned snapshot rather than import Pinia.
- Server protocol message schemas and types are shared from
  `packages/kousoku/src/messages.ts:14-191`. Housou's authoritative WebSocket
  implementation is `packages/housou/src/ws/handler.ts`. The backend contract
  remains stable in M4.

## HTTP and feature commands

- `packages/kyoushitsu/src/api/resources/http.ts:134-160` already provides
  typed room+queue bootstrap and queue move adapters over the generated SDK.
  Other queue commands used by the Vue room still call Eden in
  `BushitsuView.vue:345-550`; M4 needs typed resource adapters for the selected
  operations, without a second hand-written wire DTO.
- The Vue room sends `SETTEI`, `NYUUSHITSU_SETTEI`, `NYUUSHITSU_HANTEI`,
  `JOUEI`, `OSHABERI` and `DANMAKU` through one session command port
  (`BushitsuView.vue:345-405,543-563`). HTTP queue edits are separate command
  acknowledgements; UI state follows server-authored snapshots.
- Existing portable permission/queue helpers are in
  `packages/kyoushitsu/src/lib/kengen.ts`, `kengen-policy.ts` and
  `bangumi-actions.ts`. They currently lack package exports for React.
- M2 rules at `.trellis/spec/frontend/http-contract-resources.md` require
  credentialed generated HTTP transport, scoped keys, AbortSignal propagation,
  no retry for commands and WebSocket authority over live room fields.

## Scope constraint

M4 can display current-item and queue state and send allowed room commands, but
it has no React media driver. Vue's `EnmokuPlayer.vue` owns ArtPlayer/HLS/DASH;
React's build boundary currently excludes those engines. M5 remains the media
binding stage. A browser test for M4 must assert the playback-unavailable state
honestly and must not count queue selection as successful video playback.
