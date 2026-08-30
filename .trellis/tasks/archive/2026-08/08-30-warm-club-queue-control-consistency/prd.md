# Warm Club queue and dense-control consistency

## Goal

Carry the approved Warm Club 2.0 visual and interaction language into the
room's queue surface and URL-based source composer. A member should be able
to scan queued works, understand the available action and status for each
row, and add a source without the dense controls reading like a separate
legacy panel.

## Background and confirmed facts

- This is a child of `.trellis/tasks/08-29-visual-experience-refresh`.
- The Warm Club 2.0 room-shell child is complete and archived. Its contract
  makes room styling presentation-only and preserves player, chat, queue,
  governance, provider, subtitle, danmaku, API, WebSocket, and store behavior.
- `packages/kyoushitsu/src/views/BushitsuView.vue` owns queue orchestration and
  renders the queue disclosure, queue rows, owner-only move/clear actions,
  playback/cancel/delete actions, feedback states, and the existing clear-
  pending confirmation dialog.
- `packages/kyoushitsu/src/components/bangumi/EnmokuComposer.vue` owns the
  source launchers, URL/title form, resolving/submitting states, preview, and
  queue actions. Its current control styles are component-local.
- Queue permissions and action eligibility are already expressed by
  `src/lib/bangumi-actions.ts`, the Bushitsu store, and existing API/WS
  contracts. This child must consume those decisions rather than reimplement
  them.
- The shared Warm Club tokens and room recipes live in
  `packages/kyoushitsu/src/assets/theme.css`; the room-shell spec requires
  semantic/component token reuse, 44px primary touch surfaces, visible focus,
  non-color status cues, and no horizontal overflow at the covered widths.
- Existing focused browser coverage exercises desktop queue reachability and
  portrait queue/composer disclosure, while unit coverage exercises queue
  action eligibility and store snapshots.

## In scope

1. Queue list presentation: heading/count, row information hierarchy, source
   and current-item status, action grouping, disabled/pending treatment, and
   success/error feedback.
2. `EnmokuComposer` presentation: launchers, fields, preview, action groups,
   validation/loading/disabled states, and responsive wrapping/stacking.
3. Shared semantic/component recipes needed by these surfaces, keeping the
   existing Warm Club palette and room-shell relationship.
4. Focused browser assertions and visual evidence for representative desktop,
   tablet, and 375px portrait states.

## Requirements

- Preserve queue ordering, owner-only permissions, playback/cancel/delete
  behavior, source resolution, Baidu integration, API/WS payloads, and store
  ownership boundaries.
- Keep the player-first room hierarchy established by the completed shell
  child; queue controls remain a secondary workbench surface.
- Keep every primary queue/composer action keyboard-operable, visibly focused,
  and at least 44px high. Disabled, pending, current, success, and error
  states must remain understandable without color alone.
- Keep queue rows and composer controls usable at 375px phone, 768px tablet,
  and representative desktop widths without accidental horizontal overflow or
  hidden critical actions.
- Reuse existing component and semantic tokens. Do not introduce a second
  palette, a theme selector, new provider behavior, or raw visual rules that
  bypass the shared recipes.
- Preserve `prefers-reduced-motion` behavior and keep browser assertions tied
  to semantic roles, labels, and observable state rather than fragile pixels.

## Key decisions

- On 2026-08-30, the user confirmed the narrow child boundary: queue rows,
  queue feedback/actions, and the URL source composer are in scope;
  `KengenPanel` permission/admission controls remain outside this child.
- The generated design-tool palette, typography, and page-pattern suggestions
  are research only. The existing Warm Club 2.0 tokens, room-shell contract,
  and product behavior remain authoritative.

## Acceptance Criteria

- [ ] Queue rows, source/composer controls, action hierarchy, and status
      treatment visibly belong to the Warm Club 2.0 room shell.
- [ ] Existing queue, source-resolution, permission, provider, and room
      behavior remains unchanged; no new product capability is introduced.
- [ ] Desktop, tablet, and 375px portrait states keep all critical queue and
      composer actions operable with no horizontal overflow and 44px primary
      targets.
- [ ] Keyboard focus, accessible names, disabled/loading/error/success/current
      states, and reduced-motion behavior remain testable.
- [ ] Focused Playwright coverage and applicable Kyoushitsu unit checks pass;
      normal lint, typecheck, build, and required browser checks are recorded
      before implementation is considered complete.
- [ ] Updated screenshots are reviewed as visual evidence before commit.

## Out of scope

- Queue ordering rules, authorization, playback synchronization, room
  protocol, provider resolution, credential handling, or media transport.
- Changes to `KengenPanel` permission/admission behavior, `ChatPanel` composer
  behavior, player controls, subtitle/danmaku behavior, or Baidu dialogs.
- Dialog, gate, chat-sheet, and cinema-state content polish reserved for the
  later parent slice.
- New theme families, theme selection, content discovery, mobile provider
  companion work, and decorative marketing assets.
