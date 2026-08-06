# Design: room-governance contract hardening

## Scope and approach

This task verifies and protects the already-shipped owner/member model rather
than adding new governance features. It extends test fixtures and browser
coverage first. Production code changes are permitted only to repair behavior
that one of those tests demonstrates is inconsistent with the existing contract.

## Backend contract matrix

| Boundary | Required invariant |
| --- | --- |
| REST removal | Actor comes only from the session; Origin remains trusted; only the addressed room owner may remove a non-owner durable member. |
| Durable membership | A membership is room-scoped and idempotent. Removal in one room cannot affect the same account in another. |
| Revocation | Every target-room socket receives `NYUUSHITSU/revoked`, then closes with `1008`; other tabs/rooms stay connected. |
| Realtime snapshots | After removal, remaining room participants receive fresh `SHUSSEKI`; admitted owner sockets receive fresh private `MEIBO`. |
| Re-entry | A removed account follows the current first-entry mode: open re-admits and recreates membership; closed/password do not admit it. |
| Recovery | A durable member authenticates and admits after transient in-memory state is cleared/recreated, without duplicate durable rows. |

The backend E2E fixture will become a buffered peer helper so no test loses
messages emitted during WebSocket open. It will use real cookie accounts and a
second room, never invented client identity fields. A reset/recreation seam is
used only in tests if one is necessary; it must not become public runtime API.

## Browser flow

Use two isolated Playwright browser contexts: an owner creates an open room and
a member enters through the shared route. The owner sees the durable roster and
opens its native removal dialog. Escape/cancel preserves membership; confirming
removes it. The owner observes the roster update, while the member is routed to
Home with the revoked notice and does not reconnect.

The same scenario runs once on a desktop project and once on the 375px phone
project. It keeps the current warm-club visual system, native dialog, existing
semantic tokens, and reduced-motion behavior. The test asserts accessible
labels, `role="alert"` error state through a controlled failed request where
practical, disabled confirmation while pending, and no horizontal overflow.

## Compatibility and rollback

No database or wire-format change is planned. The task exercises the existing
`bushitsu_buin`, `MEIBO`, and `NYUUSHITSU/revoked` contracts. If a minimal
production repair is required, it must preserve those schemas and can be rolled
back together with its regression test.

## Risks

- Message-order races around WebSocket open/close can make tests flaky; buffered
  fixtures and predicate-based waits are required.
- Two browser contexts must retain distinct cookies while sharing one room URL.
- A generic network failure is hard to trigger reliably in a browser; any test
  seam must stay test-only and must not weaken REST authorization.
