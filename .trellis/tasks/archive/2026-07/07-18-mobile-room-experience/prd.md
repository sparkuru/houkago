# Optimize mobile room experience

## Goal

Make the warm club-room practical to use on portrait tablets and phones without
changing player, room, chat, danmaku, API, Pinia, or WebSocket business
contracts.

## Confirmed Facts

- The previous refactor established a `max-width: 800px` portrait layout: the
  player retains a definite 16:9 area, controls and playlist stack, and the
  room shell scrolls intentionally.
- Chat still renders as the same full-width `ChatPanel` after the stacked room
  content. Its existing collapse state is controlled by `chatHiraku` in
  `BushitsuView`; the closed affordance is a narrow hover-oriented edge handle.
- `ChatPanel` emits a typed `toggle` event and does not own the WebSocket, so
  presentation changes can preserve chat transport and store ownership.
- The prior task's manual review passed desktop, phone/tablet portrait, and
  tablet landscape. This task is an interaction-density improvement, not a
  fix for the now-resolved blank-player defect.

## Requirements

- Preserve player-first reading and playback on portrait screens.
- Make chat opening, closing, and return-to-player discoverable and usable by
  touch and keyboard.
- On portrait screens, default chat to a fixed, labelled trigger below the
  player and open it as a bottom sheet that can be dismissed back to playback.
- Open the chat sheet at roughly 60% viewport height; provide an explicit
  control to expand it to roughly 90% and keep the composer visible when the
  virtual keyboard opens.
- Reduce vertical scanning and control density in the stacked room content.
- On portrait screens, show room information and playlist as compact summaries;
  reveal management controls and the full queue only through explicit details
  controls.
- Keep desktop and landscape room layouts stable unless a small shared fix is
  necessary.
- Preserve the warm semantic-token architecture, i18n-backed labels, reduced
  motion behavior, and existing room/player/chat ownership boundaries.

## Acceptance Criteria

- [ ] At 375px and 768px portrait widths, a viewer can watch the player,
      discover the chat control, open chat, close it, and return to the player
      without a hidden hover-only affordance.
- [ ] Portrait chat defaults closed and opens as a bottom sheet without changing
      chat WebSocket, store, or permission behavior.
- [ ] The chat sheet initially shows about 60% of the viewport, has a labelled
      route to a roughly 90% focused-chat state, and remains dismissible by a
      visible control, Escape, and its backdrop.
- [ ] Chat, room controls, and playlist remain keyboard reachable with visible
      focus states and no changes to WebSocket or Pinia data flow.
- [ ] Portrait layouts avoid unnecessary always-visible chat height and make
      the room's next action easy to scan.
- [ ] Portrait room and playlist summaries expose room status and current queue
      context before their management/detail controls.
- [ ] Desktop and landscape screenshots retain the reviewed player/chat split.
- [ ] The final design is manually reviewed at phone and tablet portrait widths
      in addition to automated frontend checks.

## Likely Out of Scope

- New chat features, message protocol changes, room permission changes, theme
  selection, playlist data-model changes, or changes to media/danmaku timing.

## Decisions

- Mobile chat is a bottom sheet, closed by default, with a fixed labelled
  launcher below the player.
- The initial sheet height is approximately 60% viewport height; a visible
  action expands it to approximately 90%.
- Portrait room control and playlist sections are summary-first, with explicit
  disclosure for management and full-queue detail.
