# Design: Portrait Mobile Room Experience

## Scope and Boundaries

This task improves interaction density only at the existing portrait breakpoint
(`max-width: 800px` and portrait orientation). It keeps desktop and landscape
layouts intact and preserves the player wrapper, danmaku geometry/timing, room
API, router, Pinia state, WebSocket client, chat transport, and permissions.

## Portrait Information Hierarchy

1. Player and existing media toolbar.
2. A labelled chat launcher, visible without hover.
3. Compact room status and playlist summaries.
4. Explicitly expanded room-management controls and full playlist.

The summaries expose room identity/connection state and the current queue
context. Details remain in the same components and data flow; they are merely
progressively disclosed.

## Chat Sheet

`BushitsuView` remains the owner of local presentation state. On portrait
layouts it owns whether the sheet is open and whether it is in its focused
height. `ChatPanel` remains responsible for chat rendering/composition and
continues to emit the existing typed domain events; it does not create sockets
or own sheet state.

The chat launcher is a real labelled button with `aria-expanded` and a stable
control relationship to the sheet. Opening presents a native modal dialog or
equivalent focus-managed sheet:

- initial height: approximately `60dvh`;
- focused height: approximately `90dvh`;
- visible expand/focus and close controls, with at least 44px touch targets;
- backdrop click and Escape close the initial sheet; focus returns to the
  launcher;
- the sheet's composer remains above the virtual keyboard through viewport-safe
  sizing and intentional internal scrolling.

The sheet must not depend on drag alone. A drag affordance may be added only if
it does not compete with the chat log's vertical scrolling and the visible
buttons remain complete alternatives.

## Motion and Accessibility

Reuse `useRoomMotion` for transform/opacity sheet transitions. Effects are
short, cancellable on unmount/replacement, and skipped by
`prefers-reduced-motion`. Do not animate player media, timeline, danmaku, list
rows, or background decoration.

Use semantic theme tokens; preserve the global focus ring; keep touch targets
at least 44px. The logical focus order is launcher -> sheet controls -> chat
history/composer -> close control, with native dialog focus containment where
available.

## Rollback

The change is presentation-local. Reverting the portrait-only sheet and
disclosure wrappers restores the reviewed stacked layout without touching room
protocol or media state.
