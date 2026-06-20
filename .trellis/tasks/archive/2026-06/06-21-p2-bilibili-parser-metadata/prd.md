# P2 Bilibili Parser Metadata

## Goal

Add the first site-specific parser to `houkago-eisha`: recognize Bilibili video
URLs and produce stable `Enmoku` metadata from Bilibili public video/playurl
responses. This establishes the parser plug-in path for future platforms while
keeping the slice small enough to verify.

## Requirements

* Detect public Bilibili video URLs from common host/path forms such as
  `https://www.bilibili.com/video/BV...`.
* Extract a BVID from the URL and fetch Bilibili view metadata.
* Use the selected `cid` from the view response, then fetch Bilibili playurl
  metadata.
* Return an `Enmoku`-compatible result with:
  * `title` from Bilibili view metadata;
  * `type: "dash"` when DASH playurl metadata is available;
  * `url` as a stable eisha proxy URL for the selected primary video stream;
  * `sources[]` derived from DASH video streams and wrapped in eisha proxy URLs;
  * Bilibili-appropriate `headers` for proxied media requests;
  * `danmaku: { type: "fetch", ref: "bilibili:<cid>" }`.
* Preserve the existing generic direct/HLS/DASH URL resolver behavior for
  non-Bilibili URLs.
* Keep all network calls injectable for tests.

## Acceptance Criteria

* [ ] Bilibili URL parsing accepts common BV URL forms and rejects non-Bilibili
      URLs.
* [ ] Bilibili parser maps fixture `view` + `playurl` JSON into a stable
      `ResolvedEnmokuSource`.
* [ ] Decoded proxy refs for Bilibili media include the selected CDN URL and the
      Bilibili media headers.
* [ ] `resolveUrlWithMetadata` dispatches Bilibili URLs to the Bilibili parser
      and leaves generic URLs unchanged.
* [ ] Housou resolver-body create persists Bilibili parser metadata through
      create response and `GET /bangumi`.
* [ ] Lint, type-check, and tests pass.

## Definition of Done

* Unit tests cover URL parsing, parser response mapping, and resolver dispatch.
* Housou REST test covers persisted Bilibili `sources` and `danmaku` metadata.
* `design.md` and backend spec note the Bilibili parser scope and limitations.
* Rollback is easy: remove the Bilibili parser dispatch and leave generic
  resolver behavior intact.

## Technical Approach

Implement `packages/eisha/src/parsers/bilibili.ts` with an injectable fetcher.
The parser should:

1. Extract `bvid`.
2. Fetch `https://api.bilibili.com/x/web-interface/view?bvid=<bvid>`.
3. Select `cid` from explicit URL page query when later supported, otherwise
   use `view.data.cid` / first page.
4. Fetch `https://api.bilibili.com/x/player/playurl?bvid=<bvid>&cid=<cid>&fnval=16&qn=64&fourk=1`.
5. Map `dash.video[]` entries into eisha proxy `sources`.

`resolveUrlWithMetadata` should check Bilibili first, then fall back to existing
generic HLS metadata behavior.

## Decision (ADR-lite)

**Context**: The backlog asks for the first platform parser, but full Bilibili
support includes cookies, WBI signing, multi-part videos, subtitles, DASH
audio/video composition, and danmaku fetching.

**Decision**: This task implements a metadata-only public Bilibili parser
skeleton. It returns stable proxy-wrapped video sources and a danmaku fetch ref,
but does not build a synthetic MPD or frontend DASH composition.

**Consequences**: The project gets a real platform parser seam and persisted
metadata, while playback completeness remains a future DASH/frontend task.

## Out of Scope

* Login-only, VIP, paid, region-restricted, or cookie-required Bilibili content.
* WBI signing.
* Multi-page episode selection UI.
* Synthetic MPD generation or audio/video merging.
* Remote danmaku fetch route and frontend remote danmaku playback.
* Browser search/browse UI.

## Research References

* [`research/bilibili-public-endpoints.md`](research/bilibili-public-endpoints.md)
  — public endpoint probe and recommended MVP approach.

## Technical Notes

* Existing eisha files:
  * `packages/eisha/src/resolver.ts`
  * `packages/eisha/src/proxy.ts`
  * `packages/eisha/src/parsers/hls.ts`
* Existing kokuban Bilibili XML parser:
  * `packages/kokuban/src/index.ts`
* Existing housou metadata persistence path:
  * `packages/housou/src/routes/bushitsu.ts`
  * `packages/housou/test/rest.test.ts`
