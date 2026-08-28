# Migrate Bilibili and local danmaku sources

## Goal

Move the existing Bilibili official fetch and local danmaku-file paths behind
the common candidate, provenance, storage-pool, and single-track contracts.

## Requirements

- Ingest user-triggered Bilibili official danmaku through the existing
  server-side fetch/parser boundary into a provenance-preserving pool revision.
- Refresh the logical Bilibili track on bounded freshness/use triggers; unchanged
  normalized content reuses its revision, changed content creates a new
  immutable revision, and upstream failure retains the latest valid revision.
- Allow a `Komon` to disable or roll back a bad provider revision without
  deleting its provenance or audit history.
- Do not bulk crawl Bilibili or make the browser fetch upstream comments.
- Represent the existing local file as a viewer-personal candidate without
  silently publishing it to the server-wide pool.
- Remove the Bilibili-specific room-view guard and hard-coded local-over-remote
  winner in favor of common candidate orchestration.
- Preserve legacy queued Enmoku behavior and realtime room danmaku.

## Acceptance Criteria

- [x] Bilibili official cues normalize, persist, and replay through a common
  track reference with provenance intact.
- [x] A later Bilibili refresh follows the approved versioning, deduplication,
  fallback, disable, and rollback behavior.
- [x] A local XML file appears as a personal candidate and can replace the
  active timeline track without changing the room default.
- [x] Existing Bilibili playback, local file parsing, and failure degradation
  remain covered by regression tests.

## Dependencies and Boundaries

- Depends on the identity/storage child.
- Integrates with the hybrid-selection contract when that sibling is available;
  neither child duplicates the other's ownership.
- No third-party connector or local-video provider is included.
