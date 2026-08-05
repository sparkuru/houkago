# Room governance foundation

## Goal

Make authenticated rooms durable and governable: a room owner can understand
and manage the accounts that belong to their room, while playback remains a
URL-first, server-authoritative shared experience.

## Background

- The completed account/authority slice (`262ff2c`) makes REST and WebSocket
  actors server-derived, but room admission, guest permissions, pending
  approvals, and the roster are connection-scoped `Map` state. They are lost
  when a room empties or the server restarts.
- SQLite persists accounts and `bushitsu.buchou_id`, but has no authenticated
  room-member relation. The legacy `buin` table is not such a relation.
- `password` admission is presently configuration/UI only: the server treats it
  as closed and performs no password verification. Implementing it is outside
  this task.

## Requirements

1. Persist a server-authoritative membership relation for every room owner and
   admitted member. Creating a room creates its owner membership atomically;
   open admission and owner approval create membership before granting entry.
2. A durable member may reconnect after disconnect, room-empty cleanup, or a
   server restart without a second admission decision. Current admission modes
   govern only first entry; an account removed from membership follows the
   current mode again.
3. Keep exactly two roles: owner and member. Ownership stays on
   `bushitsu.buchou_id`; all members use the existing room-wide guest switches
   for playback, chat, and queue actions. No moderator, per-member permission,
   ownership transfer, invitation, or ban model is added.
4. Let only the owner receive the durable member roster and remove a non-owner
   member. Other admitted viewers continue to receive only the existing live
   presence snapshot.
5. Removal is a confirmed destructive action. It deletes membership, immediately
   revokes every active socket for that account in the room, displays an explicit
   access-revoked state, and returns that browser to the entry route. Removal is
   not a ban: an open room may admit the account again later.
6. Preserve the current lifecycle for room-level guest switches, admission
   settings, pending approval requests, and password-mode behavior: they remain
   in-memory and reset as they do today. Do not imply their persistence merely
   by persisting membership.
7. Maintain the account/session security boundary: no mutation body, query
   parameter, or WebSocket envelope can assign membership, role, or authority;
   owner-only member data must never be broadcast to other room subscribers.
8. Update the main product roadmap to mark identity/room authorization complete
   and name room governance as the active mainline work.

## Out of scope

- Queue reordering/clearing, subtitle/audio UI, playback-policy redesign,
  WebRTC, provider expansion, content discovery, password-admission
  implementation, invitations, bans, administrators, email/password recovery,
  third-party credentials, source-session sharing, and account deletion.

## Acceptance Criteria

- [ ] A new room has a durable owner-member record; an open-mode or approved
      account gains one before it is admitted, and duplicate/reconnect entries
      do not create duplicate records.
- [ ] An existing member enters immediately after reconnect and after the
      server's in-memory room state has been recreated. A non-member still
      follows open, approval, closed, and current password-mode behavior.
- [ ] Only the owner receives a durable roster snapshot. It includes the owner
      and its members; normal room presence remains available to admitted
      viewers without disclosing offline durable members.
- [ ] Only the authenticated owner can remove a non-owner member. Non-owner,
      unauthenticated, cross-room, nonexistent, and owner-self removal attempts
      fail without altering membership or sockets.
- [ ] Confirmed removal deletes the membership and closes every active target
      socket with an explicit revoked state; its room UI returns to entry and
      does not auto-reconnect. In an open room, that account can subsequently
      join as a new member.
- [ ] Guest permissions, admission settings, and pending approvals retain their
      current transient lifecycle; no raw password or extra room authority is
      persisted or exposed.
- [ ] Backend, contract, frontend unit, and desktop/phone Playwright tests cover
      the membership, authorization, revocation, reconnect, and responsive
      owner UI paths. Full repository format, lint, typecheck, test, build, and
      applicable Playwright checks pass.
