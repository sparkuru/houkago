# Warm Club 2.0 room shell hierarchy

## Goal

Carry the approved Warm Club 2.0 language from the entry floor into the shared
watch-room shell, so the player, conversation, and room workbench read as one
quiet club room without changing any watch-party behavior.

## User value

After entering a room, a user should immediately understand what is being
watched, where conversation lives, and where room controls are located. The
player remains the visual anchor; supporting surfaces should feel calm,
intentional, and easy to scan at desktop and phone widths.

## Confirmed repository facts

- The entry/foundation child is complete and archived in commit `1b4ccd8`.
- `packages/kyoushitsu/src/views/BushitsuView.vue` owns the room shell. Its
  entered state renders a player stage, optional media metadata, a room
  workbench containing room controls and the queue, and a desktop `ChatPanel`
  or portrait mobile chat dialog.
- Cinema mode intentionally hides metadata, workbench, mobile launcher, and
  collapsed-chat handle while retaining the established desktop chat rail and
  in-player danmaku overlay.
- Existing room behavior includes admission and nickname gates, player
  ownership and synchronization, chat/danmaku, queue actions, governance,
  provider dialogs, mobile disclosures, and reduced-motion-safe room motion.
- Existing Playwright coverage verifies desktop short/tall layouts, portrait
  chat and queue interactions, governance, subtitles, danmaku, provider
  dialogs, and horizontal-overflow boundaries.
- The parent task explicitly proposes room shell/media/workbench hierarchy as
  the follow-up after the foundation child; queue consistency and dialog/chat
  polish are later slices.

## Recommended scope for this child

### In scope

1. Apply the Warm Club 2.0 hierarchy to the room canvas and stage: paper-like
   room background, media frame, supporting metadata, and consistent panel
   spacing/elevation using the established semantic/component tokens.
2. Make the desktop chat rail, room-control panel, and queue workbench read as
   related secondary surfaces while keeping the player visually primary.
3. Preserve and clarify the mobile portrait order: player first, a reachable
   chat launcher/sheet, and deliberate disclosure surfaces for room controls
   and the queue.
4. Keep cinema-mode entry/exit visually coherent and preserve its media-first
   behavior, including the established desktop chat rail.
5. Add focused browser assertions and visual review evidence for representative
   desktop, short desktop, tablet, and portrait phone states.

### Out of scope

- Queue business logic, ordering rules, permissions, provider behavior, or
  media protocol changes.
- Rewriting the player, chat, governance, queue, subtitle, danmaku, or provider
  components' behavior.
- New room capabilities, discovery, theme selection, mobile companion work, or
  large decorative assets.
- A second pass over every dense inner control; that remains a later child
  slice after the shell hierarchy is accepted.

## Acceptance criteria

- [ ] The entered room has a clear player-first hierarchy on desktop, short
      desktop, tablet, and portrait phone widths.
- [ ] Chat, room controls, queue, metadata, and cinema transitions share the
      Warm Club 2.0 spacing, typography, border, elevation, focus, and state
      language without competing with the player.
- [ ] Existing player/chat/workbench ownership, admission, governance,
      synchronization, queue, provider, subtitle, danmaku, and cinema behavior
      remains unchanged.
- [ ] Mobile primary actions remain reachable with at least 44px targets;
      keyboard focus and non-color status cues remain visible.
- [ ] No changed layout introduces horizontal overflow or hides critical
      controls at the covered widths; reduced-motion behavior remains safe.
- [ ] Focused Playwright coverage plus the repository's normal lint, typecheck,
      unit-test, build, and applicable browser checks pass.
- [ ] The final visual result is reviewed against updated screenshots before
      the work is committed.

## Confirmed scope decision

The user confirmed that this child is limited to the **room shell / media /
workbench hierarchy** above. Dense queue-control recipes and dialog/chat
content polish remain later children.
