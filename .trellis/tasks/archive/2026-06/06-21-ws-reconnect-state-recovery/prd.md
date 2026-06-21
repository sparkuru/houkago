# WS reconnect state recovery

## Goal

Make room WebSocket interruptions recover automatically so a viewer can keep the same room session after a transient disconnect, reconnect, browser HMR socket reset, or brief server/network hiccup. After reconnect, the client should restore admission, permission, roster, and playback authority state without requiring a full page reload.

## What I Already Know

* `design.md` lists WS reconnect and reconnect-time room/admission/authority recovery as the next P4 polish item.
* `packages/kyoushitsu/src/ws/client.ts` currently opens one WebSocket, queues sends only while the initial socket is `CONNECTING`, reports lifecycle status, and does not retry after `close`.
* `packages/kyoushitsu/src/views/BushitsuView.vue` creates one `KousokuClient` in `startSession()`. Room bootstrap runs only after `NYUUSHITSU(status="entered")`.
* The backend WS `open()` path already re-admits the host and open-mode guests, sends `SHUSSEKI`, `KENGEN`, and `NYUUSHITSU`, and supports `OIKAKE` returning `GENJOU`.
* Admission and permission state are already in-memory per room on the server side (`nyuushitsu`, `kengen`, `shinkouSeigyo`) and have e2e coverage for host reconnect seeing pending approval requests.
* Existing frontend tests in `packages/kyoushitsu/test/client.test.ts` use a mocked WebSocket, so reconnect behavior can be covered without browser automation.

## Assumptions

* Reconnect is a frontend-owned retry loop around the existing `/ws` protocol, not a new protocol version.
* Reconnect uses the existing stable `senderId` and nickname query params so the server treats the returning browser as the same member.
* After a successful reconnect and `NYUUSHITSU entered`, the room view should repeat the same catch-up flow as a late joiner: refresh room data as needed and send `OIKAKE` for non-host clients.

## Open Questions

* None for the MVP.

## Requirements

* Add automatic reconnect for unexpected WebSocket close/error while the room view is mounted.
* Use bounded retry with backoff so a dead server does not cause a hot loop.
* Preserve manual close semantics: route unmount / deliberate `client.close()` must stop retries and clear pending sends.
* Preserve existing `CONNECTING` send queue behavior for the active socket.
* On successful reconnect, let the existing admission/bootstrap flow restore `NYUUSHITSU`, `KENGEN`, `SHUSSEKI`, and playback authority state.
* Non-host reconnect should catch up to the current `GENJOU` without requiring the host to pause/play again.
* Connection status should remain usable by existing room controls.
* Room information and connection status must be visible to non-hosts too; only privileged room controls remain host-only.
* Browser `offline` should actively drop the current socket so DevTools/network-offline scenarios do not leave a stale open-looking connection.
* Keep manual retry UI out of this task; it should be designed as a later shared room information surface rather than a host-only control.

## Acceptance Criteria

* [x] A mocked frontend WebSocket close triggers reconnect with the same room id, sender id, and nickname.
* [x] Calling `close()` prevents reconnect and clears queued sends.
* [x] Reconnected non-host clients request/receive current authority state through the existing `OIKAKE`/`GENJOU` path.
* [x] Backend e2e coverage verifies reconnect receives admission and permission snapshots.
* [x] Existing send queue, status callback, admission, permission, and playback sync tests keep passing.
* [x] Non-host room view exposes the room information panel with connection status while hiding host-only settings.
* [x] Browser offline/online events drop the active socket and reconnect immediately on online.

## Definition of Done

* Tests added or updated for frontend reconnect logic and backend recovery snapshots.
* `./dx bun run format`, `./dx bun run lint`, `./dx bun run typecheck`, and `./dx bun test` pass before submit-ready.
* Manual browser checkpoint covers a two-browser room where a member disconnects/reconnects and resumes following. User confirmed PASS after the room-status and offline handling fixes.
* Specs updated only if implementation discovers a reusable reconnect convention or pitfall.

## Technical Approach

MVP: extend `KousokuClient` to own reconnect policy and remember the latest connect parameters. Unexpected `close` schedules a retry. `open` resets retry state and flushes the queue. `close()` marks the client as intentionally closed and cancels pending retry timers. `BushitsuView` can keep its current server-authoritative bootstrap: when `NYUUSHITSU entered` arrives after reconnect, `enterRoom()` refreshes room state and non-host clients send `OIKAKE`.

## Decision (ADR-lite)

**Context**: The server already sends the recovery snapshots needed on `open()`/`admit()` and already answers `OIKAKE` with current `GENJOU`. The gap is that the browser client stops permanently after a socket close.

**Decision**: Implement bounded same-tab automatic reconnect in the frontend client, reusing the existing protocol and bootstrap path.

**Consequences**: This keeps the protocol small and avoids persistent offline operation. It does not recover across a server process restart if in-memory room authority was lost.

## Future UI Note

Manual retry should not live only inside a host-only "room control" panel. This task already makes the existing room information block visible to non-hosts; a later UI task can add manual retry there:

* Host sees management controls plus connection/member/admission state.
* Non-host sees the same room identity, connection state, member/admission state, and safe actions like manual retry, but not privileged controls.
* The label should be role-neutral, likely "房间信息", while host-only actions remain visually grouped inside it.

## Out of Scope

* Cross-tab session handoff.
* Offline command persistence or replay across reconnect.
* Recovering in-memory room authority after a backend process restart.
* Password-entry join flow changes.
* New authentication/OAuth or identity model changes.
* Manual retry UI and the shared "房间信息" panel redesign.

## Technical Notes

* Relevant files inspected:
  * `packages/kyoushitsu/src/ws/client.ts`
  * `packages/kyoushitsu/src/views/BushitsuView.vue`
  * `packages/kyoushitsu/test/client.test.ts`
  * `packages/housou/src/ws/handler.ts`
  * `packages/housou/src/ws/housou.ts`
  * `packages/housou/test/nyuushitsu.e2e.test.ts`
  * `packages/housou/test/kengen.e2e.test.ts`
* Relevant specs likely needed before implementation:
  * `.trellis/spec/frontend/index.md`
  * `.trellis/spec/frontend/state-management.md`
  * `.trellis/spec/frontend/directory-structure.md`
  * `.trellis/spec/frontend/type-safety.md`
  * `.trellis/spec/backend/index.md`
  * `.trellis/spec/backend/error-handling.md`
  * `.trellis/spec/backend/quality-guidelines.md`
* Spec update: `.trellis/spec/frontend/state-management.md` now records the WebSocket reconnect recovery contract for future manual retry / room information UI work.
