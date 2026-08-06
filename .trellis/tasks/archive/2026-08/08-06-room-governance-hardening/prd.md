# Room governance hardening

## Goal

Harden the completed durable room-membership feature so its promised security,
multi-connection, re-entry, and browser-visible behavior remains dependable as
the room system evolves.

## Confirmed facts

- The completed foundation task persists `bushitsu_buin`, keeps only owner and
  member roles, sends `MEIBO` only to owner sockets, and revokes a removed
  member with `NYUUSHITSU { status: "revoked" }` before WebSocket close code
  `1008`.
- The current backend E2E covers the owner-only roster, one non-owner rejection,
  live-presence/roster refresh, and one revoked socket. It does not exercise
  unauthenticated, owner-self, cross-room, missing-member, multi-tab,
  server-state-recreation, or open-mode re-entry cases.
- Existing Playwright suites cover registration, room creation, responsive room
  layout, chat, and queue interactions, but do not cover the owner roster,
  removal dialog, or revoked member route/notice.
- Removal is intentionally not a ban: an account removed from an open room may
  enter again as a new durable member. Admission settings, guest switches,
  pending requests, and presence remain transient.

## Requirements

1. Preserve the existing durable membership semantics while adding coverage for
   authorization-negative, multi-socket, reconnect/state-recreation, and
   re-entry boundaries.
2. Verify browser-visible owner removal behavior on supported desktop and phone
   projects: private roster visibility, confirmation/cancel, pending/error
   feedback, revoked route return, and no unintended automatic reconnect.
3. Make only the smallest production fixes required by newly demonstrated
   defects; do not introduce a new role, invitation, ownership-transfer, or
   moderation system without an explicit follow-up product decision.

## Key decision

- This task is limited to hardening the existing owner/member contract. It does
  not expand into a moderation or admission product workflow.

## Acceptance Criteria

- [x] Backend tests prove unauthenticated, non-owner, owner-self, cross-room,
      and missing-member removal attempts do not alter durable membership or
      active sockets.
- [x] Backend tests prove revocation reaches every target-room socket, preserves
      other rooms/tabs, refreshes the owner roster and live presence, and allows
      the removed account to re-enter only according to the current admission
      mode.
- [x] Backend tests prove a durable member can reconnect after in-memory room
      state recreation without a duplicate membership record.
- [x] Browser tests prove the owner-only roster/removal journey and the revoked
      browser's home-route notice on desktop and phone, including keyboard
      cancel/confirmation and accessible pending/error states.
- [x] Any production defects exposed by those tests are fixed without widening
      the room-governance product model; format, lint, typecheck, isolated test,
      build, and applicable Playwright checks pass.

## Out of scope

- Bans, invitations, ownership transfer, additional roles, per-member
  permissions, persistent admission settings, password-admission
  implementation, and account-management changes.
