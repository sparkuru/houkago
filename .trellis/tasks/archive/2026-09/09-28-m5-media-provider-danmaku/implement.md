# M5 implementation plan

Status: implementation and verification complete. The owner approved the
Trellis Phase 3.4 work commits. The owner authorized implementation with
`开始实现 M5`; `task.py start` has been run.

## Ordered work

- [x] 1. Record git status; read React, Vue-shared, HTTP and adapter specs.
      Inventory the exact M4 and Vue media/test surfaces. Preserve unrelated
      changes.
- [x] 2. Export M1 player/sync and needed pure metadata/provider/danmaku
      helpers through portable subpaths. Remove `@/lib` aliases from exported
      pure modules. Check the React graph before binding features.
- [x] 3. Extend `RoomRuntime` with server-authored playback and
      danmaku-default snapshots, typed playback sending, one sync controller
      and disposal. Test message order, permission, reconnect and stale scope.
- [x] 4. Build React player driver/host with MP4/HLS/DASH, pending seek,
      source/subtitle controls, join gate, lock, fullscreen, cinema and cleanup.
      Wire local media events through the sync controller.
- [x] 5. Add narrow generated HTTP adapters for Baidu/danmaku operations still
      consumed through Vue/Eden. Implement Baidu connection, browsing, source
      creation, availability and grant playback over existing adapter helpers.
      Test single-shot grant, cancellation, fingerprint recovery and error
      states before UI completion.
- [x] 6. Implement candidate/file/live danmaku workflow and React controls.
      Send live danmaku through the room command port. Preserve
      override/default precedence, fallback, manual match/proposal
      and fullscreen overlay placement. Guard old item/room responses.
- [x] 7. Add focused unit/browser fixtures and two-client playback/provider/
      danmaku scenarios at desktop and 375px. Retain M4 room tests; inspect
      focus, overflow and fullscreen subtree. Record fixture limitations.
- [x] 8. Run root lint/typecheck/tests, React build, contract drift and module
      graph checks. Update executable specs and validation evidence; inspect
      diff. Follow Trellis review, commit and archive steps only after approval.

## Validation matrix

| Boundary | Required evidence |
| --- | --- |
| Player | One ArtPlayer/engine; Strict Mode replay, source/item/room disposal, pending seek, no late callback |
| Sync | Two clients, host/permitted guest, unauthorized lock, SHINKOU vs GENJOU, late join |
| Baidu | Pairing/retention/OAuth fixture, browse/create/permit, mobile and availability, bounded grant/fingerprint recovery |
| Danmaku | Live/timeline/file cues, default/override ordering, fallback/error, search/match/proposal, fullscreen |
| Regression | M4 admission/queue/chat/governance, direct URLs, desktop/375px, aggregate packages and contract drift |

Expected Phase 2 integration commands, after focused checks:

```sh
./dx bun run typecheck
./dx bun run lint
./dx bun run test
./dx bun run contract:drift
./dx bun run --filter houkago-kyoushitsu-react build
git diff --check
```

Use `scripts/dev-react-preview.sh` with task-owned ports for browser tests;
the React Playwright config does not launch servers. Record exact browser
commands/results in `validation.md`. Browser launch may need the sandbox
escalation documented in M4. Inspect `dist/module-graph.json` after build.
If shell scripts change, run syntax, ShellCheck, shfmt and shell harness checks.

## Review and rollback points

1. **Portable export:** stop if React pulls Vue/Pinia/Eden/Housou server or
   duplicates the sync algorithm.
2. **Session/player:** stop if player events bypass permission, accepted WS
   order or generation guards. M4 runtime remains the sole socket owner.
3. **Provider:** stop if effect replay creates another grant, grant URL enters
   persistent cache, or stale grants survive a scope change.
4. **Danmaku:** stop if candidate HTTP overwrites a newer WS room default or
   per-frame events enter Query.
5. **Integration:** restore previous React media placeholder and shared
   exports if validation fails; no backend migration is planned.
