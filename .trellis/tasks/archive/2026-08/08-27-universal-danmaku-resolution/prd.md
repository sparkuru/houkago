# Universal danmaku source resolution

## Goal

Create a provider-neutral danmaku resolution capability that identifies the
underlying work/season/episode independently from the playable video source,
then resolves, ranks, stores, and lets users select compatible timeline danmaku
tracks. Different encodes or subtitle-group releases of the same episode should
be able to reuse one correct danmaku track whether the video came from Baidu
Netdisk, a local file, Bilibili, or a future provider.

## Confirmed Product Intent

- Danmaku matching is a common media capability, not a Baidu-only filename
  special case.
- Video-source identity, content/episode identity, and danmaku-source identity
  must remain distinct.
- Resolution must support an adjustable source strategy covering at least:
  server-stored tracks, provider-official tracks, local tracks, and third-party
  tracks.
- Houkago must provide a server-side storage-pool mechanism for reusable
  danmaku tracks and their matching metadata.
- Users must be able to inspect and override the automatically selected source.
- Provider integrations must feed the common resolver rather than implement
  separate player-side matching pipelines.
- Selection ownership uses a hybrid model: deployment policy controls allowed
  source classes and their default order; the room owner can persist one
  room/Enmoku default; each viewer may apply a personal override that affects
  only that viewer.
- The site-wide governance role is `Komon` (顧問). Multiple accounts may hold
  it, and it is independent from the room-scoped `Buchou` role. A `Buchou`
  gains no site-wide authority merely by owning a room.
- Initial `Komon` accounts are granted explicitly by deployment configuration;
  the first registered account must never be promoted automatically.
- Trust promotion is tiered for the first release: a viewer confirmation remains
  personal, an owner confirmation may become the room/Enmoku default, and only
  a `Komon` approval creates or promotes a server-wide trusted
  release-to-episode association. Community reputation/voting may propose later
  promotion but is not an MVP trust authority.
- Users may explicitly submit a personal or room-confirmed release-to-episode
  association as a public matching proposal. Submission is opt-in and never an
  automatic side effect of selecting a track. A `Komon` may review, approve,
  reject, or merge proposals; only approval promotes global matcher knowledge.
- Dandanplay is an approved design reference for file evidence, candidate
  episode matching, manual correction, persisted file-to-episode associations,
  and bounded caching. Houkago must preserve its own provider-neutral model and
  security/data-plane boundaries rather than copying Dandanplay internals.
- Dandanplay is reference-only for this task. The first deliverable must not
  call its APIs, require its AppId/AppSecret, use its `episodeId` as Houkago's
  canonical identity, or depend on its availability.
- Automatic adoption is limited to a still-valid exact fingerprint or provider
  mapping that has already been promoted into the `Komon`-approved
  server-wide trust scope. Filename parsing, size, duration, weighted scoring,
  and unpromoted third-party assertions may rank candidates but must not create,
  persist, or silently adopt a global episode association.
- The first release activates exactly one historical/timeline danmaku track per
  viewer at a time. Source strategy ranks and falls through candidates; users
  may switch the active track. Realtime room `DANMAKU` remains a separate
  always-independent overlay stream.
- Provider-official tracks use versioned automatic refresh. A stable logical
  track points to immutable content revisions; a refresh creates a new revision
  only when normalized content changes. Room defaults follow the latest valid
  revision, while a `Komon` may disable or roll back a bad revision. Local
  uploads and `Komon`-maintained static tracks do not auto-refresh.
- The pool deduplicates canonical normalized cue content by content hash while
  retaining distinct logical tracks, revisions, provenance, and audit records.
  Metadata remains durable. The current valid content and every explicitly
  pinned rollback point are protected from automatic collection; only
  unreferenced historical content blobs may be collected after a configurable
  grace period.

## Confirmed Repository Facts

- `Enmoku` currently carries at most one optional danmaku reference with
  `{ type: "file" | "fetch", ref }`; it cannot describe a candidate set,
  provenance, confidence, or a selected/default track.
- `houkago-kokuban` currently owns framework-free Bilibili XML parsing into the
  normalized cue type. It has no storage-pool, matching, candidate-resolution,
  or source-lifecycle implementation yet.
- Remote fetching currently recognizes only `bilibili:<cid>` and runs through
  `eisha`; the room view also contains a Bilibili-specific guard.
- The room view keeps local and fetched cue maps separately, then hard-codes
  local filename presence as the winner. Adding a third source or policy there
  would violate the existing project boundary and should first move into a
  dedicated timeline-danmaku orchestration layer.
- The existing local-file danmaku enabled preference is viewer-local
  `localStorage`. In contrast, owner-governed room policy is persisted on the
  server and broadcast as server truth. The repository therefore has evidence
  for both personal presentation state and durable room defaults, but no
  existing decision for danmaku source ownership.
- Realtime room `DANMAKU` and timeline file/fetched cues already use separate
  state and rendering paths.
- The original design assigns danmaku parsing, third-party fetching, matching,
  and caching to `kokuban`, which may initially co-deploy with `eisha`; browsers
  should not fetch upstream danmaku providers directly.
- The current product supports local danmaku-file selection, but it does not
  have a local-video playback provider. Treating local video as operational in
  the first deliverable would add a separate media-source capability beyond the
  danmaku system.
- The current account/domain model has room-scoped `buchou`, `buin`, and
  `kengaku` roles only. It has no deployment-wide `Komon` role or authorization
  route yet. A room owner must not be treated as a server-wide proposal reviewer
  merely because they own one room.
- Dandanplay's documented matching flow uses filename, MD5 of the first 16 MiB,
  duration, and file size to return candidate episodes; the user chooses the
  correct candidate and the client persists the file-to-episode association.
  Hashing is therefore evidence for a specific release, not a universal
  cross-release episode identifier.
- The current Baidu provider exposes filename and optional size to room-safe
  state, but no compatible partial-content hash or media duration. A compatible
  partial hash would need an authorized client/adaptor Range read; the Houkago
  server must not pull media bytes solely to fingerprint a file.
- A Bilibili `cid` identifies an upstream danmaku feed, but the current domain
  model does not establish it as a provider-neutral work/season/episode
  identity.

## Requirements

- Model a provider-neutral content identity that can associate multiple video
  sources/releases with the same work, season, episode, or other bounded media
  unit.
- Discover zero or more danmaku candidates from enabled source categories and
  preserve each candidate's provenance.
- Apply a configurable, deterministic source-selection strategy without making
  playback depend on danmaku availability.
- Allow an eligible user to choose a different candidate from the discovered
  set.
- Keep room-default and viewer-override state distinct. A viewer override must
  never mutate, broadcast as, or silently replace the owner-managed room
  default.
- New viewers use the current persisted room default unless they already have
  an applicable personal override; clearing an override returns to the room
  default.
- Only the room owner may change the persisted room default. Ordinary viewers
  may select personal overrides from candidates permitted by deployment policy.
- Store reusable normalized timeline tracks in a server-side pool with enough
  provenance and matching metadata to audit, invalidate, refresh, or rematch
  them safely.
- Make content-blob collection opt-in and operationally configurable. Collection
  must never erase track, revision, provenance, proposal, promotion, or audit
  metadata, and must skip active or explicitly pinned rollback content.
- Refresh provider-official tracks on bounded freshness/use triggers without
  bulk crawling. Preserve revision provenance and make upstream refresh failure
  fall back to the latest still-valid stored revision.
- Preserve local-file, provider-official, server-pool, and third-party sources
  as distinguishable source classes even when they normalize to one playback
  cue format.
- Keep inactive candidates available for inspection and selection without
  merging their cues into the active timeline track.
- Let Baidu, local-file, Bilibili, and future providers contribute media
  identity hints without leaking private provider credentials, download URLs,
  or unnecessary private path information.
- Account for release differences such as filename noise, duration mismatch,
  cuts, intros, and timing offsets without treating a filename match as proof
  of exact compatibility.
- Represent matching evidence explicitly, including the algorithm and semantic
  type of any hash, parsed filename fields, duration/size observations,
  provider references, third-party assertions, and manual confirmations.
- Persist reviewed release-to-episode associations so later encounters with the
  same release can resolve deterministically while other encodes may still
  produce candidates.
- Keep trust scope on every confirmation and promotion. Personal and room
  decisions must not silently become server-wide matcher knowledge.
- Store proposal status, sanitized evidence, submitter identity, reviewer,
  timestamps, disposition, and audit history. Proposals must omit provider
  credentials, private paths, dlinks, raw private identifiers, and media bytes.
- Provide manual search/correction whenever no candidate is correct; automatic
  discovery is not allowed to make an incorrect association irreversible.
- Return explainable candidate evidence and require an explicit user decision
  for every new algorithmic match, even when its score is high. A high score may
  order or visually recommend a candidate but is not an exact-match authority.
- Preserve the existing separation between realtime room `DANMAKU` messages
  and timeline/file/fetched danmaku.
- A failed matcher, source fetch, parser, or storage-pool lookup must degrade to
  another candidate or no timeline danmaku; it must not block video playback,
  room entry, source switching, or realtime chat/danmaku.
- Existing Bilibili, Baidu, direct URL, HLS/DASH, and local-file playback must
  remain usable when the new capability is absent, disabled, or fails.

## Approved First-Deliverable Task Map

This task is the parent requirements and integration-review task. It has no
direct product-code implementation. The approved operational scope is split
into four independently verifiable children:

1. `08-28-danmaku-identity-pool`: provider-neutral episode/release/track
   identity, evidence, trust promotion, persistence, and storage-pool lifecycle.
2. `08-28-danmaku-hybrid-selection`: deployment source order, owner-managed
   room/Enmoku default, viewer override, and single-track timeline
   orchestration.
3. `08-28-danmaku-source-migration`: Bilibili official danmaku ingestion into
   the common pool and existing local danmaku files as personal candidates.
4. `08-28-baidu-danmaku-matching`: Baidu filename/size/duration/optional bounded
   fingerprint evidence, candidate confirmation, `Komon` promotion, and
   reuse of the episode's selected track.

Dependency order is identity/storage pool first; hybrid selection and source
migration may follow that shared contract; Baidu matching additionally depends
on the reusable episode/track path established by the pool and source
migration. The parent closes only after cross-child integration acceptance.

## Constraints

- Keep provider parsing and upstream behavior outside view components and the
  player instance.
- Do not turn Houkago into a media-byte proxy or expose provider credentials in
  room state.
- Treat user-provided filenames and provider display metadata as matching hints,
  not authoritative content identity.
- Never compare digests with different algorithms or byte-range semantics as if
  they represented the same fingerprint.
- The storage pool must retain provenance and must not silently present
  third-party data as provider-official data.
- Planning must define the ownership and precedence of server policy, room
  defaults, and per-user selection before implementation.
- Selection precedence is: valid viewer override > valid room/Enmoku default >
  deterministic deployment strategy result > no timeline track. Invalid,
  disabled, removed, or failed candidates fall through without rewriting the
  higher-level preference as if the user had chosen something else.

## Acceptance Criteria

- [ ] The same normalized episode identity can associate playable sources from
  at least two different provider/source classes with a reusable danmaku track.
- [ ] Candidate resolution distinguishes server-stored, provider-official,
  local, and third-party provenance and applies a deterministic configured
  order.
- [ ] A user can see the selected source and available candidates, then select
  another eligible candidate without changing the video source.
- [ ] The owner can persist a room/Enmoku default candidate; a viewer can
  override it locally without changing what other viewers receive.
- [ ] A new viewer receives the room default, while clearing a personal
  override returns that viewer to the room default.
- [ ] A selected candidate is normalized into the existing timeline playback
  path and remains separate from realtime room `DANMAKU` messages.
- [ ] At most one historical/timeline candidate is active for a viewer; changing
  it replaces the active timeline cues rather than merging candidate contents,
  while realtime room danmaku continues to overlay.
- [ ] Server-pool reuse, invalidation, and refresh behavior is observable and
  covered by tests without relying on real third-party credentials.
- [ ] Equal canonical normalized content shares one stored content blob even
  when referenced by distinct provenance-bearing revisions; collecting an
  eligible unreferenced historical blob preserves its revision and audit
  metadata and never collects active or pinned rollback content.
- [ ] An unchanged provider refresh reuses the current revision; changed
  normalized content creates a new immutable revision; refresh failure keeps the
  latest valid revision usable; `Komon` rollback changes the active
  revision without deleting audit history.
- [ ] Ambiguous or low-confidence matching does not silently attach a track as
  an exact match.
- [ ] A confirmed release fingerprint resolves deterministically on reuse,
  while a different encode of the same episode is allowed to require filename,
  metadata, third-party, or manual evidence before sharing the episode track.
- [ ] A previously `Komon`-approved exact mapping may auto-select; an
  unseen release with only filename/size/duration/weighted evidence always
  presents candidates and records no global association without confirmation
  and promotion.
- [ ] Users can correct a wrong or missing candidate without deleting or
  rewriting the underlying danmaku track.
- [ ] A viewer confirmation affects only that viewer, an owner can establish the
  room/Enmoku default, and only an audited `Komon` action can promote a
  release-to-episode association into the server-wide trusted pool.
- [ ] A user can explicitly submit a sanitized proposal; a `Komon` can
  approve, reject, or merge it; repeated personal/room selection alone creates
  no proposal and no global mapping.
- [ ] Source failure falls through safely or produces no timeline track without
  interrupting playback.
- [ ] Existing provider and local-file behavior remains covered by regression
  tests.

## Likely Out of Scope for the First Deliverable

- Building a general media catalogue, recommendation engine, or provider
  browsing/search product.
- Editing or moderating individual danmaku comments.
- Community voting, reputation scoring, or automatic proposal promotion.
- Merging arbitrary candidate tracks into a new synthetic track unless a later
  product decision explicitly includes it.
- Solving every release-cut mismatch automatically without user confirmation or
  calibration evidence.
- A runtime Dandanplay connector, Dandanplay credentials, bulk data import, or
  any dependency on Dandanplay service availability. Its documented successful
  matching flow remains research/design evidence only.

## Notes

- This is a complex task and requires `design.md` and `implement.md` before any
  child implementation task can start.
- Repository evidence inspected during planning includes
  `packages/kousoku/src/domain.ts`, `packages/eisha/src/danmaku.ts`,
  `packages/kokuban/src/index.ts`,
  `packages/kyoushitsu/src/views/BushitsuView.vue`, the frontend state/component
  specs, the original `design.md`, and archived P1/Bilibili danmaku tasks.
- Dandanplay matching research is recorded in
  `research/dandanplay-matching.md`.
