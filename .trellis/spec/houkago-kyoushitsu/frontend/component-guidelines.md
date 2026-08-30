# Component Guidelines

> How components are built in this project.

---

## Overview

<!--
Document your project's component conventions here.

Questions to answer:
- What component patterns do you use?
- How are props defined?
- How do you handle composition?
- What accessibility standards apply?
-->

(To be filled by the team)

---

## Component Structure

<!-- Standard structure of a component file -->

(To be filled by the team)

---

## Props Conventions

<!-- How props should be defined and typed -->

(To be filled by the team)

---

## Styling Patterns

<!-- How styles are applied (CSS modules, styled-components, Tailwind, etc.) -->

(To be filled by the team)

---

## Accessibility

<!-- A11y requirements and patterns -->

(To be filled by the team)

---

## Warm Club room shell contract

`BushitsuView.vue` is the orchestration boundary for the entered room shell.
Shell changes are presentation-only: keep `useBushitsuStore`, WebSocket/API
calls, player callbacks, chat events, queue actions, and provider/danmaku
state wiring unchanged.

### Layout ownership

- `.bushitsu` is a fixed desktop viewport (`100dvh`) with document overflow
  hidden. `.stage` is the intentional vertical scroll owner for short desktop
  windows; do not add a second page scrollbar.
- DOM order is player stage, media context, portrait chat launcher, and the
  room workbench. The desktop `ChatPanel` remains a sibling conversation rail
  and must not overlay or displace the player.
- Portrait mode keeps the player first, then the full-width chat launcher, then
  the native room/queue `details` disclosures. Primary touch surfaces are at
  least 44px high and the document must not gain horizontal overflow.

### Tokens and surfaces

Use the room component recipes in `src/assets/theme.css` (`--room-*`) for
canvas, stage gutter, media frame, panel surfaces, elevation, and chat width.
Those recipes must derive from existing semantic tokens; do not add a second
palette or raw color literals in `BushitsuView.vue`.

### Cinema decision

Parent-owned cinema mode is a media-first arrangement, not a media-only
arrangement. It hides the metadata strip, workbench, timeline source panel,
portrait launcher, and collapsed-chat handle while retaining the desktop chat
rail and in-player danmaku overlay. This preserves the established
player-plus-conversation contract.

```css
/* Correct: supporting context is hidden, conversation remains available. */
.bushitsu.cinema-mode .room-workbench,
.bushitsu.cinema-mode .media-toolbar {
  display: none;
}

.bushitsu.cinema-mode > :deep(.chat-panel) {
  display: block;
}
```

Do not hide the desktop chat panel when refining cinema styling; doing so
silently changes an existing interaction contract and makes the player lose
its shared-room companion.

### Required checks

Room shell changes must retain focused browser assertions for `desktop-short`,
`desktop-tall`, `phone-375`, and `ipad-mini`, including player-first bounds,
chat visibility in cinema, 44px controls, and `scrollWidth <= innerWidth`.
Run the Kyoushitsu unit suite, typecheck, lint, build, and the applicable
Playwright projects before commit. Screenshots are review evidence rather than
pixel baselines.

---

## Common Mistakes

<!-- Component-related mistakes your team has made -->

(To be filled by the team)
