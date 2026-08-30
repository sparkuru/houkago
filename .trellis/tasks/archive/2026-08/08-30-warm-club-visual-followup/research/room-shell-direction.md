# Room shell direction research

## Research scope

This note records the repository and local UI/UX research used to plan the
Warm Club 2.0 room-shell follow-up. It is planning input, not a replacement
for the approved product requirements.

## Repository evidence

- `packages/kyoushitsu/src/views/BushitsuView.vue:691` owns the entered-room
  shell and keeps the room viewport fixed on desktop.
- `BushitsuView.vue:721` renders the player stage first. Metadata and the room
  workbench follow the player; the workbench contains room controls and the
  queue at `BushitsuView.vue:855`.
- Desktop chat is a sibling `ChatPanel` rendered after the stage, while the
  portrait layout uses the `mobile-chat-sheet` dialog and launcher at
  `BushitsuView.vue:848` and `:1047`.
- Cinema mode is a deliberate media-first state: it hides metadata, workbench,
  mobile launcher, and collapsed-chat handle while retaining the established
  desktop chat rail and in-player danmaku overlay.
- The current shell already protects the important responsive contracts: a
  16:9 player, intentional `.stage` scrolling for short desktop windows, a
  stacked portrait workbench, and 44px action surfaces.
- Existing browser specs cover the changed shell's behavioral boundaries in
  `e2e/desktop-room.spec.ts`, `e2e/mobile-room.spec.ts`,
  `e2e/room-governance.spec.ts`, `e2e/subtitle-*.spec.ts`, and
  `e2e/danmaku-source.spec.ts`.

## Local design-system research

The project-local UI/UX Pro Max search for an entertainment/social video room
with warm paper and content-first keywords returned a newsletter-like,
exaggerated-minimalism direction with vibrant pink/blue colors and hosted
Fredoka/Nunito fonts. Those recommendations are research only and are not
adopted: they conflict with the user-approved quiet Warm Club 2.0 room, the
existing cream/wood token palette, and the asset-light/no-network-font
boundary.

The reusable guidance that does apply is:

- use semantic color, spacing, typography, elevation, and layering tokens;
- keep one visual priority per screen (the player in this room);
- maintain 44px touch targets, visible focus, labels, and non-color status
  cues;
- keep responsive gutters and prevent horizontal overflow;
- limit motion to purposeful opacity/transform transitions in the 150–300ms
  range, cancel replacements, and honor `prefers-reduced-motion`.

The repository's existing `theme.css` already implements a primitive →
semantic → component token hierarchy. The follow-up should add only room-shell
recipes that derive from those semantic values; it should not create a second
palette or a competing token file.

## Planning conclusion

The lowest-risk slice is a shell-only visual pass: refine the room canvas,
player frame, metadata strip, desktop chat rail, room-control/queue wrappers,
portrait disclosures, and cinema transition presentation. Keep inner component
behavior and domain state untouched. Queue-control density, dialog content, and
chat composer polish remain later child tasks.
