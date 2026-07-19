# Implementation plan: Self-hosted identity and room authorization

## Preconditions

- Treat existing `houkago.db` data as deliberately incompatible. Do not add a
  UUID-claim migration or auto-delete data; document and enforce the explicit
  reset boundary before the authenticated server starts.
- Load `trellis-before-dev` and the backend/frontend specifications before code
  changes. Keep all work inside the URL-first scope defined in this task.

## Ordered work

1. **Shared account contract and fresh persistence**
   - Add public `Seito`/session-safe contract types in `houkago-kousoku`; never
     add a raw token or password field to the shared contract.
   - Add fresh-schema detection, `seito` and `seitoshou` tables, indexes, and
     query modules for normalized username lookup and digest-keyed session
     lifecycle.
   - Change fresh room/queue ownership storage to account ids. Retain only
     explicit reset handling for legacy UUID-owned rows.

2. **Authentication service and routes**
   - Implement username/password validation, asynchronous Argon2id hash/verify,
     opaque token generation, SHA-256 digesting, expiry, revocation, and cookie
     construction in focused backend modules.
   - Add typed `/seitoshou/register`, `/sign-in`, `/sign-out`, and `/me` routes.
     Normalise all invalid sign-in outcomes to one public error; password and
     token values must never reach logs or response JSON.
   - Configure credentialed, explicit-origin CORS and state-changing Origin
     validation. Make the allowed Kyoushitsu origin and cookie `Secure` mode
     deployment configuration rather than hard-coded production assumptions.

3. **Room REST authorization**
   - Remove `buchouId`, `addedBy`, and public source headers from new
     client-facing mutation bodies where an authenticated server actor must own
     them.
   - Resolve the actor once at the route boundary and pass a typed identity into
     room domain operations.
   - Require an authenticated admitted member plus the existing `canPlaylist`
     permission for preview, enqueue, and delete; continue to broadcast the
     authoritative `BANGUMI` snapshot after a permitted mutation.

4. **WebSocket identity migration**
   - Authenticate the handshake using the same session cookie and trusted
     Origin. Remove client-provided identity/nickname query authority.
   - Store `seitoId` and username per connection; use them for host checks,
     admission/presence, permission gates, and all client-originated broadcasts.
   - Keep the existing reconnect owner and `OIKAKE -> GENJOU` recovery path;
     it reconnects with the cookie, not a local UUID.

5. **Kyoushitsu account flow**
   - Replace `lib/identity.ts` UUID authority with a typed public-account store
     and Eden auth composable/API calls using `credentials: "include"`.
   - Rework the entry route into account restoration, single-column sign-in,
     progressive registration, and authenticated room join/create. Use the
     approved UUPM form decisions while retaining the warm token system.
   - Remove `addedBy` plumbing from the composer and remove `senderId`/
     nickname identity arguments from the WS client connection API. Preserve
     existing room layout, player, chat, danmaku, and URL-preview behavior.

6. **Tests and verification**
   - Add backend unit/API tests for password/session helpers, expiry/revocation,
     username uniqueness, generic sign-in failure, Origin rejection, and all
     REST authorization states.
   - Add WS E2E tests that prove query/envelope impersonation fails and
     authenticated host/guest permission behavior remains correct.
   - Add frontend unit tests for account-state restoration and auth form state;
     update existing client/composer tests for server-derived identity.
   - Add Playwright coverage for register/sign-in/reload, create/join, and a
     denied queue mutation in applicable desktop and `phone-375` projects.

## Validation commands

```bash
./dx bun run format
./dx bun run lint
./dx bun run typecheck
./dx bun test
./dx bun run --filter houkago-kyoushitsu build
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts
```

Record the browser command, viewports, fixtures, and residual security/UI review
in the task check evidence. Preserve trace and screenshot artifacts on failure.

## Review gates and rollback

- Before `task.py start`: user reviews `prd.md`, this design, and the plan;
  confirm the reset boundary and no-third-party scope remain explicit.
- Before commit: run the complete quality gate and review cookie security,
  CORS/Origin behavior, unauthenticated/mismatched WebSocket cases, and the
  full mobile/desktop account path.
- Rollback requires code and database compatibility together. Never restore old
  UUID semantics against an auth-initialized database as an emergency shortcut.
