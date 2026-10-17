# 悬浮按钮与快捷菜单执行计划

## Start gate

- [x] Task created as child of `10-12-room-player-experience`.
- [x] User confirmed the scope is the current room only; no cross-page FAB.
- [x] Read the user prompt, parent task artifacts, room runtime contract,
      frontend/visual/validation policies and UI/UX guidance.
- [x] User reviews and approves the final `prd.md`, `design.md` and this plan.
- [x] Run `task.py start` only after the planning review; implementation remains
      unauthorized while the task is `planning`.

## Ordered implementation

1. Establish a clean baseline and inspect the current room-controls pair. Run
   the focused unit checks and record the existing browser/preview boundary
   before changing behavior.
2. Refine `RoomSpeedDial` interaction state: keep click-vs-drag suppression,
   close an open shelf when a drag actually begins, preserve pointer capture,
   keep keyboard movement/focus restoration, and add only the minimal optional
   unavailable-action semantics required by the current API.
3. Refine menu measurement and direction: make updates conditional and
   viewport-aware, preserve normalized position/storage behavior, and ensure
   above/below transitions originate from the launcher without clipping labels or
   actions at edge/short-viewports.
4. Refine speed-dial-scoped CSS in `index.css`: complete rest/hover/pressed/
   dragging/focus/disabled states, keep 44px+ targets and 8px spacing, align
   labels/icons with Warm Club tokens, correct below-menu motion direction, and
   preserve reduced-motion and safe-area behavior.
5. Extend the existing `room-controls.spec.ts` only for missing user-visible
   behavior: open-menu drag convergence, press/disabled semantics if exposed,
   directional menu geometry, long labels/action counts, keyboard Space/arrow/
   Escape, 44px targets, and final desktop/phone states. Add unit coverage only
   for deterministic geometry/storage helpers.
6. Start the task-owned isolated preview with the project `dx` wrapper, probe
   the API/frontend addresses using the unified console contract, and run the
   focused desktop/phone room-controls suite. Capture settled normal/cinema,
   edge-position, short/tall, landscape, safe-area and reduced-motion evidence.
7. Re-run the affected suite after the last visual correction, then run the
   package/root quality gate and write actual results and residual risks to
   `validation.md`. Perform the final eight-dimension review before requesting
   visual acceptance.

## Validation commands

Run generation/drift before browser verification and never concurrently with a
watcher or browser run:

```sh
./dx bun run contract:drift
./dx bun test packages/kyoushitsu-react/test
./dx bun run --filter houkago-kyoushitsu-react typecheck
./dx bun run lint
./dx bun run --filter houkago-kyoushitsu-react build
```

Use the project preview contract with task-owned ports when defaults are busy:

```sh
DX_EXTRA_PORTS=3195,5195 ./dx bash scripts/dev-react-preview.sh \
  --backend-port 3195 --frontend-port 5195
```

Probe `http://127.0.0.1:3195/health` and
`http://127.0.0.1:5195/`, then run the existing room-controls pair:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5195 \
PLAYWRIGHT_HOUSOU_URL=http://127.0.0.1:3195 \
node_modules/.bin/playwright test \
  --config packages/kyoushitsu-react/playwright.config.ts \
  --project=room-controls-desktop \
  --project=room-controls-phone
```

Use the repository's approved Chromium/dx execution path from
`validation.md`; if the browser or fixture is unavailable, record the exact
attempt and classify it as unavailable rather than weakening assertions.

## Risk and rollback points

- Pointer drag changes can reintroduce accidental toggles or make the launcher
  steal page gestures. Verify mouse and real Chromium touch after each gesture
  change.
- Conditional geometry measurement can leave a stale menu placement or create a
  resize loop. Verify positions after action-count/label changes, visualViewport
  resize, rotation and safe-area changes.
- CSS state changes can lower contrast, remove focus visibility or alter the
  shared global button contract. Keep selectors under `.room-speed-dial-*` and
  check both themes if the runtime exposes them.
- New action disabled semantics must not invent permission policy. Verify the
  current RoomControls actions still route to existing callbacks and dialogs.
- If the child regresses layout or room controls, revert only the child-owned
  source/CSS/test edits; do not roll back parent player/danmaku changes.

## Completion evidence

The child is ready for review only when `prd.md` has passed the convergence pass,
the focused behavior and geometry checks have real results, the relevant quality
checks pass, final screenshots have an eight-dimension review, and remaining
human-only questions are explicitly classified in `validation.md`. Task archive,
commit, push and deployment remain separate lifecycle decisions.
