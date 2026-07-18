# Enhance Trellis workflow and plan frontend refactor

## Goal

Make Trellis Plus durable in the current Trellis workflow and prepare a
decision-ready plan for a possible frontend refactor; do not start the refactor
until its product scope and design direction are agreed.

## Confirmed Facts

- The repository is a Bun workspace. `packages/kyoushitsu` is a Vue 3/Vite
  frontend; its main user-facing routes are the minimal room entry page and the
  room/player/chat view.
- `./dx` and `dev.sh` already provide the project Docker development workflow;
  `./dx` uses `oven/bun:1`, while the frontend server is configured for port
  `5173` and the backend service uses `3000`.
- UI/UX Pro Max is initialized for Codex at
  `.codex/skills/ui-ux-pro-max/SKILL.md`, and its search script passes `--help`.
- The Trellis 0.6.5 migration left the existing Plus blocks out of the active
  workflow. The default enhancements must be reapplied around that migration,
  not by restoring an old workflow wholesale.
- The desired frontend direction is concise and harmonious. The user is
  considering Anime.js for purposeful UI motion.
- The first refactor slice is approved as the room entry page plus the room
  shell. It preserves player, danmaku, chat, and WebSocket business contracts.
- The visual direction is a warm after-school club room. The UI must be ready
  for later user-selectable themes, including night, bright, pink-white, and
  pink-blue variants.
- The first slice will implement the theme-token architecture and the warm
  club-room default only. It will not ship a user-facing theme selector or the
  future theme variants.
- The first-slice motion scope is approved: room entry, non-media panel
  open/close, and one-shot status confirmation only.
- Anime.js is approved as the scoped implementation tool for those structural
  transitions; simple control feedback remains CSS-only.
- The first slice must support desktop, 768px tablet, and 375px narrow mobile.
  On narrow screens the player remains primary, room controls and playlist
  stack vertically, and chat becomes an expandable panel.
- The entry page prioritizes joining an existing room by link or room ID;
  creating a new room is a secondary action.
- The warm club-room visual language is asset-light: no character illustrations
  or large background images in the first slice; atmosphere comes from tokens,
  typography, texture, spacing, and restrained effects.
- The chat-only light/dark toggle will be removed in the first slice so the UI
  has one coherent warm default. Its legacy local-storage value remains for a
  later full theme-selector migration.
- `animejs` is not present in the manifest or lockfile. Existing motion is
  limited to small CSS transitions, while player timekeeping correctly owns its
  own `requestAnimationFrame` loop and must not be coupled to decorative motion.
- Initial UUPM research is saved at
  `research/ui-ux-pro-max.md`. Its newsletter-oriented recommendation is not an
  approved design because it does not fit a shared viewing room.
- A second UUPM query confirmed Japanese typography and subtle motion as useful
  inputs, but again selected a marketing-page layout and is not an approved
  information architecture.
- The existing `ChatTheme` persists only `light` and `dark` in local storage.
  It currently reaches the room and chat through local classes and scattered
  literal colors, not a global semantic-token theme system.
- The room shell has a fixed 320px chat sidebar and a two-column workbench with
  a 280px minimum control panel, but no responsive breakpoints. Narrow-screen
  behavior must be explicitly designed rather than inferred from the desktop
  layout.

## Requirements

- Reapply the Trellis Plus submit-ready human-review gate, Codex commit-summary
  and attribution rule, Docker dev-command bootstrap, and UUPM frontend flow to
  the active project workflow.
- For frontend tasks, require project-local UUPM design research before UI
  implementation, approved decisions in `design.md`, UI-specific verification,
  and promotion of only stable rules to the frontend spec.
- Preserve the existing `./dx` and `dev.sh` workflow rather than introducing a
  competing Docker wrapper.
- Establish the desired frontend refactor scope and product/design direction
  before generating the task-specific UUPM design system or implementation plan.
- Refactor the entry page and room shell first. Limit Anime.js to short,
  cancellable room-entry, non-media-panel, and status-confirmation transitions;
  retain CSS for simple hover/focus feedback and leave video, playback timeline,
  danmaku motion, and list choreography untouched.
- Establish semantic design tokens and a theme boundary in the first slice so
  later themes do not require component-by-component color rewrites. The first
  slice implements only the warm default theme; theme switching and additional
  variants are explicitly out of scope.
- Replace the current chat-only light/dark presentation boundary with an
  application-level theme model and warm default. Remove the chat-only switch;
  retain its legacy local-storage value without applying it until full theme
  selection exists.
- Verify the redesigned entry page and room shell at desktop, 768px, and 375px
  widths, including the mobile player-first and expandable-chat behavior.
- Make joining an existing room the entry page's primary action and creation a
  visually subordinate action without changing existing entry behavior.
- Keep the warm club-room treatment asset-light so first-load performance and
  future theme variation do not depend on illustration or character assets.
- Add Anime.js only for the approved motion scope, with reduced-motion,
  cancellation, bundle-size, and Vue-lifecycle boundaries documented in the
  design.
- Prefer CSS for simple hover/focus/state feedback. If Anime.js is approved,
  isolate it to cancellable, reduced-motion-aware structural transitions and
  use the smallest tree-shakeable import compatible with the selected effect.

## Acceptance Criteria

- [ ] The active workflow contains all four Trellis Plus enhancement areas and
      their behavior occurs before the relevant implementation, verification,
      specification-update, or commit step.
- [ ] Codex UUPM initialization is complete and its search utility is usable.
- [ ] The frontend spec points to the project-local UUPM workflow without
      duplicating task-specific design decisions.
- [ ] The refactor planning artifacts state a concrete scope, design direction,
      implementation boundary, and validation/manual-review plan before the
      task is started.
- [ ] The first-slice plan includes an application-level semantic-token theme
      contract and the warm default theme, with no user-facing selector.
- [ ] The plan defines responsive acceptance criteria for desktop, tablet, and
      narrow mobile without changing player, danmaku, chat, or WebSocket
      business contracts.
- [ ] The entry page's visual hierarchy clearly prioritizes joining an existing
      room while preserving room creation as a secondary path.
- [ ] The warm visual treatment introduces no character illustration or large
      background-image dependency.
- [ ] The chat-only light/dark control is removed without changing room,
      player, danmaku, chat, or WebSocket business contracts.

## Constraints

- Existing uncommitted Trellis migration files are user work and must not be
  overwritten; apply narrow additive patches only.
- UUPM files are ignored by the user's global `.codex` exclusion. Any future
  work commit that should share them must intentionally stage the generated
  files rather than relying on `git status` discovery.
