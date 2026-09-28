# Warm Club 2.0 interaction surface polish

## Goal

Finish the 08-29 visual refresh with a cohesive, accessible presentation for
room dialogs, gates, the mobile chat sheet and composer, and cinema-mode states.
Preserve all existing room, provider, chat, and playback behavior.

## Background

- The parent task, 08-29-visual-experience-refresh, establishes the Warm Club
  2.0 visual direction and requires independently reviewable child slices.
- Its foundation/entry, room-shell, and queue-control children are archived.
  Their planning explicitly left dialog content and chat-composer polish for a
  final surface-convergence slice.
- The existing Kyoushitsu UI already implements the target interactions. Their
  relevant owners are BushitsuView, EnmokuPlayer, ChatPanel, KengenPanel,
  BaiduConnectionDialog, and BaiduFileDialog.
- The active theme already provides Warm Club semantic and room tokens in
  packages/kyoushitsu/src/assets/theme.css. The room-shell contract keeps the
  desktop chat rail visible in cinema mode.

## Requirements

1. Keep the approved Warm Club 2.0 identity: quiet paper surfaces, warm ink,
   restrained wood/amber accents, and the existing semantic token system.
2. Refine the visual hierarchy and state treatment of these existing surfaces:
   - BushitsuView nickname and admission gates, queue-clear and provider-info
     dialogs, mobile chat sheet, and room-level cinema state.
   - EnmokuPlayer join gate and cinema control state.
   - ChatPanel composer, settings, and send actions; the message history itself
     is not a redesign target.
   - KengenPanel member-removal dialog.
   - BaiduConnectionDialog and BaiduFileDialog surfaces, without changing their
     security copy or multi-step provider workflows.
3. Preserve all component ownership and existing control flow. Do not change
   API, WebSocket, authentication, admission, permissions, queue, provider,
   chat-send, danmaku-send, or playback contracts.
4. Use existing semantic/component tokens. Add only small derived surface
   tokens when repeated use across these targets justifies them. Preserve the
   user's configurable chat text color and font size.
5. Keep controls operable with keyboard and touch, maintain visible focus,
   readable contrast, non-color status cues, clear disabled/loading/error
   states, and at least 44px primary touch targets.
6. Keep the mobile sheet and composer usable at 375px and 768px, and dialogs
   bounded at supported desktop sizes. Do not add horizontal overflow or a new
   desktop document scroll owner.
7. Keep motion restrained and purposeful, reuse existing motion patterns, and
   respect prefers-reduced-motion. Do not add hosted fonts, large assets, or a
   second theme palette.
8. Validate changed behavior and layout with focused browser coverage, package
   checks, diagnostic screenshots, and a human visual review.

## Acceptance Criteria

- [ ] All in-scope surfaces share the approved Warm Club typography, semantic
      color, spacing, radius, elevation, and interaction-state language.
- [ ] Dialogs preserve their current wording, labels, open/close paths,
      keyboard dismissal, focus behavior, pending/error states, and actions.
- [ ] Nickname, admission, and player-join gates present their existing states
      clearly without changing state transitions or permissions.
- [ ] The mobile chat sheet opens, expands, shrinks, closes, and remains usable
      with the existing chat controls; composer drafts, resizing, settings,
      normal chat sends, and danmaku sends keep their current behavior.
- [ ] Cinema styling remains media-first while the desktop ChatPanel stays
      visible; entering and leaving cinema retains existing behavior.
- [ ] At 375x812, 768x1024, 1280x640, and 1280x1200, critical controls remain
      visible and operable without horizontal overflow or accidental clipping.
- [ ] Keyboard focus, accessible names, contrast, touch targets, state cues,
      and reduced-motion behavior remain covered by focused tests or review.
- [ ] Kyoushitsu unit tests, typecheck, lint, build, and applicable Playwright
      projects pass; diagnostic screenshots receive human visual review.
- [ ] The diff contains presentation changes and their direct tests only; no
      API, WebSocket, store, permission, media, or provider behavior changes.

## Out of Scope

- Reworking the room-shell or queue hierarchy already delivered by sibling
  children.
- Redesigning the chat message history, adding chat features, or changing
  composer controls, messages, permissions, or transport behavior.
- Changing provider credential handling, provider copy, provider step order,
  file-selection behavior, or mobile provider availability.
- Changing gate decisions, room admission flow, authorization, playback,
  fullscreen behavior, danmaku, or room protocol.
- Introducing a new theme family, a dark theme, hosted fonts, decorative art,
  new product copy, or large visual assets.

