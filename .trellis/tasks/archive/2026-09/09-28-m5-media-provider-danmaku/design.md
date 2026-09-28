# M5 technical design

## Boundary and delivery shape

M5 replaces the M4 media placeholder in the direct React room. M4's
`RoomRuntime` remains the only room session and socket owner. A React media
feature owns one imperative player; Baidu and danmaku features supply URLs,
controls and overlays through narrow ports. Vue remains a behavior reference,
not a runtime fallback. M6 owns final layout parity and deployment.

```text
React room + RoomRuntime (one M1 room session)
  ├─ server snapshot: current item, SHINKOU/GENJOU, DANMAKU_DEFAULT
  ├─ typed playback command + M1 ShinkouController
  └─ feature UI
       ├─ PlayerHost → PlayerDriver → ArtPlayer/HLS/DASH
       ├─ Baidu workflow → generated HTTP resources + adapter bridge
       └─ Danmaku workflow → candidates/defaults + local preferences
                           → overlays in player fullscreen subtree
```

## Session and sync contract

Extend `RoomState` with server-authored playback state/server time and the
room-default danmaku snapshot. `RoomRuntime.apply` records `SHINKOU`,
`GENJOU` and `DANMAKU_DEFAULT`; `onAfterMessage` then passes playback messages
to one `createShinkouController`. Its player port points to the current driver
or `null`. `getAuthoritativeState` reads the room snapshot; `send` uses the
current session's admission, connection and permission guard. The host skips
its own GENJOU heartbeat but follows explicit peer SHINKOU; permitted guests
may originate controls. Player ready/join handlers call `catchUp`. The join
handler starts audible playback in the browser gesture stack before catch-up.
Disposal cancels suppression timers and detaches the driver.

M1 sync files are framework-free in behavior, but `shinkou-controller.ts`
currently uses Vue-project `@/lib` imports. Convert those to portable relative
imports and expose explicit package subpaths for only the pure helpers React
uses. React never imports the Vue package root, composables/stores, Eden or
server modules. Do not copy synchronization algorithms.

## Player and UI contract

A React-owned `PlayerDriver` implements `PlayerHandle` and alone creates
ArtPlayer/HLS/DASH, calls seek/play/pause/rate and destroys media engines.
`PlayerHost` supplies a stable mount element, accessible controls and
join/permission states. Keep React-owned overlays and dialogs outside the
ArtPlayer mount node; portal into the player subtree for native fullscreen.
The driver emits typed ready, time, control and local-playback events. Local
time feeds timeline danmaku only, never `RoomState` authority.

Reuse pure source/subtitle metadata and seekability helpers. Item or URL
changes have generation tokens; cleanup destroys the previous engine before
new effects. Source changes keep current programme authority without an extra
WS mutation. HLS subtitles wait for manifest/native track readiness; failures
show feedback. Cinema remains local layout state; entering fullscreen closes
it, matching Vue behavior. Use existing Warm Club tokens.

## Baidu workflow

Reuse pure provider, OAuth handoff, adapter detection, source-permission and
grant helpers. Add only missing generated-SDK-backed resource adapters for
pairing, OAuth, revoke and source creation. Generated DTOs and
`HoukagoHttpError` remain wire contracts. Query may hold scoped status,
availability and directory reads; commands, OAuth, source creation and
one-use grants are explicit workflows without automatic retries.

Personal connection management is available to any admitted member, while
file browsing and source insertion remain playlist-gated. Revoke calls the
server first; on failure it keeps visible/local authority, and on success it
clears local adapter authority and returns to an unselected retention choice.
User-held OAuth redemption waits for the popup to close and uses the existing
bounded retry/cancellation contract. User-held source creation remains
provisional until the adapter stores its exact permit; failure deletes only
that newly created item best-effort.

For a Baidu item: check availability, platform and adapter capability;
prepare one grant with an abort signal; prepare the local adapter and mount
media only while room/item/source tokens still match. Grant URL stays in
memory. Optional fingerprinting may feed danmaku matching; after a claimed
or failed fingerprint attempt, request a fresh grant as the current behavior
does. Item/room/identity changes, admission loss and disposal abort polling
and ignore stale adapter completions. OAuth popup/focus listeners have explicit
teardown. Housou remains source permission authority.

## Danmaku workflow

Reuse pure candidate ranking, release identity, file parsing/preferences and
fallback helpers. Add generated adapters for room default, proposal, manual
match and legacy cue reads still reached through Eden in Vue. Candidate/cue
loading is scoped to current item, room and identity, with abort and
generation guards. `DANMAKU_DEFAULT` in the room snapshot wins over
candidate-response defaults. Personal override remains local; room-default
commands wait for accepted WS state. Search/match/proposal show pending/error
feedback. Live WS danmaku stays in the room event buffer; timeline cues use
local player time. Neither becomes a per-frame Query update. Send live
danmaku through a typed room command gated by admission/chat permission;
visible lines and overlays follow server echo. Preserve local file and
display preference persistence.

## Compatibility, checks and rollback

No Housou endpoint, Kousoku message, schema or adapter protocol changes are
planned. Inspect the final React module graph for Vue/Pinia/Eden/server
imports. Verify MP4/HLS/DASH with local fixtures, two real Housou clients for
authority, and adapter/candidate fixtures for provider and danmaku. Port
meaningful Vue behavior assertions; retain aggregate package tests.

Rollback is the React media feature plus its explicit shared exports. The
previous React room can be restored without backend/data migration. Stop and
review if a player opens another socket, React effect replay creates another
grant, or HTTP overwrites newer server-authored playback/default state.
