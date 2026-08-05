# Implementation plan: room governance foundation

## Preconditions

- Load `trellis-before-dev`, then the affected backend/frontend/shared-contract
  guidance before editing code.
- Keep the task within the approved two-role, no-ban, URL-first boundary.
- Reuse the existing Playwright configuration and host-Chrome command; preserve
  failure traces and screenshots.

## Ordered work

1. **Shared contract and persistence**
   - Add typed durable-roster entities, `MEIBO`, and `NYUUSHITSU.revoked` to
     `houkago-kousoku`; update protocol and store/client tests.
   - Add the additive `bushitsu_buin` schema and prepared query module. Make
     room creation atomically create the owner relation; provide idempotent
     ensure/list/delete/lookup operations and a bootstrap `INSERT OR IGNORE`
     backfill limited to already-authenticated room owners.
2. **WebSocket admission and roster delivery**
   - Move durable-member lookup into authenticated open/admit flow: existing
     members bypass first-entry mode, while unknown accounts retain current
     admission behavior and become members only upon successful admission.
   - Send owner-targeted `MEIBO` snapshots on owner admission and membership
     changes. Keep `SHUSSEKI` live-only and topic-published.
3. **Owner removal boundary**
   - Add a narrow owner-authenticated, Origin-checked DELETE route and domain
     operation. Reject unauthenticated, non-owner, owner-self, wrong-room, and
     missing-target attempts without partial effects.
   - Add a WS-hub revocation helper that sends `revoked`, closes every target
     socket, updates presence, and refreshes only owner roster recipients.
4. **Kyoushitsu state and management UI**
   - Add owner-targeted durable-roster state and revoked-state handling to the
     existing store/client flow; cancellation of automatic reconnect must be
     deliberate and route-owned.
   - Extend the existing `KengenPanel` with owner-only durable rows, accessible
     remove controls, native confirmation dialog, pending/error state, and
     portrait-safe layout. Wire the confirmed REST action in `BushitsuView`.
   - On revocation, display the approved notice and return to Home without
     replaying commands or reconnecting. Other users retain only live presence.
5. **Documentation and verification**
   - Update `design.md` §10.3 to reflect the completed authentication slice and
     this governance slice; update stable specs only for confirmed contracts.
   - Add focused DB/domain/REST/WS tests, store/client/component tests, and
     desktop plus phone Playwright flows for membership, removal, redirect, and
     privacy. Then run the full quality gate and capture browser evidence.

## Validation commands

```sh
./dx bun run format
./dx bun run lint
./dx bun run typecheck
./dx bun test
./dx bun run --filter houkago-kyoushitsu build
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts
```

Record the exact browser command, covered viewports/states, fixtures, result,
failure artifacts (if any), and residual human review in task check evidence.

## Rollback points

- Before schema work: verify no UUID-owned data boundary is weakened.
- Before UI wiring: verify `MEIBO` is owner-targeted, not topic-published.
- Before commit: review multi-socket revocation, reconnect cancellation, and
  owner/self/cross-room authorization failures alongside the complete quality
  gate.
