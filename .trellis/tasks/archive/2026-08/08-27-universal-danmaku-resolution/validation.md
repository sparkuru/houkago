# Parent integration validation

## Review scope

This review covers the four archived children and the parent integration work:

- `08-28-danmaku-identity-pool`
- `08-28-danmaku-hybrid-selection`
- `08-28-danmaku-source-migration`
- `08-28-baidu-danmaku-matching`
- manual episode search/correction, bounded Baidu fingerprint wiring, and
  cross-provider/browser evidence added by the parent

All four child task records are `completed` under
`.trellis/tasks/archive/2026-08/`.

## Automated gate — 2026-08-29 final integration run

- `./dx bun run format` — 234 files, no fixes required.
- `./dx bun run lint` — 234 files clean.
- `./dx bun run typecheck` — all six workspaces passed.
- `./dx bun run test` — 344 passed, 0 failed, 1,656 assertions across 73
  files.
- Focused Baidu/source integration tests — 10 passed, 0 failed, 104
  assertions; includes candidate-route fingerprint reuse and the
  Bilibili-plus-Baidu fixture.
- `./dx bun run --filter houkago-kyoushitsu build` — passed. The existing
  `dashjs` CommonJS-in-ESM warning remains non-blocking.
- `danmaku-phone` and `danmaku-desktop` Playwright projects — 2 passed, 0
  failed, using installed Google Chrome against the local development
  services.
- `git diff --check` — passed.

## Acceptance review

### Covered

- The shared identity/storage, source-policy, room-default, viewer-override,
  revision, rollback, content-deduplication, proposal, audit, and trust-scope
  contracts are exercised by the archived child tests.
- Bilibili official and local-file sources resolve through the common candidate
  path, preserve legacy fallback, and remain separate from realtime room
  `DANMAKU`.
- Baidu filename/size/duration matching remains bounded and explainable;
  personal confirmation, room selection, audited `Komon` promotion, safe
  failure, and distinct release-specific alignment are covered.
- `GET /danmaku/episodes?q=...` is connected to a visible source-panel search.
  A selected result submits only the current viewer's personal
  release-to-episode confirmation; the server receives bounded release
  evidence and never receives provider credentials or media bytes.
- The adapter's optional fingerprint is requested only after a ready Baidu
  grant, forwarded as a paired digest/value query, persisted as release
  evidence, and reused only when a peer release already has a `Komon` global
  mapping. Fingerprint failure falls back to ordinary playback preparation.
- The `Bilibili and Baidu releases reuse one canonical episode track` fixture
  proves distinct provider releases converge on one episode/track while
  retaining provider provenance and release identity.
- The responsive browser scenario covers manual search, personal confirmation,
  candidate selection, failure/empty fallback states, 44px controls, and
  horizontal overflow at both 375px and desktop widths.

### Safety and deferred boundaries

- No new global association is created by a filename score, fingerprint, or
  personal/room selection; only the existing audited `Komon` promotion can
  establish server-wide matcher knowledge.
- Fingerprint comparisons require the same algorithm, scope, and byte count.
  Partial query input is rejected, and malformed values remain outside the
  resolver.
- The Houkago server remains a control plane: the adaptor reads only a bounded
  authorized prefix, while private Baidu URLs, credentials, and media bodies
  stay outside room/API state.
- No real provider credentials are required for automated acceptance. Installed
  production browser/provider behavior remains the previously documented
  separate human smoke boundary.

## Decision

The parent integration review is complete. The task is ready for the final
commit and Trellis finish-work archival steps.
