# Queue-control design guidance

## Purpose

Record the design-system and UI/UX evidence used to plan the queue and URL
source-composer slice. These recommendations are secondary to the approved
Warm Club 2.0 direction and the repository's room-shell contract.

## Repository authority

- `packages/kyoushitsu/src/assets/theme.css` already implements the approved
  primitive -> semantic -> component token architecture. New queue/composer
  recipes should derive from the existing semantic and `--room-*` values.
- `packages/kyoushitsu/src/views/BushitsuView.vue` already preserves semantic
  buttons, `aria-current`, alert/status live regions, action eligibility, and
  the desktop/portrait workbench structure.
- `packages/kyoushitsu/src/components/bangumi/EnmokuComposer.vue` already has
  visible labels, semantic URL input behavior, helper/error text, disabled
  async actions, preview state, and Escape-to-collapse behavior.
- The active frontend component spec fixes the desktop and portrait scroll
  owners, player-first hierarchy, 44px primary touch surfaces, focus behavior,
  and no-horizontal-overflow requirement.

## Applicable design-system guidance

The three-layer token model supports a small set of queue/composer component
recipes rather than new primitive colors or component-local raw values.
Interactive state priority should remain disabled -> loading -> active ->
focus -> hover -> default. Component states must not alter layout bounds.

The useful UI/UX database signals for this slice are:

- maintain at least 44x44px primary touch areas and about 8px between adjacent
  mobile actions;
- keep one visually primary action in each action group and subordinate
  secondary/destructive choices;
- disable asynchronous actions while pending and retain clear text feedback;
- announce errors with `role="alert"` and success with a polite status region;
- keep visible labels, semantic elements, synced ARIA state, visible focus,
  and non-color state cues;
- use a mobile-first wrapping/stacking strategy with no horizontal overflow at
  375px, then expand at tablet and desktop widths;
- keep micro-interactions subtle, tokenized, interruptible, and compatible
  with `prefers-reduced-motion`.

## Rejected generated recommendations

The design-system search also proposed a newsletter/content-first page
pattern, exaggerated minimalism, a black/pink palette, new Fredoka/Nunito
fonts, and route-transition choreography. Those suggestions conflict with the
approved Warm Club 2.0 identity or exceed this component slice, so they are
not part of the plan.

## Planned component anatomy

### Queue row

1. Source marker.
2. Title and provider availability detail.
3. Textual current-item status when applicable.
4. Action group with playback as the primary action, move/cancel as secondary
   actions, and delete visually separated as destructive.

Keep the existing DOM order and eligibility functions. On narrow screens the
action group may wrap or occupy a second row, but no action may become
hover-only or move behind a new menu.

### Source composer

1. Launcher group: add-link primary, provider browse secondary, connection
   management tertiary.
2. Visible URL/title labels and persistent helper text.
3. Preview block after successful resolution.
4. Resolve/add actions with explicit disabled and pending treatment.
5. Inline error and existing Escape/close behavior.

## Review targets

- 1280x640 short desktop: the stage remains the only left-column scroll owner
  and the expanded composer remains reachable.
- 1280x1200 desktop: queue rows scan quickly and the workbench remains
  content-sized and secondary to the player.
- iPad Mini / 768px class: queue actions wrap without crowding.
- 375x812 portrait: disclosure, rows, fields, and actions fit the viewport,
  retain 44px targets, and create no document-level horizontal overflow.
