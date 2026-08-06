# Implementation plan: room-governance contract hardening

## Ordered work

1. **Map and strengthen backend fixtures**
   - Reuse/extend the buffered WebSocket peer fixture instead of duplicating
     message listeners.
   - Add E2E cases for unauthenticated, owner-self, non-owner, cross-room, and
     missing-member DELETE attempts; assert membership and target sockets stay
     unchanged.
2. **Exercise lifecycle edges**
   - Cover target multi-tab revocation (`revoked` then 1008 for each),
     unaffected peers/other rooms, owner `MEIBO`, and `SHUSSEKI` refresh.
   - Cover durable reconnect after in-memory-state recreation and re-entry under
     open versus closed/password admission modes.
3. **Add browser governance coverage**
   - Factor a small E2E account/room helper only if shared by both projects.
   - Drive owner and member contexts through native dialog cancel and confirmed
     removal, then assert the target home notice/no reconnect on desktop and
     phone.
   - Cover pending/failed removal feedback with an isolated test seam only if
     the existing browser harness can represent it without production leakage.
4. **Repair only demonstrated defects**
   - Keep any fix constrained to the existing REST/WS/store/component boundary;
     do not alter schema or expand roles.
5. **Quality and handoff**
   - Run format, lint, typecheck, isolated complete Bun tests, frontend build,
     and Playwright against a temporary `HOUSOU_DB` dev stack.
   - Update executable specs if a new reusable test or lifecycle convention is
     discovered; review diff for accidental product-model changes before commit.

## Risk gates

- Before adding a fixture helper, search current E2E helpers for equivalent
  buffering/context setup.
- Before changing a constant or client reconnect behavior, search every caller
  and preserve manual `close()` semantics.
- Before accepting a browser test, verify it proves separate authenticated
  contexts rather than simulating authority through a request body.

## Validation commands

```sh
./dx bun run format
./dx bun run lint
./dx bun run typecheck
./dx sh -c 'HOUSOU_DB=/tmp/houkago-governance-hardening.db bun test packages/kokuban/test packages/eisha/test packages/housou/test packages/kyoushitsu/test'
./dx bun run --filter houkago-kyoushitsu build
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts
```
