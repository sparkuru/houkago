# Dandanplay matching reference

## Primary-source findings

The official Dandanplay open-network guide describes the client flow as:

1. Call `/api/v2/match` with the video filename, hash, duration, and size.
2. Treat the result as a list of possible programmes and let the user choose the
   best candidate.
3. Persist the association between that video file and the returned
   `episodeId`.
4. Fall back to `/api/v2/search` and manual matching when the correct programme
   is absent.
5. Fetch comments by `episodeId`, optionally including related third-party
   sources.

The documented file hash is MD5 over the first 16 MiB, not a whole-file hash.
The guide states that one `episodeId` may relate to many videos while one video
relates to one `episodeId`.

Source: [Dandanplay open danmaku network guide](https://doc.dandanplay.com/open/),
client flow and API-use sections, last updated 2026-07-20 when inspected on
2026-08-27.

The same guide requires an application identity, recommends caching, prohibits
large-scale database scraping/bulk downloading, and says API data must not be
used commercially without authorization. A Houkago connector would therefore
need deployment configuration, bounded user-triggered access, caching, and
clear provenance rather than treating Dandanplay as a database replication
source.

## Implications for Houkago

- A content hash identifies a particular release/file. Different subtitle-group
  encodes of the same episode normally have different hashes, so hashing alone
  cannot provide cross-release reuse.
- The durable reusable fact is a reviewed association from a release
  fingerprint/provider reference to a provider-neutral episode identity.
- Filename parsing, size, duration, provider metadata, and third-party results
  are evidence for candidate ranking. They are not independent proof of an
  exact episode match.
- Matching output should be explainable and tiered (`confirmed`, `suggested`,
  `ambiguous`, `none`) instead of exposing an opaque score as certainty.
- Manual correction is a first-class path, not an exceptional failure path.
- A user's personal selection, a room owner's default, and promotion into the
  server-wide reusable mapping pool are separate trust decisions.

## Approved scope decision

Dandanplay is a reference implementation only for this task. Houkago will learn
from its published fingerprint/candidate/manual-correction flow, but the first
deliverable will not integrate Dandanplay APIs, credentials, identifiers, or
runtime availability. Any future connector would require a separate scoped
decision and task.

## Current Baidu boundary

The current Houkago Baidu room-safe provider metadata exposes `sourceId`,
`fileName`, optional display owner, and optional size. The current Baidu parser
does not expose a compatible content fingerprint or media duration.

If Houkago later adopts the Dandanplay-compatible first-16-MiB fingerprint, it
must be computed by an authorized client/adaptor using a bounded Range request.
The Houkago server must not fetch media bytes merely to hash them because the
mainline requires media bytes to stay off the server data plane. Any provider
hash must carry an explicit algorithm/semantic label; a provider-supplied
whole-file digest must never be compared as if it were the Dandanplay partial
MD5.
