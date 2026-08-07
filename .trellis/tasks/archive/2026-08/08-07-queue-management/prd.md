# Queue management

## Goal

Make the existing room queue governable after the completed durable-membership
foundation: users should be able to manage queued public playback sources in a
way that preserves the server-authoritative, URL-first room model.

## Confirmed facts

- `design.md` §10.3 authorizes queue management as a distinct follow-up to the
  completed durable member/owner-governance work, without expanding the
  URL-first product boundary.
- A room already exposes a server-authoritative `BANGUMI` queue snapshot;
  clients de-duplicate it by Enmoku id and must not optimistically append items.
- Existing room permissions include the room-wide `playlist` switch. The owner
  always has the capability; guests receive it only when the server permits it.
- The current UI already supports adding a public source, selecting it for
  playback, cancelling current playback, and deleting a non-current item. The
  REST mutation gate requires current room admission and the `playlist`
  capability for every actor.
- Queue order is durable only as ascending creation time. There is no position
  field, reorder endpoint, or bulk-clear operation. Create/delete broadcast the
  full `BANGUMI` snapshot to the room.
- The SQLite bootstrap already supports idempotent additive schema upgrades, so
  a durable ordering structure can be introduced without replacing rooms or
  their existing source records.
- The queue is a responsive in-room panel: a desktop workbench panel and a
  collapsible phone section. Existing Playwright coverage proves the URL
  composer is reachable in both layouts.

## Requirements

1. Add owner-only queue reordering and bulk clear while keeping the existing
   `playlist` capability for ordinary add/select/cancel/delete behavior.
2. Model queued source entries separately from their queue placement so a later
   explicit multi-member collaboration policy can be added without redesigning
   the ordered queue or changing public-source semantics. This task must not
   grant members those management operations.
3. Preserve the completed membership/owner authorization boundary and the
   existing URL-first source policy.
4. Keep unrelated room-governance expansion out of this task unless explicitly
   approved.
5. Bulk clear removes only queued, non-current items. It must preserve the
   current Enmoku, `JOUEI` selection, and ongoing synchronized playback.

## Key decision

- The authenticated room owner alone may reorder the queue or clear it in this
  first slice. Future multi-member queue collaboration is a compatibility goal,
  not an authorization change: its actors and conflict rules require a later
  product decision.
- Reordering uses visible move-up and move-down controls, never a drag-only
  interaction. This gives keyboard and phone users the same operation model.

## Initial scope boundaries

- No platform browsing, search, recommendation, source-session sharing, or new
  third-party source capability.
- No new room role, per-member permission system, invitation, ban, or ownership
  transfer model.
- No guest access to reorder or bulk-clear operations, no voting, and no
  collaborative conflict-resolution UI in this slice.
- No bulk operation that stops playback or deletes the current Enmoku.
- Existing source resolution and ordinary enqueue behavior remain the baseline
  unless a selected queue-management rule explicitly requires a compatible
  change.

## Acceptance Criteria

- [ ] The selected queue-management workflow is observable and testable for
      authorized and unauthorized users on supported desktop and phone layouts.
- [ ] Clearing the queue preserves the currently playing Enmoku and its
      synchronized playback while removing every pending item.
- [ ] The server remains authoritative for queue state and rejects unauthorized
      or invalid mutations without corrupting the queue or current playback.
- [ ] Owner reordering changes the durable queue order atomically and broadcasts
      one full authoritative `BANGUMI` snapshot to every admitted room client.
- [ ] An owner can clear all pending items only after a confirmation; the action
      exposes pending, success, and retryable-error states without relying on
      color or pointer hover.
- [ ] Move controls are keyboard reachable, have accessible names, and remain
      usable at the supported phone and desktop viewport projects.
- [ ] Existing durable membership and URL-first boundaries remain intact.
