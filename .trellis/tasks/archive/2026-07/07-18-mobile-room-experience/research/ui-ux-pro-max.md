# UI/UX Pro Max Research: Mobile Room Experience

## Queries

```text
shared video room mobile bottom sheet warm content-first
  --design-system --motion 3 --density 5

bottom sheet touch target focus trap modal dismiss reduced motion mobile video
  --domain ux -n 12
```

## Relevant Evidence

- The design-system query favoured a video-first pattern and a subtle motion
  tier. Its pink/dark palette and oversized editorial styling conflict with the
  established warm club-room semantic-token system, so neither is adopted.
- The UX query supports 44px minimum touch targets, 8px spacing between nearby
  touch controls, visible keyboard focus, reduced-motion support, a clear
  modal/sheet escape route, and avoiding gesture-only or conflicting vertical
  interactions.
- The existing UI already has a warm token system and `useRoomMotion`; this task
  should reuse both rather than create a second visual language or animation
  mechanism.

## Approved Inputs

- Preserve a video-first hierarchy in portrait layouts.
- Use a labelled launcher and explicit expand/close controls; a drag gesture is
  optional enhancement, never the only way to operate chat.
- Keep transitions to opacity/transform, 150–300ms, cancellable, and skipped
  for reduced motion.
- Use semantic tokens, 44px touch targets, visible focus, and a real modal
  escape path for the chat sheet.
