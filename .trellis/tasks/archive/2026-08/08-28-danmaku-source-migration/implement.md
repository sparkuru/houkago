# Implementation plan: migrate Bilibili and local danmaku sources

## Ordered work

1. Add the Bilibili official adapter from existing eisha fetch through kokuban
   canonicalization into pool ingestion.
2. Add freshness/coalescing/unchanged/changed/failure refresh tests and Komon
   disable/rollback behavior.
3. Move local file parsing/state behind the common personal-candidate adapter;
   make empty/invalid files unavailable rather than priority winners.
4. Remove provider and priority branching from `BushitsuView`; retain legacy
   fallback until common-path tests pass.
5. Run parser, fetch, pool, frontend, overlay, fullscreen, and playback
   regression suites with controlled Bilibili fixtures.

## Validation

```sh
./dx bun run --filter houkago-kokuban test
./dx bun run --filter houkago-eisha test
./dx sh -c 'HOUSOU_DB=:memory: bun test packages/housou/test'
./dx bun run --filter houkago-kyoushitsu test
./dx bun run typecheck
```

## Rollback points

- Keep the old reference readable until persisted official playback succeeds.
- Never advance active revision before normalized content is safely stored.
- Preserve the last valid revision and legacy playback when upstream refresh
  fails.
