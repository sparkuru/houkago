# Research: UI/UX baseline and motion direction

- Query: `anime social co-watching room warm minimal harmonious content-first`
- Scope: Local UUPM design-system search, repository source inspection, and
  Anime.js official documentation.
- Date: 2026-07-18
- Status: Exploration only; no design decision in this file is approved.

## Repository Evidence

- `packages/kyoushitsu` is a Vue 3/Vite frontend with a room entry route and a
  combined player, room controls, playlist, and chat route.
- The dependency manifest and Bun lockfile contain no `animejs` dependency.
- Existing motion is intentionally modest: CSS transitions in room and
  permission controls, plus a `requestAnimationFrame` loop in
  `EnmokuPlayer.vue` for player timekeeping. Decorative animation must not
  compete with player or danmaku timing.

## UUPM Design-System Output

Command run:

```bash
python3 .codex/skills/ui-ux-pro-max/scripts/search.py \
  "anime social co-watching room warm minimal harmonious content-first" \
  --design-system --stack vue --variance 3 --motion 3 --density 5 \
  --project-name Houkago --format markdown
```

Returned direction:

- Dials: centred/minimal variance `3`, subtle motion `3`, standard density `5`.
- Style: light and dark capable exaggerated minimalism, high contrast, generous
  whitespace, and Atkinson Hyperlegible typography.
- Motion: a 200–300 ms route transition, with a warning not to block
  navigation.
- Baseline checks: visible focus states, 4.5:1 text contrast, reduced motion,
  and responsive checks at 375/768/1024/1440 widths.

The result selected a newsletter/content-first information architecture and a
rose/blue palette. That product pattern is not appropriate for Houkago's shared
viewing room, so it is useful only as a minimal-motion and accessibility
baseline. A second UUPM query must be generated after the user chooses the
first refactor slice and visual direction.

## Warm Club-Room Theme Query

Command run:

```bash
python3 .codex/skills/ui-ux-pro-max/scripts/search.py \
  "warm Japanese after-school club room shared watching social web app understated cozy" \
  --design-system --stack vue --variance 3 --motion 3 --density 5 \
  --project-name Houkago --format markdown
```

Useful outputs:

- `Noto Serif JP` for display headings paired with `Noto Sans JP` for body copy.
- The same low-variance, low-motion, standard-density baseline and 200–300 ms
  non-blocking transitions.
- Light and dark mode both need complete contrast and focus-state verification.

Rejected outputs:

- A hero/testimonials/CTA marketing-page architecture does not match a shared
  viewing room.
- Exaggerated oversized typography and a rose/blue promotional palette conflict
  with the requested understated warm room.

## Theme Architecture Evidence

- `src/lib/chat-theme.ts` stores a `light`/`dark` preference in local storage
  and defaults to the system color-scheme.
- `BushitsuView.vue` and `ChatPanel.vue` apply `theme-dark` classes and many
  component-local literal colors. The current setting is not a site-wide theme
  contract and cannot safely grow to bright, pink-white, or pink-blue variants
  without semantic tokens.

## Anime.js Research

Anime.js official documentation supports installation as `animejs` and
tree-shakeable ESM imports. The standard JavaScript `animate()` method is
documented at roughly 10 KB, while the Web Animations API-backed
`waapi.animate()` alternative is documented at roughly 3 KB with fewer
features. The candidate integration should therefore prefer CSS for small
feedback, then use the WAAPI path only for approved structural transitions
that it can express. Any integration must respect `prefers-reduced-motion`,
avoid animating layout properties, and cancel on component unmount or route
change.

## Provisional Recommendation

Keep motion subordinate to shared viewing: short opacity/transform transitions
for entering the room shell, opening/collapsing non-media panels, and confirming
user actions. Do not animate the video surface, playback timeline, danmaku
tracks, or continuous background decorations.
