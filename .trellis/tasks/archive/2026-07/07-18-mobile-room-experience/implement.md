# Implementation Plan: Portrait Mobile Room Experience

1. [x] Inspect `BushitsuView`, `ChatPanel`, and `KengenPanel` for existing local
   state and semantic labels; add only i18n labels needed by the new controls.
2. [x] Add a portrait-only chat launcher and focus-managed bottom-sheet wrapper
   in `BushitsuView`, preserving the existing chat emits and `ChatPanel` content.
3. [x] Add 60% and 90% sheet states with viewport-safe internal scrolling,
   explicit expand/close controls, Escape/backdrop dismissal, focus restoration,
   reduced motion, and no gesture-only path.
4. [x] Add portrait-only summary/disclosure wrappers for room information and
   the playlist. Keep existing Kengen and queue handlers/data sources unchanged.
5. [x] Run frontend checks and a Chromium Playwright regression at iPad Mini
   portrait dimensions. [ ] Manually test 375px and 768px portrait, tablet
   landscape, desktop, keyboard navigation, reduced motion, chat
   permission/read-only state, and virtual keyboard composer visibility.

## Validation

```bash
./dx lint
./dx run typecheck
./dx run --filter houkago-kyoushitsu test
./dx run --filter houkago-kyoushitsu build
```

Completed: lint, all-workspace typecheck, 105 frontend tests, a Playwright
Chromium regression at 375px phone and iPad Mini portrait dimensions for chat
open/expand/close/Escape, and the frontend production build pass. The build
retains the pre-existing dash.js CommonJS warning. The user manually approved
the repaired iPad Mini interaction.

## Risk Points

- Do not turn `ChatPanel` into a WebSocket or room-state owner.
- Do not let focus escape behind the open chat sheet or leave it stranded after
  close.
- Do not introduce a second vertical scroll region that makes the composer or
  sheet close action unreachable.
- Keep the reviewed desktop/landscape player-plus-chat split untouched.
