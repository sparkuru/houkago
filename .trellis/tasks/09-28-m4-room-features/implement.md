# M4 implementation plan

The user reviewed the final M4 planning summary and approved implementation
with `开始` on 2026-09-28. `task.py start` moved this task to `in_progress`.
This approval covers M4 only; M5/M6 and production deployment remain separate.

## Ordered work

- [x] 1. Record the starting `git status`, inspect the relevant frontend,
      shared-contract and shell guidelines, and identify exact Vue/React files
      owned by this migration. Preserve unrelated work.
- [x] 2. Expose only framework-free M1 session, WebSocket and pure helper
      subpaths from `houkago-kyoushitsu`; replace the controller's local alias
      import. Prove the React build graph still excludes Vue, Pinia, Eden,
      Housou server and media engines. Do not copy protocol/controller code.
- [x] 3. Add generated-SDK-backed adapters for M4's room/queue/member HTTP
      operations missing from the M2 resource barrel. Keep typed errors,
      credentials, AbortSignal and command no-retry policy. Add focused fake
      transport tests for the new adapters.
- [x] 4. Implement one React room runtime and immutable session snapshot,
      keyed by identity epoch and room ID. Wire `RoomSessionController` and
      `KousokuClient`; handle direct-link identity restore, admission,
      reconnect, revocation, room/account switch and disposal. Unit-test
      StrictMode replay, one live socket, pre-admission gating, stale responses
      and `BANGUMI` precedence before building feature panels.
- [x] 5. Build React admission/status, room header/current item, chat/roster,
      queue and governance features over selectors and typed commands. Include
      public URL queue entry and current-item designation, but label video
      playback as unavailable until M5. Keep server events as authority;
      report command failures and pending states without optimistic privilege
      or queue writes.
- [x] 6. Replace the room handoff route with direct React rendering. Adapt
      home create/join and deep links. Switch the normal local `dev.sh` and
      React Vite/browser configuration to Housou + React at port 5173. Update
      the isolated memory runner and associated M3 handoff tests to match the
      direct room flow; keep service teardown and secret isolation.
- [x] 7. Run focused unit/browser checks, then aggregate static/test/build and
      contract drift checks. Exercise two browser clients through real Housou
      cookies/WS at desktop and 375px. Inspect screenshots and responsive
      controls. Record exact failures, retries, skips and remaining media gap.
- [x] 8. Update executable specs and task validation evidence to the delivered
      boundary; review the final diff for scope, generated artifacts and
      unintended deployment/backend edits. Present any required human review,
      then follow Trellis finish/commit gates.

## Validation matrix

| Scope | Required evidence |
| --- | --- |
| Controller binding | Fake transport: one socket, admission order, reconnect, room/account switch, revocation, disposal and StrictMode replay |
| Realtime authority | Delayed room/queue HTTP versus newer WS; current-item resolution; no Query-owned duplicate queue |
| Feature commands | Host/guest permission gates, queue add/move/delete/clear/select, chat echo, admission decisions and member removal; failure and pending states |
| Actual browser | Direct `/` and `/bushitsu/:id`, real cookies, two clients, waiting/entered/revoked, desktop/375px, keyboard focus and no overflow |
| Media honesty | Playback-unavailable notice; no mounted player/media engine, false playback success or hidden Vue handoff |
| Integration | React module graph, retained package checks, HTTP contract drift, local startup and exact teardown |

Existing project commands to use during Phase 2, serializing Docker/browser
lanes that share ports:

```sh
./dx bun run contract:drift
./dx bun run typecheck
./dx bun run lint
./dx bun run test
./dx bun run --filter houkago-kyoushitsu-react build
git diff --check
```

Use the React package's Playwright config for focused browser scenarios after
an isolated-memory Housou + React runner is started. The test runner does not
start its own web servers. Record the exact new project names, command and
browser executable in `validation.md` once implemented. Run root checks for
retained packages; old Vue browser parity is no longer an M4 gate. If shell
scripts are edited, apply the `code-shellscript` style/validation checks as
well as the repository's shell harness.

## Review and rollback points

1. **Portable boundary:** stop if exporting the session pulls Vue/Pinia/Eden or
   server/media modules into React. Keep the M1 controller as the authority.
2. **Session runtime:** stop if a direct link can fetch protected data before
   admission, create duplicate sockets, or revive stale state. Resolve this
   before UI migration proceeds.
3. **Feature commands:** stop if HTTP acknowledgement becomes the queue or
   permission writer, or an uncertain command is replayed on reconnect.
4. **Local entry switch:** only after React room tests pass, move the normal
   local entry to React. Reverting `dev.sh`/Vite route and React room code is
   sufficient to restore the previous local setup; no DB/protocol changes are
   planned.

M4 is one integrated task because all included features share the same route,
session snapshot and transport. Implementation can be reviewed in the ordered
batches above without creating separate live sockets or competing child tasks.
