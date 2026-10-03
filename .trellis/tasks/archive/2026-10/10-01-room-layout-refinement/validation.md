# Validation: React room layout refinement

Date: 2026-10-03

## Application checks

- `./dx bun run lint` — passed (`biome check`, 320 files).
- `./dx bun run --filter houkago-kyoushitsu-react typecheck` — passed.
- `./dx bun test packages/kyoushitsu-react/test` — passed: 47 tests, 0
  failures, 211 expectations.
- `./dx bun run --filter houkago-kyoushitsu-react build` — passed. The build
  still reports the existing Dash.js `COMMONJS_VARIABLE_IN_ESM` warning; it
  does not fail the build.
- `./dx bun run test` — passed: 485 tests, 0 failures, 2250 expectations.
- `bash -n dx && bash scripts/test-react-preview.sh` — passed: 93 shell
  behavior checks.
- `docker build --file Dockerfile.dev --tag houkago-dev:playwright .` — passed.
- `docker run --rm houkago-dev:playwright sh -lc 'ldconfig -p | grep -F
  "libglib-2.0.so.0"'` — passed; the Chromium runtime library resolves to
  `/lib/x86_64-linux-gnu/libglib-2.0.so.0`.
- `python3 ./.trellis/scripts/task.py validate
  10-01-room-layout-refinement` — passed; both context manifests contain 7
  curated entries.
- `git diff --check` — passed.

## Browser checks

The relevant Playwright specs were updated for the wide-room geometry, dock
clearance, draggable launcher, persisted position, cinema visibility, and web
/native fullscreen hiding. With the rebuilt image and isolated preview ports,
the room-controls desktop/phone projects passed: 4 tests, 0 failures.
The run covered chat versus danmaku routing, unified source placement,
launcher drag/focus/menu behavior, responsive geometry, cinema mode, and
fullscreen visibility. Unit coverage validates the position math, safe-area
clamping, persistence format, and resize behavior.

The follow-up full-height dock run also passed the same 4 desktop/phone tests.
It asserts that the fixed rail reaches both viewport safe-area edges and has a
visible surface, while the feed remains an internal scroll container. At
1200–1599px, the launcher stays clear of the queue and its open actions are
offset left of the fixed dock when needed so the chat composer remains usable.

## Scope review

- The room dock remains the fixed far-right attendance → danmaku → chat rail.
- At fixed desktop/cinema breakpoints, the dock's visible outer surface fills
  the available viewport height; its chat card/feed keeps independent internal
  scrolling and the phone dock remains in normal flow.
- The main workspace expands to the dock boundary instead of retaining the
  old wide-screen blank lane.
- Room information and copy-link actions are available from the body-level,
  draggable `+` menu; the duplicate top kicker/copy action is removed.
- Cinema mode keeps the launcher visible; only actual web/native fullscreen
  removes it from the visual and accessibility trees.
- No backend, WebSocket protocol, or legacy Vue implementation was changed by
  this task.

## Follow-up regression

The first wide-screen implementation expanded the page's content width but
left the fixed dock's wrapper as a second `.room-grid` column. That wrapper had
no visible content because the dock itself was fixed, producing the large
blank region shown in the 2026-10-03 screenshot. The follow-up removes that
in-flow track at the fixed-dock breakpoint and adds a regression assertion for
the main/queue workspace reaching the dock boundary.

## Content-height and return-menu correction

The 12:30 screenshot exposed a gap left by the previous surface-only change:
the dock background reached the bottom, but the chat card was still capped at
60vh/560px. That historical pass did not verify the requested internal fill.
The current correction removes the cap and uses a flex-column dock with
`ChatPanel` growing into the remainder. Its feed scrolls internally, and the
composer aligns to the chat card's inner bottom. Roster/settings shrink and
scroll in shorter viewports; mobile remains normal flow.

`返回楼层` now appears in the admitted viewer's `+` menu and uses the existing
TanStack home navigation. Gated viewers retain their topbar return link because
their action menu is unavailable.

Current checks:

- Containerized root lint and React typecheck passed.
- Isolated Playwright room-controls desktop/phone projects: 6 passed. Assertions
  compare the chat bottom with the dock's inner bottom and the form bottom with
  the chat's inner bottom, accounting for padding/borders; menu return and gated
  return both navigate to `/`. Tall/wide room, cinema and internally scrolling
  chat history remain covered.
- Root tests: 485 passed, 0 failed, 2250 expectations.
- React production build passed; existing Dash.js warning remains.
- Independent Trellis check review passed with no findings or additional edits.
- The closed launcher's queue clearance assertion now measures actual queue
  buttons, inputs and links. At 1280px it can overlap blank card padding by
  about 20px while remaining clear of the interactive controls.
- Screenshot evidence: `packages/kyoushitsu-react/test-results/room-controls-playlist-wid-5ceb1-cinema-controls-stay-usable-room-controls-desktop/room-controls-empty-wide-layout.png`.
- Existing 9999 preview bind-mounts this checkout and serves source through Vite;
  edits are available via hot reload. No backend/data restart was needed.

## Human acceptance and completion

Before committing, the updated media desktop/phone projects were run as well.
The first run exposed stale automation assumptions: playback permission had
moved into the `+` dialog, and synthetic Escape did not exit Chromium native
fullscreen. The tests now use that dialog and the existing player fullscreen
toggle, assert actual fullscreen exit before launcher restoration, and wait
for the server-echoed permission checkbox state after clicking. These are
test-only corrections; application behavior and assertions remain intact.
Final media regression: 6 passed (9.4 seconds), covering MP4/HLS/DASH,
source/subtitle/seek/rate, fullscreen hiding/restoration, two-client playback
permission, ordinary chat notifications and danmaku. Root lint passed again.

On 2026-10-03 the owner confirmed `通过视觉验收，可以提交` after reviewing
the corrected layout. The current task's visual acceptance is complete and
work commits, archival, and session recording are authorized. M6 planning,
the separate speed-dial task, and unrelated preview/policy changes remain
outside this task's archival scope.

Work commits: `3b0e7ed` (container browser runtime) and `4db7e82` (room UI,
regressions and runtime contracts). React typecheck and the focused independent
media-test review passed again before the UI commit. Native fullscreen exit
is tested via its player toggle, not browser-reserved keyboard handling.
