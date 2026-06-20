# Bilibili Public Endpoint Probe

## Scope

This note records the minimum public endpoint behavior needed for the first
`houkago-eisha` Bilibili parser slice. It is intentionally narrow: public,
non-login video pages only, with fetcher injection in tests so the parser does
not depend on live network stability.

## Probe

Commands run on 2026-06-21:

```bash
curl -L --max-time 10 -sS 'https://api.bilibili.com/x/web-interface/view?bvid=BV1xx411c7mD'
curl -L --max-time 10 -sS 'https://api.bilibili.com/x/player/playurl?bvid=BV1xx411c7mD&cid=62131&fnval=16&qn=64&fourk=1'
curl -L --max-time 10 -sS 'https://api.bilibili.com/x/player/pagelist?bvid=BV1xx411c7mD'
```

Observed:

* `x/web-interface/view` returned `code: 0`, `data.title`, `data.bvid`,
  `data.aid`, top-level `data.cid`, `data.pages[]`, and `data.subtitle.list`.
* `x/player/playurl` returned `code: 0`, `data.dash.video[]`,
  `data.dash.audio[]`, `data.support_formats[]`, signed CDN `baseUrl` /
  `base_url` fields, and `backupUrl` / `backup_url` arrays.
* `x/player/pagelist` returned `code: 0` with page-level `cid` records.
* A concurrent `x/v1/dm/list.so?oid=62131` probe hit transient DNS failure in
  this environment, so this task should not rely on live network in tests. The
  existing `houkago-kokuban.parseBilibiliXml` already covers Bilibili XML cue
  parsing once a fetch source is available.

## Repo Constraints

* `houkago-eisha` owns media-plane parsing and proxy wrapping.
* `houkago-housou` only calls `resolveUrlWithMetadata` from REST create and
  persists returned `Enmoku` metadata.
* `Enmoku.danmaku` is currently a reference only:
  `{ type: "file" | "fetch"; ref: string }`. No server-side remote danmaku
  fetch route exists yet.
* The frontend player currently handles a single playable `url`; DASH
  separate audio/video stream merging is not implemented.

## Feasible Approaches

### Approach A: Metadata-only Bilibili parser skeleton

Parse Bilibili URLs, call `view`, call `playurl`, and return:

* `title` from `view.data.title`
* `type: "dash"` for DASH playurl responses
* `url` as a stable proxy URL for the selected primary video stream
* `sources[]` from DASH video qualities, each proxied
* `headers` containing a Bilibili referer/user-agent style hint
* `danmaku: { type: "fetch", ref: "bilibili:<cid>" }`

Pros: small, testable, establishes parser plug-in shape and metadata flow.
Cons: actual playback may still need future frontend DASH/audio support.

### Approach B: Generate a synthetic MPD

Build a small DASH MPD from Bilibili `dash.video[]` and `dash.audio[]`, proxy it,
and point `Enmoku.url` at that MPD.

Pros: closer to real playback.
Cons: more media-container work, bigger proxy surface, higher risk.

### Approach C: Direct first-video fallback only

Return only the first `dash.video[].baseUrl` as a proxied direct URL.

Pros: smallest code.
Cons: loses audio for DASH streams and does not produce the richer metadata this
P2 slice is meant to unlock.

## Recommendation

Use Approach A for this task. It creates the platform parser seam and stores real
Bilibili-derived metadata without pretending DASH playback is solved.
