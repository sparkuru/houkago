# React Room Controls as a Floating Speed Dial

## Goal

In the React playback room, present room controls through a floating speed dial
based on the supplied Firefly reference, and let the anime playlist extend
leftward into the room-control layout space freed by that change.

## Background

- The owner selected the React frontend on 2026-09-28. React is the default
  local room application.
- The React room is implemented in
  `packages/kyoushitsu-react/src/features/room/room-contents.tsx`. The anime
  playlist is rendered by `QueuePanel` in the main column; room governance is
  currently an in-flow `GovernancePanel` in the right column.
- The literal lower-left `.room-control-panel` exists only in the legacy Vue
  room. It provides a reference for the requested placement and existing room
  information, but this task changes React only.
- The supplied reference describes a mobile floating action button and speed
  dial. It specifies data-driven actions, an unboxed floating menu, safe-area
  placement, keyboard and focus behavior, reduced-motion support, and touch
  targets. It is a behavior and visual reference, not drop-in source code; a
  preserved copy is at `research/firefly-speed-dial-component-reference.md`.
- At the owner's request, this deliverable is now a child of M6
  (`09-28-m6-parity-cutover`). M6 owns whole-application parity and legacy
  workspace retirement; this child owns the independently verifiable React
  room-control and playlist-layout change.
- The owner's room-dock refinement is captured in
  `research/screenshots/room-dock-layout-reference.png`: move attendance and
  danmaku controls into the fixed right dock above chat, and use one composer
  with two independent send actions.

## Requirements

- R1. Present React room controls through a floating speed dial following the
  visual and interaction principles in the supplied reference.
- R2. Remove the room-control surface from the normal layout flow and place the
  anime playlist directly beneath the player in the desktop main column. This
  fills the lower-left space without waiting for the taller room sidebar; the
  room sidebar spans both rows. At the phone breakpoint, keep the order main
  content, room sidebar, then playlist.
- R3. Preserve existing room information, control actions, permissions, and
  command behavior. More detailed settings and information remain reachable
  through the floating control's actions.
- R4. Keep the floating control usable with keyboard and touch input, with
  accessible names and state, safe-area spacing, and reduced-motion behavior.
- R5. Keep changes within the React room UI. Backend, WebSocket, persistence,
  and legacy Vue behavior are out of scope.
- R6. At wide desktop and cinema widths, pin a room dock to the viewport's right
  edge while the page scrolls. Stack the attendance roster, danmaku
  source/settings panel, and chat in that order; keep chat history scrolling
  inside its panel. At phone widths, keep the dock in the normal room flow
  inside the sidebar so the player and queue remain usable.
- R7. Provide one dock composer with one shared draft and two independent
  actions: `弹幕` immediately to the left of `发送`. The former sends through
  `room.danmaku`, displays as a flying live danmaku over the player, and is
  marked `[弹幕]` in the chat feed. The latter sends through `room.chat`,
  displays in the chat feed, and appears as a transient lower-right player
  notification. Both actions retain the existing permission and command
  behavior and only render after the server echo.

## Acceptance Criteria

- [x] A1. The React playback room exposes its room controls through a floating
      speed dial; the room-control surface no longer reserves in-flow layout
      space.
- [x] A2. The anime playlist sits immediately below the player at the
      desktop main-column width, with no large empty gap below the main content;
      the room sidebar spans alongside both rows. At phone widths, the playlist
      follows the sidebar. On wide desktop, the workspace stays bounded, leaves
      clear space before the fixed room dock, and keeps its header, main content,
      and launcher visually aligned. The empty desktop player surface matches
      the active video's shape, with its waiting message vertically centered.
      Supported room sizes have no clipping or horizontal overflow.
- [x] A3. All room information and control actions available before the change
      remain accessible with their existing behavior and permission checks.
- [x] A4. Opening and closing, Escape, outside/backdrop click, focus handling,
      hidden-action behavior, touch targets, safe areas, and reduced-motion
      behavior meet the applicable parts of the supplied reference.
- [x] A5. Desktop, portrait, and cinema layouts remain usable; the closed
      floating control and desktop/cinema room dock do not obscure the player,
      queue, or chat controls. The dock stays pinned to the viewport's right
      edge on wide screens and returns to normal flow on phones. The open speed
      dial may overlay content while its backdrop blocks pointer access.
- [x] A6. The room dock shows attendance, danmaku controls, then chat. Its single
      composer has one shared draft and two independent actions, with `弹幕`
      immediately left of `发送`; the two server-echoed message types have the
      distinct player presentations and chat marker described in R7.

## Out of Scope

- Backend, protocol, database, room-session, and persistence changes.
- Changes to the legacy Vue room.
- Framework-neutral package extraction, whole-application parity, and legacy
  frontend retirement; those remain parent M6 responsibilities.
- Replacing the supplied interaction design with a generic panel or card.

## Parent and sequencing

- This child does not depend on the core-package extraction and can be
  implemented independently within the React room UI.
- M6 must wait for this child's A1–A5 acceptance before freezing its final room
  layout parity baseline or removing the legacy workspace. Parent M6 may
  perform shared-core extraction in parallel.
- Completing this child does not authorize M6 cutover or production deployment.

## Owner acceptance — 2026-10-04

The owner replied `视校通过；可以提交/继续；包括所有脏文件`. This accepts
the presented visual/interaction residuals, including automatic launcher
avoidance, member information in the control dialog and native confirmations.
The speed-dial criteria are accepted on the mapped automated evidence and visual
review. It authorizes remaining local cutover, all trackable dirty-file commits
and normal completed-task closure. Production deployment is outside this scope.
