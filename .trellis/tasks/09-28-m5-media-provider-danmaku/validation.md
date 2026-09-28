# M5 validation

Implementation and tests were committed as `e6c9535` after the owner's
Trellis Phase 3.4 approval.

## Automated gates

| Gate | Result |
| --- | --- |
| `./dx bun run typecheck` | Passed after aligning Kyoushitsu `@types/bun` with Housou's Elysia peer variant |
| `./dx bun run lint` | Passed; Biome checked 313 files |
| `./dx bun run test` | Passed; 480 tests, 0 failures and 2236 assertions |
| `./dx bun run contract:drift` | Passed; 18 generated files byte-stable |
| `./dx bun run --filter houkago-kyoushitsu-react build` | Passed; ArtPlayer/HLS/DASH in the lazy room chunk |
| `git diff --check` | Passed |
| `task.py validate 09-28-m5-media-provider-danmaku` | Passed; both context manifests valid |

The React `dist/module-graph.json` contains ArtPlayer, HLS and DASH and does
not contain Vue, Pinia, Eden or Housou server modules. The production build
prints a warning from the upstream minified Dash.js ESM distribution about a
CommonJS `exports` variable; the build completes and the DASH fixture plays.

## Browser preview

The isolated memory preview runs with `DX_EXTRA_PORTS=3195,5195` and
`./dx bash scripts/dev-react-preview.sh --backend-port 3195 --frontend-port
5195`. Browser commands set `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5195`,
`PLAYWRIGHT_HOUSOU_URL=http://127.0.0.1:3195`, and
`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome`. Chrome requires the
approved unsandboxed browser execution in this environment; a sandboxed launch
exits with SIGTRAP before any test starts.

- Media desktop and phone: local MP4/HLS/DASH, source/subtitle switching,
  play/pause, seek/rate, native/web fullscreen, cinema, two-client host and
  permitted-guest control, unauthorized guest lock, join catch-up, live
  danmaku echo and overlay subtree all passed in focused runs. A final
  keyboard Space activation of the focused play control passed in both media
  projects after the complete run.
- React real-cookie desktop and phone: registration, refresh, room continuity,
  approval, chat, queue and revocation passed after scoping the chat submit
  selector to its form.
- Danmaku desktop and phone: candidate precedence, newer room-default WS
  snapshot, personal override, local XML cue overlay, proposal, manual match,
  fullscreen subtree and stale item response passed (4 cases).
- Baidu desktop and phone: adapter pairing, retention, OAuth handoff, file
  browsing and source permit, revoke failure/success, guest permission,
  bounded grant playback and mobile explanation passed (3 applicable cases;
  3 cross-project cases intentionally skipped).
- Final complete React run: **41 passed, 3 intentional skips, 0 failed**
  across 44 scheduled cases. The command was
  `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5195 PLAYWRIGHT_HOUSOU_URL=http://127.0.0.1:3195 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu-react/playwright.config.ts --output=/tmp/houkago-m5-react-final`.

The Baidu HTTP/extension bridge and provider item WS snapshot are deterministic
fixtures. Registration, room admission and guest permission use real Housou.
No external Baidu credentials were used. The candidate HTTP and selected
room-default WS data in the danmaku suite are fixture-controlled, while room
login, queue and media playback use the isolated Housou and local clip.

## Review findings

Independent Trellis review found and fixed: stale playback after `JOUEI`;
fresh Baidu connection described as expired; OAuth handoff failure leaking a
  listener/popup. The room runtime regression test now checks the `JOUEI`
  reset. Browser tests also found and fixed a timeline match success message
  cleared by its own source refresh.
