# Danmaku identity and storage pool

## Goal

Establish the provider-neutral episode, media-release, danmaku-track, evidence,
alignment, trust, and durable storage contracts required by every later source
and selection child.

## Requirements

- Model canonical episode identity separately from concrete media releases and
  danmaku tracks.
- Record typed, explainable evidence including filename parsing, algorithm- and
  byte-scope-labelled fingerprints, size, duration, provider references, and
  confirmations.
- Represent confidence as auditable tiers rather than treating a numeric score
  as authority.
- Enforce trust scopes: personal confirmation, room default, and
  `Komon`-approved server-wide association.
- Model `Komon` (顧問) as a persistent site-wide role that may be held by
  multiple accounts and is independent from room-scoped `Buchou` ownership.
  Bootstrap initial holders only through explicit deployment configuration;
  never infer the role from registration order.
- Persist opt-in public proposals with sanitized evidence, submitter/reviewer
  identity, status, merge target, timestamps, and append-only audit events.
- Store normalized, provenance-preserving single-track candidates in a reusable
  server pool without storing media bytes or provider credentials.
- Represent a provider-official source as a stable logical track with immutable
  normalized-content revisions. Create a new revision only when content
  changes; retain enough history for audit, disable, and rollback.
- Deduplicate canonical normalized cue content by content hash across revisions
  and provenance sources, while retaining every logical track, revision,
  provenance, proposal, promotion, and audit record independently.
- Retain metadata durably. Protect the current valid content and explicitly
  pinned rollback points from automatic collection; permit only unreferenced
  historical content blobs to be collected after a configurable grace period.
  Content-blob collection is opt-in and disabled unless configured.
- Support release-specific timeline alignment without mutating the underlying
  canonical track.

## Acceptance Criteria

- [x] Two releases can map to one episode while retaining distinct fingerprints
  and alignment records.
- [x] Multiple candidate tracks can belong to one episode without losing source
  provenance or revision identity.
- [x] Only audited `Komon` promotion creates a server-wide trusted
  release-to-episode mapping.
- [x] Proposal approval, rejection, and merge are authorized, auditable, and
  idempotent; selection without explicit submission creates no proposal.
- [x] Digests with different algorithms or byte scopes cannot compare equal.
- [x] Persistence round-trips identities, evidence, trust, provenance, and
  alignment with additive migration coverage.
- [x] Track revision state supports latest-valid resolution, unchanged-content
  deduplication, failed-refresh fallback, `Komon` disable, and rollback.
- [x] Revisions with equal canonical normalized cues share one content blob
  without merging their provenance or audit identity.
- [x] Collection skips active and pinned rollback blobs; an eligible
  unreferenced historical blob is collected only after the configured grace
  period, while its revision and audit metadata remain queryable.

## Dependencies and Boundaries

- This is the first implementation child and has no sibling dependency.
- It owns common contracts and persistence, not selection UI or provider
  fetching.
- Dandanplay is reference-only and is not a runtime dependency.
