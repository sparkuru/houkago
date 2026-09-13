# M1 validation evidence

Date: 2026-09-13 (Asia/Singapore)

## Checks

| Command | Result | Evidence |
| --- | --- | --- |
| `./dx bun test packages/kyoushitsu/test/room-session.test.ts packages/kyoushitsu/test/shinkou-controller.test.ts packages/kyoushitsu/test/use-shinkou.test.ts packages/kyoushitsu/test/client.test.ts` | PASS | 32 tests passed, 0 failed, 98 expect calls. |
| `./dx bun run typecheck` | PASS | All six workspace package typechecks exited 0. |
| `./dx bun run lint` | PASS | Biome checked 249 files; no fixes applied. |
| `./dx bun run test` | PASS | 388 tests passed, 0 failed, 1,791 expect calls across 78 files. |
| `./dx bun run --filter houkago-kyoushitsu build` | PASS | Vite production build completed successfully; existing dash.js CommonJS warning remains. |

The first parallel lint attempt was blocked by the wrapper's host port 5173
mapping; the serial retry above passed. No browser check was attempted in this
review. The M0 browser prerequisite limitations remain unchanged.

## Reviewer fixes

- Room-session HTTP room and queue results are rejected when their payloads do
  not belong to the active room, including current-item fallback resolution.
- A non-connecting transport status clears the explicit-connect marker so an
  offline-to-online connection starts a fresh connection epoch.
- Transport construction failure returns the controller to a retryable
  unstarted state.
 Added focused regressions for all three cases; current-item resolution moved
  to the session while the page retains `resolveEnmoku` for playlist commands.
