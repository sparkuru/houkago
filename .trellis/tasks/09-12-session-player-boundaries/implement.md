# M1 implementation plan — session and player boundaries

## Scope gate

Implement only the approved Vue-preserving extraction. Do not install or edit
dependencies, create a React workspace, alter Housou/Kousoku/Eisha/adapter
contracts, redesign the room shell, or continue into M2 after this task.

## Ordered checklist

1. [x] Re-read the task artifacts and current target files; confirm a clean
       starting diff and record any user-owned changes before editing.
2. [x] Extract PlayerHandle into a framework-free Kyoushitsu contract and
       introduce the framework-free synchronization controller. Preserve the
       existing projection, offset, drift, echo-suppression, authority, and
       catch-up behavior. Make useShinkou a thin Vue/Pinia adapter.
3. [x] Add the injected room-session controller with start, guarded admitted
       send, reconnect/transport callbacks, idempotent dispose, room reset,
       admission-gated bootstrap, OIKAKE ordering, queue revision, and guarded
       current-item resolution.
4. [x] Harden KousokuClient active-socket callback identity for message, open,
       error, and close events without changing its URL, reconnect backoff,
       send-buffer, offline, or manual-close behavior.
5. [x] Add or adapt the store's room-reset/queue-revision seam. Preserve the
       account and nickname projection and all existing historical roster/
       danmaku behavior within a live room.
6. [x] Replace only the corresponding BushitsuView lifecycle wiring with the
       session controller and sync adapter. Keep feature command payloads,
       applyMessage-before-player order, current provider/danmaku composables,
       player props/events, router behavior, and layout markup intact.
7. [x] Add focused tests before broad checks:
       - fake session transport: admission gate, metadata/OIKAKE order,
         newer-BANGUMI wins, reconnect epoch, room/account switch, revocation,
         disposal, late current-item response, and one-socket invariant;
       - framework-free sync/player spies: authorized/unauthorized local drive,
         remote SHINKOU, host GENJOU behavior, catch-up, dispose, and no DOM/
         Vue import in the core contract;
       - retain existing client, store, sync, queue, provider, and media helper
         assertions.
8. [x] Run focused Kyoushitsu tests while iterating, then run all required
       checks and inspect the final diff. Update task-local validation evidence
       with exact commands/results and retain any browser prerequisite block.

## Expected change surface

Expected product/test paths are limited to:

- packages/kyoushitsu/src/lib/player.ts
- packages/kyoushitsu/src/lib/shinkou-controller.ts
- packages/kyoushitsu/src/lib/room-session.ts
- packages/kyoushitsu/src/composables/useShinkou.ts
- packages/kyoushitsu/src/ws/client.ts
- packages/kyoushitsu/src/stores/bushitsu.ts
- packages/kyoushitsu/src/views/BushitsuView.vue
- focused files under packages/kyoushitsu/test/

The list is a review boundary, not permission to change unrelated files. If a
different path is required, record the reason in the task notes before using
it.

## Validation commands

Use the repository wrapper and keep the baseline commands comparable:

    ./dx bun test packages/kyoushitsu/test/room-session.test.ts packages/kyoushitsu/test/use-shinkou.test.ts packages/kyoushitsu/test/client.test.ts
    ./dx bun run typecheck
    ./dx bun run lint
    ./dx bun run test
    ./dx bun run --filter houkago-kyoushitsu build

If a browser-visible lifecycle change warrants a browser check, first use the
project-supported host profile and isolated services from
.trellis/spec/trellis-plus/index.md. The full configured command is:

    PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts

Do not install system packages into the normal ./dx image to make a browser
check appear green. Record missing browser libraries, services, certificates,
or provider credentials as blocked limitations.

## Risky files and rollback points

| File/boundary | Risk | Rollback trigger |
| --- | --- | --- |
| room-session.ts + BushitsuView.vue | admission, queue ordering, and stale callbacks | any HTTP result can replace a newer WS snapshot or bootstrap runs before entered |
| shinkou-controller.ts + useShinkou.ts | shared playback, clock/drift, echo suppression | existing sync assertions change or an unauthorized guest emits |
| ws/client.ts | reconnect and socket lifecycle | reconnect identity/backoff/send-buffer tests change unexpectedly |
| bushitsu.ts reset seam | room isolation and historical display state | account/nickname is cleared or old room state survives re-entry |
| player contract import | framework/media coupling | core module imports Vue/DOM/ArtPlayer or player behavior changes |

## Handoff gate

Before task.py start, confirm:

- prd.md, design.md, and this file are complete and internally consistent;
- both JSONL manifests contain real spec/research entries;
- M0 archived evidence is linked and no M2/M3 work is included;
- the latest planning summary has been presented for explicit review;
- no product code is edited until the task transitions from planning to
  in_progress.

After implementation, run the normal Trellis check, update any durable spec
only for a stable newly discovered convention, and stop at the M1 boundary.
