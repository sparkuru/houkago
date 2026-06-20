# P2 DASH playback composition

## Goal

Make the Bilibili parser output playable in the browser for public DASH videos by
turning separate Bilibili video/audio segment URLs into a stable eisha MPD route
and teaching the frontend player to load DASH media.

## What I already know

- The previous Bilibili parser slice returns `type: "dash"` and proxy-wrapped
  video variant URLs, but it does not include audio URLs.
- Bilibili `x/player/playurl?fnval=16` returns separate DASH video and audio
  streams, not a ready-made MPD URL.
- `houkago-kyoushitsu` currently has `hls.js` integration only; `dash.js` is
  documented in `design.md` but is not installed in `packages/kyoushitsu`.
- `Enmoku.sources` is currently a flat `{ name, url }[]`, so this slice should
  avoid a broad shared-contract redesign unless playback cannot work otherwise.
- `eisha` already owns media-plane proxying and header injection; `housou` must
  continue to only persist metadata and mount eisha routes.

## Requirements

- Bilibili parser must parse at least one playable audio stream from DASH
  `playurl` fixture data.
- Bilibili parser must return a primary `Enmoku.url` that points to a stable
  eisha-served MPD route, not directly to a video-only `.m4s` proxy.
- The synthetic MPD must reference eisha proxy URLs for both video and audio
  representations and preserve Bilibili media headers through proxy refs.
- The frontend player must load `type: "dash"` media through a DASH engine while
  preserving existing direct/HLS behavior.
- Existing source selection should remain local to the viewer for this slice; no
  room-wide quality synchronization is introduced.
- Housou create/list/BANGUMI persistence must continue to preserve
  parser-produced metadata.

## Acceptance Criteria

- [ ] `houkago-eisha` unit tests cover Bilibili DASH fixture data with video and
  audio and assert the generated MPD contains proxied audio/video URLs.
- [ ] `houkago-eisha` proxy/route tests cover fetching the generated MPD via a
  stable route/token.
- [ ] `houkago-kyoushitsu` player code supports DASH URLs with `dash.js` without
  regressing HLS/direct setup.
- [ ] Typecheck, lint, and full test suite pass.
- [ ] `design.md` and backend/frontend specs are updated if the route or player
  contract changes.

## Definition of Done

- Tests added/updated for parser, MPD generation, route/proxy behavior, and
  player branching where practical.
- `./dx bun run lint`, `./dx bun run typecheck`, and `./dx bun test` pass.
- The Trellis manual-test checkpoint states whether a real browser/Bilibili smoke
  test is required and what feedback is needed.

## Technical Approach

Preferred MVP: eisha generates a small static MPD document from Bilibili
`playurl` DASH metadata. The MPD route is served by eisha/housou and contains
proxied Bilibili video/audio representation URLs. The frontend adds `dash.js`
support inside `EnmokuPlayer.vue` for `type === "dash"` or `.mpd` URLs.

This keeps Bilibili-specific composition in the media plane, gives the browser a
standard DASH manifest, and avoids changing the room protocol or `Enmoku`
contract in this slice.

## Decision (ADR-lite)

**Context**: Bilibili public video playback needs audio and video to be consumed
together. The current parser only stores video URLs, while browsers and
ArtPlayer need a playable source.

**Decision**: Generate a stable eisha MPD for Bilibili DASH metadata and use
`dash.js` in the frontend to load DASH items.

**Consequences**: This adds a frontend dependency and an eisha manifest route,
but avoids putting Bilibili composition logic into housou or kyoushitsu. More
advanced Bilibili support can later extend the parser without changing the room
control plane.

## Out of Scope

- Cookie/login/VIP/WBI signing or anti-bot bypass.
- Multi-page Bilibili episode selection.
- Room-wide synchronized quality selection.
- Full subtitle/audio-track UI.
- Remote danmaku fetching; existing `danmaku: { type: "fetch" }` remains a
  placeholder reference.
- Browser automation against live Bilibili during automated tests.

## Technical Notes

- Likely impacted files:
  - `packages/eisha/src/parsers/bilibili.ts`
  - `packages/eisha/src/proxy.ts` or a new eisha DASH/MPD helper
  - `packages/eisha/src/routes.ts`
  - `packages/kyoushitsu/src/components/player/EnmokuPlayer.vue`
  - `packages/kyoushitsu/package.json`
  - relevant parser/proxy/player tests
- Existing tests to extend:
  - `packages/eisha/test/bilibili-parser.test.ts`
  - `packages/eisha/test/proxy.test.ts`
  - `packages/eisha/test/resolver.test.ts`
  - `packages/kyoushitsu/test/enmoku-metadata.test.ts` if URL selection changes
- Constraints:
  - Keep media bytes and manifest generation in `eisha`.
  - Keep `housou` as control-plane persistence only.
  - Use `./dx` for Bun commands; host has no Bun.
