# Design: Warm Club 2.0 interaction surface polish

## 1. Boundary and ownership

This child owns presentation of the remaining room interaction surfaces. It
does not own room state or interaction policy. Keep the existing component and
event boundaries:

| Surface | Owner | Design boundary |
| --- | --- | --- |
| Nickname/admission gates, queue confirmation, provider info, chat sheet, room cinema class | BushitsuView.vue | Style existing state branches and parent-owned layout state only |
| Player join gate and cinema control | EnmokuPlayer.vue | Keep gate calculation and cinema event emission unchanged |
| Chat composer/settings/send actions | ChatPanel.vue | Keep draft, resize, preferences, and emitted events unchanged |
| Member-removal dialog | KengenPanel.vue | Keep request, pending/error handling, and close/confirm paths unchanged |
| Provider connection and file-selection dialogs | BaiduConnectionDialog.vue, BaiduFileDialog.vue | Style current dialog structure only; preserve provider steps and security copy |

The chat message list and the shell/workbench hierarchy delivered by sibling
children are outside the redesign. New presentation must not move state into a
store, add props/events without a demonstrated need, or couple independent
provider and room state.

## 2. Visual model and token strategy

Continue the approved Warm Club 2.0 language: quiet paper-like surfaces, warm
ink, restrained wood accents, soft elevation, and a readable Japanese editorial
note. Use the existing primitive → semantic → component token architecture in
assets/theme.css. Prefer existing semantic, room, chat, and dialog tokens; add
small component recipes only when multiple in-scope surfaces need the same
meaningful value.

Do not adopt the UUPM-generated Aurora gradients, blue/green palette, or hosted
Google fonts. They conflict with the approved identity and asset-light boundary.
Its applicable guidance is limited to contrast, visible focus, keyboard
operation, distinct disabled/loading states, 44px touch targets, responsive
bounds, reduced motion, and consistent elevation/scrims.

Keep provider-brand accents where they identify the provider. Preserve the
user-selected chat text color and font size as content preferences; they are
not brand palette values.

## 3. Interaction and data contracts

- Keep native dialog open/close mechanisms, Escape handling, backdrop behavior,
  focus handling, labels, and existing action semantics.
- Keep the custom provider-info dialog's current ownership and dismissal path;
  do not turn this visual slice into a generic modal abstraction.
- Preserve nickname/admission and player-join state derivation. Waiting,
  closed, rejected, entering, and join states remain driven by current sources.
- Preserve chat draft clearing, composer resizing/settings, OSHABERI and
  DANMAKU emits, and the room's canChat gate.
- Preserve parent-owned cinema mode and EnmokuPlayer's event contract. Cinema
  retains the desktop chat rail and in-player danmaku overlay.
- Avoid script changes unless a strictly presentational accessibility defect
  cannot be corrected in markup/CSS; any such adjustment must not alter product
  behavior or protocol flow.

## 4. Responsive and accessibility behavior

Review phone 375x812, tablet 768x1024, short desktop 1280x640, and tall desktop
1280x1200. Mobile chat remains a bottom sheet with reachable expand/shrink and
close actions. Long dialog content remains bounded and scrollable inside its
surface, without obscuring primary actions. Maintain the room's existing scroll
owners and no-horizontal-overflow contract.

Use semantic roles and existing accessible names. Keep visible focus, status
text/icons in addition to color, at least 44px primary touch areas, and clear
disabled/pending/error states. Keep transitions within the existing restrained
motion language and disable nonessential movement for prefers-reduced-motion.

## 5. Styling and compatibility

Favor scoped styles in the owning component. Change theme.css only for a small
reusable token recipe justified by repeated use; do not introduce a parallel
palette or reset unrelated component styles. Do not alter provider assets,
global theme selection, route behavior, i18n messages, APIs, stores, sockets,
or media lifecycles.

## 6. Rollback and risk

Changes should remain limited to the named UI components, directly required
theme recipes, and affected browser tests. Each group can be reverted by
restoring its scoped styles/markup and tests. Main risks are scoped-style
specificity across native dialogs and responsive layouts, regressions to
keyboard dismissal/focus, and the desktop-chat-rail cinema invariant. The
implementation plan adds checks for each risk before final visual review.

