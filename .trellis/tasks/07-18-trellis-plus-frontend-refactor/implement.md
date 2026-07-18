# Implementation Plan: Warm Club-Room Frontend Refactor

## Ordered Work

1. Establish the theme foundation.
   - Add the `animejs` dependency without introducing unrelated packages.
   - Add global warm-theme semantic tokens and root theme application.
   - Replace scattered presentation colors in the entry page, room shell,
     chat, and room-control surfaces with semantic tokens.
   - Replace the chat-only theme helper and toggle with the selector-free,
     warm-default theme model; keep the legacy preference key available for a
     later migration.

2. Rework the entry view.
   - Preserve nickname persistence, room-ID normalization, create/join requests,
     route navigation, and error behavior.
   - Make join-by-link/ID the primary path and creation the secondary path.
   - Add accessible labels, focus treatment, disabled and error states, and
     responsive warm-theme styling without new image assets.

3. Rework the room shell.
   - Preserve all existing player, danmaku, chat, room-panel, and WS handlers.
   - Apply the warm token system to shell, panels, metadata, playlist, dialogs,
     and chat.
   - Introduce explicit desktop, tablet, and narrow-mobile layout rules.
   - Keep mobile player-first; stack control and playlist panels; make chat an
     expandable panel rather than a fixed 320px rail.

4. Add constrained motion.
   - Add `useRoomMotion` with cleanup and reduced-motion detection.
   - Use Anime.js only for room entry, non-media panel transitions, and
     one-shot status confirmation.
   - Preserve CSS interaction feedback and ensure animations are cancellable,
     non-blocking, and never target media/danmaku/timeline/list choreography.

5. Add focused tests and verification.
   - Update or replace chat-theme helper tests for the warm-default theme
     contract and legacy-preference compatibility.
   - Add pure tests for reduced-motion/motion decision helpers where extracted.
   - Run the full repository validation plus the frontend build.
   - Perform browser checks at desktop, 768px, and 375px with reduced motion
     enabled and disabled.

## Expected Files

- `bun.lock` and `packages/kyoushitsu/package.json` for the Anime.js dependency
  boundary.
- `packages/kyoushitsu/src/assets/` for global theme tokens.
- `packages/kyoushitsu/src/lib/` and optionally `src/composables/` for typed
  theme and motion helpers.
- `packages/kyoushitsu/src/main.ts`, `App.vue`, `views/HomeView.vue`,
  `views/BushitsuView.vue`, and `components/chat/ChatPanel.vue` for root theme,
  presentation, and responsive structure.
- `packages/kyoushitsu/test/` for focused helper coverage.

## Validation Commands

Run through the existing Docker wrapper:

```bash
./dx bun run format
./dx bun run lint
./dx bun run typecheck
./dx bun test
./dx bun run --filter houkago-kyoushitsu build
```

## Human Review Gate

Human review is required before commit because the task changes visible layout,
motion, responsive behavior, typography, and theme perception. Request explicit
pass/fail for the entry flow and room shell at desktop, 768px, and 375px; test
chat expansion, player/control reachability, focus order, reduced motion, and
connection/admission feedback. Ask for screenshots and browser-console output
when a scenario fails.

## Rollback Points

- Keep room protocol, player, danmaku, and WS changes out of the task so visual
  changes can be reverted independently.
- If Anime.js integration causes a regression, remove the motion composable and
  dependency while retaining the theme and responsive layout work.
- If the theme token migration causes a presentation regression, restore the
  prior component styles without changing user-visible room behavior.
