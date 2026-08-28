# Design: hybrid danmaku source selection

## Boundary and state ownership

This child consumes the identity/pool contract. It owns deterministic candidate
resolution, global policy management, room/Enmoku default truth,
viewer-local override, and the common frontend timeline orchestration. It does
not fetch provider data or parse files.

## Server flow

- Candidate reads require a valid session and current room admission. Results
  contain safe summaries, evidence explanations, availability, source class,
  logical track/revision, alignment, and current room default.
- `Komon` updates the singleton allowed-class/order policy transactionally.
  Default order is server-stored, provider-official, local, third-party.
- `Buchou` alone sets or clears an eligible server-addressable logical track as
  the room/Enmoku default. Write DB first, then send an authoritative full
  selection snapshot to admitted room sockets.
- A local-file candidate is never server-addressable and therefore cannot be a
  room default.

## Client orchestration

Extract `useTimelineDanmaku` from `BushitsuView`. It combines server candidates
with the current local candidate, reads a versioned localStorage override keyed
by stable release identity, applies the fixed precedence, loads one candidate,
and exposes one cue array plus explicit loading/empty/error/fallback state.

Async request identity prevents stale loads from replacing a newly selected
Enmoku. Invalid/disabled/unavailable preferences fall through without being
deleted. Clearing a viewer override returns immediately to the current room
default. Switching tracks increments the existing overlay track version and
uses the player's current snapshot; it never remounts the player.

## UI

Add a progressively disclosed source panel adjacent to existing danmaku
controls. It uses warm-club tokens and i18n keys, shows source/provenance and
selection scope in text, and separates these actions:

- use personally;
- set/clear room default (`Buchou` only);
- submit public proposal (eligible confirmed association only).

It covers loading, empty, error with retry, disabled, fallback, and success
feedback; uses real controls, visible focus, `aria-live`, 44px targets, and no
hover-only affordance. Validate 375px and desktop layouts without horizontal
overflow or player obstruction.

## Compatibility

Until source migration completes, the composable may wrap the legacy fetched
reference as a compatibility candidate. Realtime `DanmakuOverlay`, playback
authority, quality selection, fullscreen, and room queue remain unchanged.

