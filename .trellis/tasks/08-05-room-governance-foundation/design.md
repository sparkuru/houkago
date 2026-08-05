# Design: durable room membership and owner governance

## Scope and invariants

This slice adds a durable relationship between a `Seito` account and a
`Bushitsu`. It preserves server-derived account identity, the URL-first media
boundary, current two-tier owner/member authority, and live WebSocket presence.
It neither changes the owner id nor expands admission/password features.

The durable roster is confidential room-governance data: only the current owner
receives it. Live `SHUSSEKI` remains a separate, admitted-room presence snapshot
for every admitted socket.

## Persistence

Add `bushitsu_buin`:

| Column | Meaning |
| --- | --- |
| `bushitsu_id` | Referenced room id; part of the composite primary key |
| `seito_id` | Referenced account id; part of the composite primary key |
| `joined_at` | Server epoch-ms timestamp for the durable admission |

The owner is represented by a membership row but its role is derived from
`bushitsu.buchou_id`; there is no mutable role column. Prepared statements in a
dedicated `db/queries/bushitsu-buin.ts` module provide idempotent ensure, lookup,
owner roster listing (joined to public account username), and delete operations.
`createBushitsu` writes the `bushitsu` row and owner membership in one SQLite
transaction. The obsolete `buin` table remains untouched and is not repurposed.

Only membership persists. `kengen`, `nyuushitsu` mode/password, pending approval
requests, presence, and playback state retain their present in-memory lifecycle.

## Admission and authorization

On WebSocket open, after cookie/origin authentication and room lookup:

1. The owner or a `bushitsu_buin` account is admitted immediately.
2. An unknown account follows the existing `open` / `approval` / `closed` /
   current `password` branch.
3. `admit()` ensures membership before subscribing and publishing presence.
   That makes open admission and approval durable without trusting a client
   message. The operation is idempotent for multiple tabs or reconnects.

Existing route queue authorization keeps its separate live-presence condition;
durable membership does not itself authorize REST queue changes. The current
room-level `canPlaylist` gate continues unchanged.

## Durable roster and revocation protocol

Extend `houkago-kousoku` with a server-to-client `MEIBO` snapshot and a
`NYUUSHITSU` status `revoked`.

- `MEIBO` carries a typed, joined public-account roster (`id`, `username`,
  `joinedAt`, derived role). It is sent only to owner connections upon admission
  and after any membership creation/removal. It is never published to the room
  topic.
- `NYUUSHITSU { status: "revoked" }` is sent to each active target connection
  before closing it with policy code `1008`. The frontend treats this as a final
  access state, closes its deliberate client transport to cancel reconnect, and
  returns to Home with a clear status notice.

Add `DELETE /bushitsu/:id/meibo/:seitoId`. It validates trusted Origin and the
session, verifies the actor owns the addressed room, rejects owner-self and
cross-room/nonexistent targets, deletes membership, then invokes a focused WS
hub helper to revoke every matching active socket. The helper refreshes owner
`MEIBO` snapshots and live `SHUSSEKI`; it does not allow an HTTP body to select
the actor or role.

## Frontend interaction design

The existing `KengenPanel` is the room-information boundary. Keep its current
online presence list for every admitted viewer. For the owner only, add a
durable-members subsection driven solely by owner-targeted `MEIBO` state in
`useBushitsuStore`; each non-owner row has an accessible remove action.

Removal opens a native `<dialog>` with the member name and the explicit effects
(disconnect now, membership revoked). Escape/cancel leaves state unchanged;
confirm disables the action while the REST call is pending, reports failure near
the action, and waits for the authoritative `MEIBO` snapshot rather than
optimistically editing server truth. The target receives a visible access-revoked
notice before route return. The same semantic tokens, native controls, visible
focus, 44px touch target, and portrait disclosure layout are retained. No new
decorative motion is added; existing reduced-motion behavior remains effective.

These choices use the task-specific UUPM research in
`research/ui-ux-pro-max.md`, but intentionally retain the existing warm-club
theme rather than importing its generic palette or typography.

## Compatibility and rollback

The additive table is safe for fresh authenticated databases and uses the
project's idempotent schema bootstrap. During bootstrap, after the existing
authenticated-schema/legacy-UUID guard passes, one idempotent `INSERT OR IGNORE
... SELECT` creates a membership row for every existing authenticated room
owner. It never claims an unmatched UUID owner. If code rollback is needed, the
additive membership table is harmless but its durable semantics are not
available to older code; restore code and database together for behaviorally
consistent rollback.

## Validation risks

- Multiple browser tabs must not create duplicate memberships or leave one
  active socket after a revocation.
- Owner-only `MEIBO` delivery must be tested separately from room-topic
  broadcasts so offline roster data never leaks.
- A revoked client must cancel its automatic reconnect path before navigation;
  otherwise an open room could immediately readmit it and hide the revocation.
- Browser checks must verify keyboard dialog escape/cancel, destructive confirm,
  portrait layout, and the target's redirect/notice in addition to API security.
