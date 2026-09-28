# M4 — React room features

## Goal

Move room admission, realtime room state, queue, chat, and governance directly
into the React frontend using the M1 room-session boundary and M2 HTTP
resources. Make React the default local frontend and have ordinary room URLs
render the migrated room, without a preview flag or Vue handoff. Media playback
and provider behavior remain for M5; the M4 room must say playback is not yet
available. The user does not require old Vue room compatibility.

## Background

- The user requested continuing M4 after reviewing the project architecture on
  2026-09-28. The user then rejected a preview/fallback route and explicitly
  chose direct migration without old-version compatibility. This authorizes M4
  planning. The user reviewed the final M4 planning summary and approved
  implementation with `开始` on 2026-09-28. M5/M6 and production deployment
  remain outside that approval.
- The archived migration roadmap identifies M4 as admission, realtime,
  queue/chat/governance with feature commands and selectors. M0–M3 are complete;
  M5 owns React media/provider/danmaku and M6 owns parity/cutover.
  Evidence: `.trellis/tasks/archive/2026-09/09-12-frontend-refactor-plan/roadmap.md:36-46`.
- The archived contract assigns room admission, permissions, roster, current
  item, and queue authority to one realtime session snapshot. HTTP room/queue
  bootstrap is guarded; `NYUUSHITSU entered` gates protected work; accepted
  `BANGUMI` beats older HTTP results. Chat is a session event buffer rather than
  a Query resource. Evidence: `.../09-12-frontend-refactor-plan/spec.md:5-44`.
- M1 extracted `RoomSessionController` with injected transport and lifecycle
  ports in `packages/kyoushitsu/src/lib/room-session.ts:1`. The existing Vue
  room is a source reference for M4 feature behavior, not a compatibility gate.
- M2 exported typed HTTP resources through `houkago-kyoushitsu/http`; M3's React
  runtime uses them with TanStack Query in
  `packages/kyoushitsu-react/src/app/runtime.ts:1`.
- M3's React `/bushitsu/$id` route currently performs same-window handoff to
  the Vue room, while Vue still owns the ArtPlayer/HLS/DASH player. Evidence:
  `packages/kyoushitsu-react/src/app/router.tsx:29-45`,
  `packages/kyoushitsu-react/src/routes/room-handoff.tsx:1`, and
  `packages/kyoushitsu/src/components/player/EnmokuPlayer.vue:1`.
- At the start of M4, the Vue app is the default development frontend and React
  is a parallel app. M3 validated cookie continuity across React → Vue room;
  that handoff is superseded by the user's direct-migration decision. This plan
  interprets direct migration as making React the default **local** frontend;
  the final planning review confirms that scope before implementation.

## Requirements

- R1. Bind the existing room-session controller to a React room lifecycle with
  one live socket per room/identity, idempotent disposal, and protection from
  stale callbacks after reconnect, room change, revocation, or logout.
- R2. Preserve server-authored admission and governance: no protected room
  bootstrap or mutation before `NYUUSHITSU entered`; revocation returns the
  user to the existing home/revoked flow; permission and roster views reflect
  authoritative messages rather than optimistic local guesses.
- R3. Present queue and current-item metadata from one room snapshot. Use
  guarded HTTP bootstrap/recovery only where the M1 contract allows it; a
  newer `BANGUMI` must never be replaced by an older HTTP response. Queue
  preview/add, move, delete, clear-pending and current-item commands retain
  server authorization and explicit failure states. Provider-specific queue
  sources are deferred to M5.
- R4. Port chat, room roster, and governance interactions into feature-owned
  React components. Text chat and the room feed include received `DANMAKU`
  text, while the video overlay is deferred. Reuse existing labels, visual
  tokens, permission rules, and narrow protocol/HTTP adapters rather than
  duplicating transports.
- R5. Replace the React room handoff with the migrated room on the same URL
  and make React the normal local development entry (`dev.sh` / port 5173).
  Do not add a preview flag, Vue fallback link or old Vue behavior-parity gate.
  Keep backend/WS/HTTP contracts compatible. Vue source may remain as a
  migration reference, but it is not an M4 product target; production
  deployment is outside M4.
- R6. Make the absence of React playback in M4 explicit in the room UI; a
  current-item label or queue action must not imply that video playback works.
  Keep media, Baidu/provider, subtitles/fullscreen, danmaku and final layout
  parity outside M4.

## Acceptance criteria

- [x] A1. A React room test proves one socket, admission gating, room/identity
      replacement, reconnect, revocation and idempotent teardown. (R1, R2)
- [x] A2. Delayed HTTP room/queue data cannot overwrite a newer accepted WS
      snapshot; queue commands and permission decisions obey the server
      contract. (R2, R3)
- [x] A3. Two browser clients can exercise admitted-room chat, queue and
      governance; denied actions stay denied and visible state follows server
      events. (R2–R4)
- [x] A4. Direct React room URLs render the migrated room with no handoff or
      preview flag. The room clearly reports that playback is unavailable in
      M4; included controls remain keyboard accessible and responsive. (R4–R6)
- [x] A5. React entry and room flows, aggregate checks for retained packages,
      React build and HTTP contract drift pass. Old Vue browser parity is not
      an M4 acceptance gate. (R5)
- [x] A6. No M5 media/provider/danmaku implementation, backend/protocol/DB
      redesign, or production deployment is included. (R5, R6)
- [x] A7. `dev.sh` starts Housou and the React frontend as its normal local
      entry. `/` and `/bushitsu/:id` use React without Vue runtime handoff.
      (R5)

## Out of scope

- React player binding and playback/sync effects, autoplay, subtitles,
  fullscreen, Baidu grants/adapter, danmaku selection/rendering (M5).
- Final visual/layout parity and production deployment (M6).
- Vue workspace removal; its media behavior remains a source reference for M5.
- New room features, backend authorization changes, protocol or database
  redesign, and unrelated dependency upgrades.
