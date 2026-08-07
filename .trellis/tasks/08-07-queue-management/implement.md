# Implementation plan: owner queue management

## Ordered work

1. **Establish the queue-placement persistence boundary.**
   - Add `bangumi_entry` DDL, bootstrap backfill, prepared query helpers, and
     transaction-backed Enmoku-plus-entry insertion.
   - Change queue reads to use durable placement order while preserving the
     `Enmoku[]` consumer and `BANGUMI` payload.
   - Add focused DB/domain tests for migration/backfill, insert, move, and
     clear semantics.
2. **Add owner management mutations.**
   - Add thin TypeBox REST routes for move and clear-pending.
   - Keep session, Origin, current-admission, and exact owner checks on the
     server; derive the current item from `shinkouSeigyo`, never request input.
   - Publish one full snapshot only after a successful mutation and add E2E
     authorization/broadcast/playback-preservation coverage.
3. **Build the accessible room controls.**
   - Extend existing Bangumi action helpers and `BushitsuView` with owner-only
     move controls plus a clear-confirm native dialog.
   - Keep server snapshots authoritative; expose request-pending, error, and
     retry behavior locally without optimistic queue edits.
   - Add localized labels, semantic button states, and responsive styles that
     preserve existing row scan order and phone disclosure layout.
4. **Verify all layers.**
   - Run focused backend/frontend tests while iterating, then repository format,
     lint, typecheck, test, build, and applicable Playwright checks.
   - Record the exact browser-validation evidence and perform the required
     human review of destructive confirmation and responsive control ergonomics.
5. **Complete the Trellis finish gates.**
   - Run the full quality review, update specs only for demonstrated durable
     conventions, review the diff, commit the scoped task, and archive it only
     after validation evidence is recorded.

## Risk and rollback points

- Preserve `JOUEI` and `GENJOU` when clearing; regression here interrupts every
  viewer and requires immediate rollback of the clear route.
- Keep the old `BANGUMI` shape during placement-table adoption; expanding the
  shared contract is out of scope.
- Do not replace the `playlist` permission with a new role/switch. Owner-only
  management must be an exact server-derived owner check.
- If a browser interaction cannot meet the phone and keyboard contract, retain
  explicit buttons and defer any richer interaction rather than adding
  drag-only behavior.

## Validation commands

```sh
./dx bun run format
./dx bun run lint
./dx bun run typecheck
./dx bun test
./dx bun run --filter houkago-kyoushitsu build
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts
```

## Pre-start review checklist

- [ ] The database backfill and current-playback semantics are covered by tests.
- [ ] Owner-only authorization is enforced server-side, not by hidden buttons.
- [ ] The full BANGUMI snapshot remains the only client queue authority.
- [ ] Desktop/phone, keyboard, pending, success, and error states are specified.
- [ ] Future collaboration is limited to the placement boundary; no role or
      conflict policy is silently implemented.
