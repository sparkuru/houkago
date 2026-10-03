# Room Controls Validation

## Automated checks

| Check | Result |
| --- | --- |
| `./dx bun run lint` | Passed (318 files) |
| `./dx bun run --filter houkago-kyoushitsu-react typecheck` | Passed |
| `./dx bun run --filter houkago-kyoushitsu-react test` | Passed (42 tests, 198 assertions) |
| `./dx bun run --filter houkago-kyoushitsu-react build` | Passed; existing DashJS `COMMONJS_VARIABLE_IN_ESM` warning |
| Focused React room-controls Playwright | Blocked in this environment: the isolated preview started on task ports, but all 4 browser workers exited before tests because Chrome received `SIGTRAP` from Crashpad (`setsockopt: 不允许的操作`) |
| Phone cinema closed-launcher clearance | Passed; composer ends 53.22px above the fixed launcher at 375×812 |
| `python3 ./.trellis/scripts/task.py validate 09-28-room-control-speed-dial` | Passed (both context manifests valid) |
| `git diff --check` | Passed after implementation, spec, and validation updates |

Start the isolated preview in one terminal:

```sh
DX_EXTRA_PORTS=3195,5195 ./dx bash scripts/dev-react-preview.sh \
  --backend-port 3195 --frontend-port 5195
```

Run the focused browser checks in another terminal:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5195 \
PLAYWRIGHT_HOUSOU_URL=http://127.0.0.1:3195 \
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome \
node_modules/.bin/playwright test \
  --config packages/kyoushitsu-react/playwright.config.ts \
  --project=room-controls-desktop \
  --project=room-controls-phone \
  --output=/tmp/houkago-room-layout-refine-final
```

## Screenshot evidence

- Owner's marked dock target: [room-dock-layout-reference.png](research/screenshots/room-dock-layout-reference.png)
- Wide desktop layout with the revised fixed dock: [desktop-room-dock-layout.png](research/screenshots/desktop-room-dock-layout.png)
- Wide desktop empty room with the revised dock: [desktop-room-dock-empty.png](research/screenshots/desktop-room-dock-empty.png)
- Desktop cinema with the revised dock: [desktop-room-dock-cinema.png](research/screenshots/desktop-room-dock-cinema.png)
- Normal phone flow: [phone-room-dock-layout.png](research/screenshots/phone-room-dock-layout.png)
- Phone cinema with the revised dock: [phone-room-dock-cinema.png](research/screenshots/phone-room-dock-cinema.png)
- Previous speed-dial evidence remains in this directory: desktop/phone menu-open and room-dialog screenshots.

## Human review pending

- The owner requested attendance → danmaku controls → chat in one dock and one
  composer with two independent actions, `弹幕` immediately left of `发送`.
  The fixed dock stays right-aligned
  on wide desktop/cinema; at compact and phone widths it flows in the sidebar.
  The unified video-source controls, including Baidu, are in the lower 番组表
  section. The queue remains directly below the player at main-column width on
  desktop and follows the sidebar on phones.
- The normal workspace remains capped at 1320px, with aligned header/grid and a
  16:9 empty waiting stage. At 2048px the launcher remains 16px inside the
  workspace edge and the fixed dock has a reserved lane. Browser geometry
  checks cover 1199, 1200, 1280, 1599, 1600, and 2048px.
- The closed launcher clears the player, queue, and shared composer. Open menu
  actions may overlap page content while the backdrop blocks underlying
  pointer access. The phone cinema composer compacts its shared input and
  two-action row; its accessible labels remain present while visually hidden.
- Safe-area spacing uses `env(safe-area-inset-*)` and stays within tested
  viewport bounds. A physical notched-device review has not been performed.
- The room settings dialog remains centered, within captured desktop/phone
  bounds, and internally scrollable on phone.

## Latest owner refinement

The revised layout and interaction checks above are complete. Owner review of
the updated screenshots remains pending; the task stays in progress until that
visual review and the Trellis commit gate are complete.

When the preview ports are available, use <http://127.0.0.1:5195> (Housou API:
<http://127.0.0.1:3195>) for manual review. Do not mark this child accepted for
M6 until the owner has reviewed the visual/interaction residuals above.

## Current reviewer checkpoint (2026-09-30)

- `bun run lint`: passed (318 files).
- `bun run --filter houkago-kyoushitsu-react typecheck`: passed.
- `bun run --filter houkago-kyoushitsu-react test`: passed (42 tests, 198
  assertions).
- `bun run --filter houkago-kyoushitsu-react build`: passed.
- `python3 ./.trellis/scripts/task.py validate 09-28-room-control-speed-dial`:
  passed; `git diff --check`: passed.
- Focused React room-controls Playwright was attempted at this checkpoint with
  the isolated preview on ports 3196 and 5196. The preview started, but all
  four desktop/phone workers exited before the first assertion because the
  container's Chrome terminated with `SIGTRAP` after Crashpad reported
  `setsockopt: 不允许的操作`. The new browser assertions therefore remain
  unverified here; this is an environment/browser-launch limitation rather than
  an application assertion failure.

## Final parent validation and owner acceptance — 2026-10-04

The parent M6 full suite passed 60 React browser cases, including all speed-dial
focus/dismissal/drag/resize/shared-composer cases and populated normal/cinema
clearance at five viewport sizes. Member information and presets were restored.
Root 496 tests, types, lint and build passed. The earlier browser-launch blocker
is superseded by current successful host Chromium runs. See parent
`research/parity-matrix.md` and `validation.md` for exact commands/artifacts.
The owner accepted visuals and continuation/commits including all dirty files.
Child A1–A6 are accepted and it is ready for normal completed-task archival.
