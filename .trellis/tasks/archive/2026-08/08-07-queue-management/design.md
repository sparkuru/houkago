# Technical design: owner queue management

## Scope and decisions

This task adds owner-only move-up, move-down, and clear-pending operations to
the room queue. Existing add, play, cancel, and single-item delete behavior
continues to use the room-wide `playlist` capability. Reorder and clear are
separate owner-governance operations; they are not delegated by that switch.

The first UI uses explicit buttons rather than drag-and-drop. Clear requires a
native dialog confirmation and preserves the server-authoritative current
Enmoku, selected by `JOUEI`, together with its synchronized playback.

## Queue-pool model

`Enmoku` remains the room-owned, immutable playable-source record: URL metadata
and `addedBy` belong to it. A new durable `bangumi_entry` relation holds the
source's current placement in that room queue:

```text
bushitsu 1 ── * bangumi_entry * ── 1 enmoku
                         |
                    sort_key (durable order)
```

The first version has one placement per Enmoku (`enmoku_id` is the entry key),
but it deliberately keeps placement outside source metadata. Future
multi-member work can add an actor/policy, revision, proposal, or vote layer at
the entry/mutation boundary without redesigning public-source metadata or the
current BANGUMI consumer contract. It does not add any future authority fields,
roles, or collaboration behaviour now.

`schema.sql` defines the new relation and an index for room/order reads.
Bootstrap backfills one entry for every legacy Enmoku in existing
`created_at, id` order. New source creation inserts the Enmoku and its entry in
one transaction. `fetchBangumi` joins entries to Enmoku and orders by
`sort_key, enmoku_id`; the `BANGUMI { enmoku: Enmoku[] }` wire shape remains
unchanged.

`sort_key` is a server-owned integer. Reorder atomically swaps the target with
its immediate neighbour. Adding a source assigns the next key. A direction with
no neighbour is a successful no-op that leaves the snapshot stable. This keeps
the mutation atomic and makes concurrent requests resolve to a serialized
server order; all clients converge from the resulting full snapshot.

The existing single-item deletion continues to delete the Enmoku and its queue
entry. Clear-pending removes all queue entries and their Enmoku records except
the current authoritative `shinkouSeigyo.genjou(roomId).enmokuId`; it does not
send `JOUEI`, alter Shinkou, or touch the current record. If the server has no
current authority state, every queued item is pending.

## REST and authorization contract

Add two TypeBox-validated REST mutations under the room resource:

- `POST /bushitsu/:id/bangumi/:enmokuId/move { direction: "up" | "down" }`
- `DELETE /bushitsu/:id/bangumi/pending -> { ok: true, removed: number }`

Both require trusted Origin, a resolved session, current room admission, and
`bushitsu.buchouId === actor.id`. They must not accept `addedBy`, owner id, or
any client-provided current-item id. A non-owner and an admitted member with
`playlist` enabled both receive the existing structured 403 `FORBIDDEN` error.
Missing room/item uses the existing typed not-found errors. Each successful
mutation publishes exactly one full `BANGUMI` snapshot through the existing
room topic.

## Frontend behavior

`BushitsuView` remains the room-state composition owner. The Pinia queue is
only written by the server snapshot; management handlers never locally reorder
or clear it. They await Eden REST results and let `BANGUMI` converge the view.

When `bushitsu.isBuchou` is true, each queue row has labelled move-up and
move-down controls. Boundary controls use `disabled`, and the current item may
be reordered because it does not change `JOUEI` or playback. The host also sees
one danger-styled “clear pending” control. Non-owners do not see these controls,
regardless of `canPlaylist`.

Clear opens a native `<dialog>` with cancel and confirm actions. Confirm is
disabled while the request is pending. Failure appears in a `role="alert"`
message with the existing retry path; success closes the dialog and is observed
through the new snapshot. Controls must have visible focus, accessible names,
at least 44px pointer targets, no gesture-only equivalent, and no destructive
meaning conveyed only by colour. Reuse the room's semantic CSS tokens and its
existing desktop panel / phone disclosure layout; no new application-wide
design system is introduced. Motion is limited to existing 180–300ms
feedback and respects reduced-motion handling.

## Compatibility, rollout, and rollback

The additive schema bootstrap backfills existing queues deterministically and
keeps the existing REST reads, `BANGUMI` schema, Enmoku metadata, source
resolution, and WebSocket playback contract compatible. A failed upgrade must
surface at startup rather than silently serving an incomplete queue.

Rollback is code-plus-database compatible: the new relation is additive and
old code can still read Enmoku records in creation order. Rolling back loses
manual ordering but preserves all media metadata; do not destructively drop the
new table in application code.

## Validation design

- DB/domain tests cover backfill order, enqueue placement, atomic neighbour
  swaps, boundary no-ops, clear preserving a current item, and clear with no
  current selection.
- REST/WS E2E covers owner success, unauthenticated/non-owner/not-admitted
  rejection, exact BANGUMI broadcast to room clients, and unchanged JOUEI/
  GENJOU after clear.
- Frontend unit tests cover owner gating, boundary disabled states, loading and
  error recovery helpers, and snapshot-driven order.
- Playwright covers owner move/clear-confirm paths and member absence of owner
  controls on the configured desktop and phone projects.
