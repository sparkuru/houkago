# M5 React media, provider and danmaku migration

## Goal

Make the default local React room play and synchronize the selected programme.
Restore the existing media, Baidu source and danmaku behavior in React while
preserving the M4 room authority. M6 still owns whole-app parity and production
cutover.

## Confirmed background

- M4 is committed and archived. React directly owns `/bushitsu/:id`, but its
  current-item card says playback is unavailable. M4 passed 471 tests and 28
  browser cases (`archive/2026-09/09-28-m4-room-features/validation.md`).
- M1 extracted `PlayerHandle` and `createShinkouController`. The Vue player
  still owns ArtPlayer, HLS, DASH, pending seek, source/subtitle selection and
  fullscreen (`packages/kyoushitsu/src/lib/player.ts`,
  `src/lib/shinkou-controller.ts`, `src/components/player/EnmokuPlayer.vue`).
- React `room-runtime.ts` retains the current item but does not retain
  `SHINKOU`/`GENJOU` playback state or `DANMAKU_DEFAULT`. The shared generated
  HTTP layer already has Baidu grant and danmaku read operations; Vue uses
  Eden for other existing Baidu/danmaku actions.
- The approved migration contract is S1–S6 in the archived frontend refactor
  `spec.md`. The owner selected direct React room migration without a Vue
  fallback or old-version compatibility requirement for this local path.

## Requirements

- **R1 — Media lifecycle.** Render the current item through one owned
  ArtPlayer/HLS/DASH driver implementing `PlayerHandle`. Support ordinary
  video, HLS, DASH, source switching, loading/error, pending seek, subtitle
  selection, native/web fullscreen and deterministic cleanup after item,
  source, room, identity or route changes.
- **R2 — Playback authority.** Reuse the M1 sync controller with M4's single
  room session. Update server-authored `SHINKOU`/`GENJOU` state before player
  effects. Host and permitted guests may originate control; other guests only
  follow. Preserve join-gesture/autoplay, drift, echo suppression and catch-up.
  Local player time never becomes a second authority.
- **R3 — Baidu.** Restore desktop connection/pairing, retention choice, OAuth
  handoff, status/revoke, read-only file browsing, source creation/permission,
  availability and grant-backed playback. Show missing/incompatible adapter,
  owner-offline, revoked/expired and mobile-unavailable states. Keep one-use
  grants transient, non-retried, bounded and cancelled on scope changes;
  preserve fresh-grant recovery after optional fingerprint failure. Ordinary
  sources remain available on mobile. Personal connection management stays
  available to admitted members without playlist permission; file browsing
  and source insertion require that permission.
- **R4 — Danmaku.** Restore live room danmaku send/display, timeline candidates, local
  files, personal override, room default, public proposal and manual
  search/match flows from the Vue room. Preserve provenance, policy,
  fallback/error states and local display preferences. Overlay rendering
  follows local player time in the correct fullscreen subtree.
  `DANMAKU_DEFAULT` remains a server-authored room snapshot.
- **R5 — UX and compatibility.** Keep Warm Club identity and usable desktop
  and 375px media controls, keyboard focus, permission lock, join gate,
  subtitle/source selectors, cinema and danmaku controls. Preserve room URLs,
  admission, queue and governance from M4 and existing Housou HTTP/WS,
  database, media/provider and adapter contracts.
- **R6 — Verification.** Use deterministic local media, Housou and adapter
  fixtures for two-client playback, provider and danmaku checks. Retain
  aggregate package tests and generated-contract drift validation. External
  provider credentials are not an automated acceptance prerequisite.

## Acceptance criteria

- [x] **A1 (R1).** Fixture MP4/HLS/DASH items play in React; source/subtitle
      switching, fullscreen, deferred seek and teardown work without duplicate
      engines or stale callbacks after switches and Strict Mode replay.
- [x] **A2 (R2).** Two admitted browser clients prove host and authorized
      guest play/pause/seek/rate; unauthorized input is blocked while remote
      playback still applies. Late join catches up within the join gesture;
      existing sync assertions retain their behavior.
- [x] **A3 (R3).** Fixture-backed Baidu pairing, retention, file/source and
      playback state matrix work in React. Effect replay does not create a
      duplicate grant; only an optional fingerprint failure may trigger the
      documented fresh grant. Polling stops at terminal/expiry, URL is not
      persisted, and scope changes cancel work. Failed remote revoke preserves
      visible connection/local authority; successful revoke clears local
      authority. Mobile explains desktop-only Baidu without hiding normal
      media.
- [x] **A4 (R4).** Browser and unit checks cover live send/display, timeline/file cues,
      personal/room/default precedence, fallback, proposal and manual match.
      Newer room-default WS state wins over stale candidate HTTP; old room or
      item responses cannot repaint overlays.
- [x] **A5 (R5).** React controls are keyboard usable at desktop and 375px;
      fullscreen contains overlays/dialogs, permission lock allows follower
      sync, cinema stays local, and M4 room checks remain green.
- [x] **A6 (R6).** Root lint/typecheck/tests, React build, contract drift,
      focused Playwright fixtures and module boundary checks pass. The React
      bundle excludes Vue, Pinia, Eden and Housou server modules.

## Out of scope

- Production deployment, old-frontend retirement and final whole-app parity
  or rollout acceptance (M6).
- New provider capability, mobile Baidu playback, new danmaku policy or
  moderation, backend endpoints, database schema or WS protocol.
- Live external-provider credentials as an automated acceptance gate.

## Risk and deferred items

Browser autoplay, native fullscreen and adapter behavior depend on the
environment. Deterministic fixtures prove local contracts; optional live
provider checks are recorded separately. M5 is broad but remains one task
because media, provider and danmaku meet at one player and room session.
