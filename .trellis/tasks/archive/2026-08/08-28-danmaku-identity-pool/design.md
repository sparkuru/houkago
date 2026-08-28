# Design: danmaku identity and storage pool

## Boundary

This child owns the reusable backend/shared foundation. It adds no provider
connector and no final room source-selector UI. Legacy `Enmoku.danmaku` remains
unchanged and readable.

## Contracts and persistence

- Add strict `kousoku` types for episode, release, typed evidence, source class,
  track, revision summary, alignment, trust scope, proposal, decision, and
  source policy. Digest equality requires equal algorithm and scope.
- Add prepared-query modules and additive schema for the records fixed in the
  parent design. Raw row shapes never leave `db/`.
- Store canonical cue JSON once in `danmaku_content`, keyed by SHA-256 after
  byte-equality collision defense. A revision retains its content hash even if
  an eligible historical blob is later collected.
- `danmaku_track.active_revision_id` selects playback content. Rollback changes
  that pointer transactionally and appends audit; it never mutates/deletes a
  revision. An explicit pin protects rollback content.
- `release_episode_match` records scope plus owning subject: personal
  (`seito_id`), room (`bushitsu_id`/`enmoku_id`), or global (`Komon` reviewer).
  Database/service validation rejects cross-scope subject combinations.

## Komon

Add an active/revoked `komon` grant table and `requireKomon()` next to the
existing session boundary. `HOUKAGO_KOMON_USERNAMES` performs idempotent startup
bootstrap only after every configured account already exists; missing accounts
fail startup. `Komon` is not added to `YakuwariSchema` and room ownership is
never consulted by site-governance routes.

## Proposal and canonical episode workflow

Authenticated users may search canonical episodes and explicitly submit a
sanitized proposal from a personal/room-confirmed match. A proposal carries
typed safe evidence plus either an existing episode target or a suggested
title/season/episode description. It never carries private provider material.

A `Komon` decision is idempotent and transactional:

- approve against existing episode -> create/promote global association;
- approve as new -> create canonical episode then promote;
- merge -> point at the selected canonical episode and retain disposition;
- reject -> retain proposal and audit without matcher change.

## Refresh and collection foundation

Expose service operations for ingesting canonical cues, beginning/coalescing a
refresh, recording a safe attempt result, activating a changed revision,
disabling/rolling back, pinning, and bounded GC. The provider migration child
supplies actual upstream refresh adapters.

GC is disabled when its grace configuration is absent. When enabled, a bounded
purge deletes only old content with no active, pinned, or otherwise retained
reference and appends an audit event; all identity/revision metadata remains.

## Compatibility and validation

Schema bootstrap is additive and retains current UUID-owner guard, owner roster
backfill, `enmoku`, `baidu_source`, and `danmaku_json`. Tests use temporary
SQLite and prove authority separation, transaction rollback, content dedup,
digest-scope mismatch, idempotent proposal decisions, and GC protection.

