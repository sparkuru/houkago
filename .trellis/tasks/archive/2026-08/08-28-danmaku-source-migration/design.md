# Design: migrate Bilibili and local danmaku sources

## Bilibili official track

The existing `bilibili:<cid>` reference remains provider evidence, not canonical
episode identity. On first eligible use, `housou` requests the feed through the
existing `eisha` boundary, parses it with `kokuban`, canonicalizes cues, and
ingests a provider-official logical track/revision into the pool.

Serve the latest valid stored revision immediately. When its freshness window
is exceeded, coalesce one use-triggered refresh per logical track. Equal
canonical content creates no revision; changed content creates and activates an
immutable revision; failure records safe state and preserves the last valid
content. No bulk crawl or browser upstream fetch is added.

Bilibili provider metadata and `cid` establish provenance. They do not silently
create provider-neutral episode identity; candidate confirmation/Komon promotion
still governs that association.

## Local candidate

Move current file selection/parsing out of `BushitsuView` into the common
timeline orchestration adapter. MVP local files remain viewer-memory-only and
use the existing Bilibili XML-subset parser. Filename, parse result, and cue
count form a personal candidate; empty/invalid content is unavailable and must
not suppress a usable server/official candidate.

Local content is not uploaded, proposed, made a room default, or retained after
reload. ASS and other XML dialects remain out of scope.

## Migration and compatibility

- Preserve `Enmoku.danmaku` reads while adding lazy pool ingestion.
- Replace the page-level `ref.startsWith("bilibili:")` guard with the common
  candidate/provider boundary.
- Replace the hard-coded local-name-over-fetched rule with hybrid selection.
- Keep the same `DanmakuCue[]`, player clock, overlay clipping, speed, offset,
  fullscreen behavior, and separate realtime stream.

## Governance

A `Komon` may disable a bad official revision, pin a rollback point, or activate
an older valid revision. Room defaults target the logical track and therefore
follow its active valid revision without rewriting room state.

