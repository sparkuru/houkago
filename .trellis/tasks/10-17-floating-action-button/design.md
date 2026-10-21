# 悬浮按钮与快捷菜单技术设计

## Ownership and boundaries

The deliverable is a presentation-only refinement of the existing React room
speed dial. `RoomControls` continues to assemble actions and own room/runtime
callbacks; `RoomSpeedDial` owns only open/closed, drag, menu geometry, focus and
animation state. No runtime, socket, permission, queue, player, or fullscreen
business state moves into the component.

Primary files:

- `packages/kyoushitsu-react/src/features/room/room-speed-dial.tsx` — state,
  pointer/keyboard interaction, action semantics and geometry measurement.
- `packages/kyoushitsu-react/src/features/room/room-floating-position.ts` —
  only if the refinement exposes a tested geometry edge case; preserve storage
  version 1 and normalized coordinates.
- `packages/kyoushitsu-react/src/styles/index.css` — speed-dial-scoped visual
  states, menu direction, motion and safe-area presentation.
- `packages/kyoushitsu-react/e2e/room-controls.spec.ts` and focused unit tests —
  visible behavior and final geometry, not CSS implementation mirrors.

Do not extract a cross-page FAB, add a dependency, alter legacy Vue, or change
the parent task's room/player/danmaku contracts.

## Existing contracts to preserve

- The launcher is rendered through a `document.body` portal and may overlap any
  room content by explicit user choice. It must not reserve layout space or
  restore obstacle avoidance.
- `houkago.kyoushitsu.room-floating-position.v1`, default `{ x: 1, y: 0.65 }`,
  16px minimum safe insets, viewport resize clamping, and position persistence
  remain compatible with existing users.
- Actual web/native fullscreen removes the launcher from the tree; normal and
  cinema room modes keep it available.
- Closed actions remain both `aria-hidden` and `inert`; opening focuses the
  first action; Escape, backdrop dismissal, toggle and action activation return
  focus to the launcher.
- `RoomSpeedDialAction.onActivate` continues to invoke the existing room action
  without optimistic state or a second command owner.

## Interaction model

### Launcher and action states

Use existing `data-open` and `data-dragging` attributes plus narrowly scoped
optional action state (if needed by the current action list) to style:

- resting, hover-capable, pressed, expanded, dragging, focus-visible and
  disabled action states;
- a stable 52px launcher and 52px action icon target, with no state changing
  layout dimensions;
- semantic SVG icons and visible labels, preserving the existing accessible
  names and dialog affordances.

Pressed feedback uses token-based color/elevation/opacity changes and a small
icon-level response rather than a box transform that could perturb drag-start
geometry. The disabled state is native `disabled`/`aria-disabled` behavior when
an action is actually marked unavailable; no current permission rule is
duplicated in the speed dial.

### Click, drag and keyboard

- Keep the movement threshold so a click opens/toggles and a drag only moves.
- When a pointer drag crosses the threshold while the menu is open, close the
  menu before moving the launcher. This makes the launcher the sole spatial
  origin and prevents action buttons from trailing behind it.
- Coalesce high-frequency pointer position updates to animation frames where
  useful, and commit the normalized position on drag completion. Keyboard
  nudges continue to update and persist immediately.
- Keep Pointer Events and pointer capture for mouse/touch/trackpad. Preserve
  the existing `touch-action: none` drag affordance and do not block browser
  back-swipe or unrelated page gestures outside the launcher.
- Native button behavior supplies Enter/Space activation; arrow keys nudge by
  the existing step and Shift doubles it. Escape closes the menu without
  stealing an unrelated fullscreen Escape path because the component is absent
  during actual fullscreen.

### Menu geometry and motion

- Continue calculating horizontal clamping from the measured action shelf width
  and vertical placement from available space above/below the launcher, using
  safe-area insets and the current visual viewport.
- Re-measure after action labels/count, viewport, launcher size or open-state
  changes. Avoid a render-measure-set-state loop by scoping layout effects and
  updating state only when the measured value changes.
- For `above`, actions enter from just below the launcher and travel upward; for
  `below`, they enter from just above and travel downward. The same origin is
  used for exit, with exit shorter than entry and all motion interruptible.
- Keep labels readable within the available width. Allow controlled wrapping
  or an equivalent accessible full-label fallback rather than silently losing
  meaningful text to an ellipsis. The action shelf may scroll only when the
  viewport cannot display all actions at once.
- Keep the action shelf visually unboxed: labels and icon circles use the semantic raised surface and border, but do not add individual box shadows or a group shadow. Only the launcher keeps floating elevation, so adjacent shadows cannot merge into a rectangular gray patch around the menu. Scrolling and clipping remain layout concerns and must not be used to hide a shadow artifact.
- Use the existing 4/8px spacing rhythm, semantic surface/accent/focus tokens,
  current elevation and radius values. Do not adopt the generic UI search's
  unrelated neon/dark gaming palette; it conflicts with the accepted Warm Club
  identity.

## Accessibility and responsive behavior

- Preserve semantic button names, `aria-expanded`, `aria-controls`, `aria-hidden`,
  `inert`, `aria-haspopup` and focus restoration. Ensure disabled actions are
  not activated and do not create a dead keyboard stop without explanation.
- Keep every interactive target at least 44×44 CSS px, maintain an 8px visual
  gap between adjacent action targets, and retain the direction-key hint as a
  screen-reader-accessible instruction.
- Validate the rendered launcher/menu rather than only CSS values at 320/375,
  768/812, 1280/1440, both orientations, short/tall viewports, 200% text and
  injected safe-area padding. No horizontal overflow or inaccessible action is
  acceptable.
- Reduced motion removes decorative translate/scale/stagger while retaining
  state visibility, focus, press feedback and immediate operability.

## Data flow

```text
RoomRuntime / RoomControls actions
        ↓ callbacks + presentation labels
RoomSpeedDial local state
  open · dragging · position · placement · menu bounds
        ↓ portal + semantic buttons + CSS tokens
document.body speed-dial layer
        ↓ existing callbacks only
room dialog / home navigation / copy feedback
```

The component never writes room truth. Position storage is the only local
side-effect and remains the existing versioned preference.

## Compatibility and rollback

The expected change is limited to the React room feature, scoped CSS and
focused browser/unit assertions. No migration or feature flag is needed. If a
visual or gesture refinement regresses room controls, revert only the child
task's speed-dial source/style/test changes; retain the parent task's player,
chat, danmaku and room-layout work.
