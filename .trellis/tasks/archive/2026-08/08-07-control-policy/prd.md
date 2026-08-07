# Room control policy

## Goal

Make room-control policy explicit and usable so a room owner can deliberately
decide which admitted members may participate in room actions, without weakening
server-derived authority or expanding the URL-first boundary.

## Confirmed facts

- `Kengen` already provides a room-wide, in-memory guest policy with independent
  `playback`, `chat`, and `playlist` booleans. The owner is always allowed.
- The owner can change that policy through host-only `SETTEI`; the server
  broadcasts `KENGEN` and enforces the same gates for chat/danmaku,
  playback/synchronization, source selection, and ordinary queue writes.
- Queue reorder and clear remain exact owner-only operations even when
  `playlist` is enabled. The durable queue-placement boundary is already ready
  for a later multi-member policy, but no per-member roles or delegation exist.
- The current controls expose three individual switches in the room panel. They
  reset to guest-chat-only when a room becomes empty and are not durable today.

## Requirements

1. Build on the existing authenticated owner, admission, KENGEN, and queue
   boundaries; the server remains final authority for every action.
2. Keep the owner safe by default and retain the existing URL-first source
   restrictions.
3. Define a bounded control-policy experience that is understandable to the
   owner and observable by admitted members.
4. Keep queue reorder and clear-pending as exact owner-only operations;
   room-wide policy must not grant them to members in this slice.
5. Do not add moderator roles, per-member grants, ownership transfer, voting,
   invitation, bans, or third-party account/source-session capabilities unless
   explicitly approved as a later task.

## Decisions

- Members do not receive queue reorder or clear-pending authority in this slice.
- The room-wide policy persists across empty-room reconnects and service restarts.
- The owner sees common room-wide presets and may expand three independent
  permission switches for an exact policy.
- Presets are: **Only chat** (`chat`); **Shared playback** (`chat`,
  `playback`); and **Shared source selection** (all three). Queue management is
  excluded from every preset.

## Acceptance criteria

- [ ] A newly created or legacy room uses the safe only-chat default until its
      owner saves another policy.
- [ ] The owner can select any of the three presets or expand and change the
      three individual switches; the resulting `KENGEN` snapshot is authoritative
      on every connected client.
- [ ] A member can read the active policy and sees only actions granted by it;
      the server rejects an ungranted chat, playback, or source action.
- [ ] A policy survives an empty room, reconnect, and service restart. Missing
      or malformed legacy policy storage safely falls back to only-chat.
- [ ] Queue reorder and clear-pending remain unavailable to members regardless
      of the selected policy and remain server-enforced owner operations.
- [ ] The policy UI remains keyboard-operable, communicates selected/custom and
      pending/error states without colour alone, and fits supported desktop and
      portrait phone layouts without horizontal overflow.

## Out of scope

- Per-member permissions, moderators, ownership transfer, invitations, bans,
  voting, policy scheduling, and audit history.
- New queue-management delegation or concurrent queue-conflict resolution.
- New media-source/provider capabilities or changes to URL validation.
