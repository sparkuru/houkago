# React room layout refinement implementation plan

## Ordered checklist

1. Re-read the current React room, speed-dial, player fullscreen, and layout
   contracts. Preserve unrelated dirty work from the preceding room-control
   task.
2. Extract or add a small React room presentation helper for normalized
   floating-control coordinates: safe default, localStorage load/save,
   viewport/element clamping, and resize re-clamping.
3. Refactor `RoomSpeedDial` / `RoomControls` into a body-level, draggable
   viewport overlay. Preserve menu focus, Escape, backdrop dismissal, inert
   closed actions, accessible labels, reduced motion, and accidental-click
   suppression after a drag. Keep room information and copy-link actions in the
   menu.
4. Extend `PlayerStage`'s parent callback boundary to expose web/native
   fullscreen state, and hide the floating overlay only for those states. Keep
   cinema mode visible and do not alter player authority or media lifecycle.
5. Remove the duplicated top kicker/copy action from `RoomContents`, expand the
   desktop workspace into the space before the fixed chat dock, and retain
   mobile/cinema responsive behavior.
6. Add focused unit and Playwright coverage for coordinate persistence,
   drag/clamp behavior, full-screen visibility, top-action removal, workspace
   geometry, dock clearance, and existing room action routing.
7. Provide a project development image based on `oven/bun:1` with the
   Chromium system libraries, make `dx` build it on demand, and verify the
   rebuilt image before browser execution.
8. Run typecheck, focused and root tests, build, lint, Trellis validation, and
   diff checks. Run the isolated browser preview with the rebuilt image and
   record any remaining browser restrictions separately from app failures.
9. Update this task's validation evidence and, only after review, hand off for
   Trellis finish/commit. Do not archive the parent M6 task from this child.

## Validation commands

```sh
./dx bun run --filter houkago-kyoushitsu-react typecheck
./dx bun run --filter houkago-kyoushitsu-react test
./dx bun run --filter houkago-kyoushitsu-react build
./dx bun run lint
./dx bun run test
python3 ./.trellis/scripts/task.py validate 10-01-room-layout-refinement
git diff --check
```

Focused browser verification should use task-owned Housou/React preview ports
and cover desktop, phone, cinema, pointer drag, reload persistence, resize,
and web/native fullscreen where supported.

## Risk and rollback points

- First rollback point: coordinate helper and persistence only; disable storage
  and retain the fixed safe default if malformed data or viewport edge cases
  appear.
- Second rollback point: body portal/drag shell; restore the existing fixed
  launcher while retaining the top-action consolidation and workspace width
  changes.
- Final rollback point: fullscreen callback wiring; keep the previous player
  controls intact if a browser-specific fullscreen event breaks playback.
- Stop if the launcher can escape the viewport, remains focusable in fullscreen,
  overlays the dock/player, or any room command/permission path changes.
