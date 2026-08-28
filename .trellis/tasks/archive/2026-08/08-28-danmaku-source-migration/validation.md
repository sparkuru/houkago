# Validation

## Automated checks

- `./dx sh -c 'HOUSOU_DB=:memory: bun test packages/housou/test'` — 106 pass,
  0 fail.
- `./dx bun run --filter houkago-kokuban test` — 3 pass, 0 fail.
- `./dx bun run --filter houkago-eisha test` — 35 pass, 0 fail.
- `./dx bun run --filter houkago-kyoushitsu test` — 139 pass, 0 fail.
- `./dx bun run lint` — Biome checked 230 files with no errors.
- `./dx bun run typecheck` — all six workspaces passed.
- `git diff --check` — passed.
- `python3 ./.trellis/scripts/task.py validate
  .trellis/tasks/08-28-danmaku-source-migration` — implement/check manifests
  valid.

## Browser regression

- `danmaku-phone` and `danmaku-desktop` Playwright projects — 2 pass.
- The temporary `dev.sh` services were stopped after the run.
- The container Playwright attempt could not launch its bundled Chromium because
  the image lacks `libglib-2.0.so.0`; the same test then passed with the
  installed host Chrome in headless mode.

## Coverage added

- Server-side Bilibili fetch/parser ingestion, freshness, unchanged/changed
  revisions, failure fallback, blocked-content protection, and refresh
  coalescing.
- Concurrent source resolution reuses one release and logical track.
- Komon revision disable/rollback/pin routes enforce session and trusted Origin.
- Local XML candidates stay viewer-personal and empty/malformed files remain
  unavailable.
