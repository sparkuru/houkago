# Room-control speed-dial implementation plan

This is an independently verifiable child deliverable of M6. Follow the
acceptance criteria in `prd.md`; parent M6 owns the core extraction,
whole-application parity, and legacy-workspace removal.

## Ordered checklist

1. Review the React room contents, governance panel, queue layout, current room
   actions/permission boundaries, and the supplied Firefly behavior reference.
2. Implement the floating speed dial in React using data-driven actions and the
   existing callbacks. Preserve room information, authorization, and command
   behavior; do not add runtime or protocol state to the control.
3. Remove the in-flow room-control layout reservation. Place the anime playlist
   directly beneath the player in the desktop main column, let the room sidebar
   span both grid rows, and keep the phone order main → sidebar → queue. Do not
   change queue behavior.
4. Compose a right dock in this order: attendance roster, danmaku source and
   settings, chat. Keep one shared composer in `ChatPanel` with independent
   `弹幕` and `发送` actions in that order; preserve the existing permission
   gate and send through `room.danmaku` or `room.chat` respectively. Keep
   DanmakuFeature overlays connected to the current player, rendering danmaku
   as a flying track and chat as a lower-right transient notification.
5. Pin the full dock to the viewport's right edge on wide desktop and cinema
   layouts, reserve its dock lane, and keep messages scrolling within the chat
   card. At narrower and phone widths, keep the dock in the sidebar while the
   unified video-source controls remain in the lower 番组表 section.
6. Implement open/close, Escape, outside/backdrop click, focus entry/return,
   accessible button state/names, hidden-action inertness, safe-area spacing,
   touch targets, and reduced-motion behavior.
7. Verify desktop, portrait, and cinema layouts. Check that the closed control
   clears the player, queue, and shared composer, the open action menu stays in
   the viewport, the room dock stays pinned without obscuring room content, the
   playlist sits directly under desktop main content, and the page has no
   horizontal overflow at supported room sizes. Check the 1320px-capped normal
   desktop workspace, its header/grid/launcher alignment, clear space before
   the dock, and the empty-stage ratio/content centering at the applicable
   non-cinema desktop breakpoint. Confirm the cinema player retains its own
   16:9 screen geometry.
8. Record screenshots, automated results, and any residual human-review
   findings in this task. Resolve blocking findings before marking the child
   accepted for M6 parity.

## Validation plan

- Run the React package typecheck, unit suite, and production build through the
  repository `./dx` wrapper.
- Run focused React Playwright coverage with the isolated Housou/React preview
  and the task-owned preview ports documented by parent M6. Cover launcher and
  action behavior, all dismissal paths, focus handling, permissions, queue
  layout, desktop, portrait, cinema, touch, and reduced motion.
- Capture screenshots at the child PRD's supported room sizes and inspect them
  for overlap, clipping, safe-area placement, and visual residuals.
- Run `git diff --check` and the Trellis task validator for this task.

## Stop conditions

- Stop if an action becomes unavailable, permission checks change, or the new
  control duplicates room command/runtime ownership.
- Stop if hidden actions remain keyboard-focusable/clickable, focus is lost,
  reduced motion is ignored, or a supported layout clips/obscures room content.
- Do not remove the Vue workspace or declare M6 parity from this child; those
  remain parent M6 acceptance gates.
