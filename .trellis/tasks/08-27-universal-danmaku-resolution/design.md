# Design: universal danmaku source resolution

## Scope and invariants

This parent design establishes the shared architecture and integration contract
for four implementation children. The parent has no direct product-code slice.

- `Enmoku` remains a room-scoped playable item; it is not canonical episode
  identity.
- A media release, canonical episode, logical danmaku track, and immutable track
  revision are separate records.
- `Komon` is a deployment-wide, multi-holder role and never becomes a
  `Yakuwari`; `Buchou` authority remains room-scoped.
- Exactly one timeline track is active per viewer. Realtime room `DANMAKU`
  remains a separate overlay.
- Media bytes, provider credentials, private paths, fsids, dlinks, and adaptor
  tokens never enter the pool or shared room state.
- Resolver, pool, matcher, refresh, or UI failure never blocks playback.

## Ownership and data flow

```text
provider/local adapter
  -> typed release evidence
  -> housou identity + candidate resolver
  -> policy order + room default
  -> viewer-local override
  -> one normalized DanmakuCue[]
  -> existing timeline overlay

provider official fetch
  -> eisha network boundary
  -> kokuban parser/canonicalizer
  -> housou content-addressed pool + immutable revision
```

- `houkago-kousoku` owns provider-neutral wire/domain schemas and additive
  compatibility types.
- `houkago-kokuban` owns pure parsing, cue normalization/canonicalization,
  filename evidence normalization, and explainable candidate scoring. It owns
  neither SQLite nor authority.
- `houkago-eisha` owns provider requests, headers, upstream errors, and official
  feed acquisition. It does not decide trust or room selection.
- `houkago-housou` owns durable identities, pool lifecycle, policy, trust,
  proposals, `Komon` authorization, room defaults, and candidate APIs.
- `houkago-kyoushitsu` owns viewer-local overrides and a dedicated
  `useTimelineDanmaku` orchestration boundary. `BushitsuView` composes it but
  does not contain provider checks or source-priority logic.
- `EnmokuPlayer` and the existing timeline/realtime overlays retain their
  current lifecycle and clock responsibilities.

## Durable model

The identity/storage child will add additive SQLite tables behind typed query
modules. Exact column spelling may be refined in its code-spec, but these
relationships are fixed:

| Record | Required meaning |
| --- | --- |
| `komon` | active/revoked site role grant for one `seito`, with grant audit |
| `danmaku_episode` | provider-neutral work/season/episode identity |
| `media_release` | concrete provider/file/encode identity, with safe display metadata |
| `media_release_evidence` | typed algorithm/scope/value observations and provenance |
| `release_episode_match` | personal, room, or global association and its authority |
| `danmaku_track` | stable logical candidate with episode, source class, provenance, status, and active revision |
| `danmaku_content` | canonical cue payload addressed by SHA-256 |
| `danmaku_revision` | immutable fetch/import event pointing at a content hash/blob when retained |
| `danmaku_alignment` | release-specific offset/cut calibration without mutating the track |
| `danmaku_proposal` | opt-in sanitized suggestion and review disposition |
| `danmaku_audit` | append-only promotion, decision, disable, rollback, and collection events |
| `danmaku_source_policy` | singleton allowed classes and deterministic default order |
| `enmoku_danmaku_default` | owner-selected logical track for one room-scoped `Enmoku` |

IDs remain application-generated strings and timestamps remain server epoch-ms.
Queries use prepared statements and map rows at the DB boundary. Multi-record
promotion, revision activation, and room-default changes are transactional.

Canonical episode records are curated server knowledge. Authenticated users may
search existing records and propose corrections or a new episode description;
only a `Komon` may create/merge canonical identity as part of approval.

## Komon bootstrap and authority

`HOUKAGO_KOMON_USERNAMES` is an explicit, comma-separated deployment bootstrap
input. On startup every configured normalized username must already resolve to
exactly one `Seito`; otherwise startup fails with an actionable instruction.
Valid configured accounts receive an idempotent grant and audit event. Removing
the environment entry does not silently revoke an existing grant.

`requireKomon()` resolves the existing HttpOnly `Seitoshou`, checks an active
site grant, and is used at the route/service boundary. It does not require room
membership or live presence. Only `Komon` may change global source policy,
approve/reject/merge proposals, promote global matches, curate canonical
episodes/static tracks, or disable/rollback provider revisions.

## Evidence, matching, and trust

Every digest is represented by algorithm, semantic scope, byte count/range, and
value. The Dandanplay-compatible MD5 of the first 16 MiB is one supported
release fingerprint. It is not comparable to a whole-file or provider digest
and is never canonical episode identity.

Evidence tiers are deterministic and explainable:

1. A still-valid `Komon`-approved exact fingerprint/provider mapping may resolve
   automatically.
2. Filename parsing, size, duration, provider metadata, and unpromoted
   third-party assertions rank candidates and expose their reasons.
3. Every unseen weighted match requires explicit confirmation; no score alone
   creates global knowledge.
4. No correct candidate enters manual search/correction and optional proposal.

Trust scopes remain separate: a personal confirmation is private to its
account, a `Buchou` may establish only the current room/Enmoku default, and a
`Komon` promotion alone creates reusable global matcher knowledge.

## Content revisions, refresh, deduplication, and GC

`kokuban` canonicalizes normalized cues into a versioned, stable JSON encoding.
`housou` computes SHA-256 over those bytes and verifies byte equality before
reusing an existing `danmaku_content` row. Equal content may share one blob, but
logical tracks, revisions, provenance, and audits remain distinct.

Provider-official tracks use stale-while-revalidate on bounded use/freshness
triggers:

- a fresh valid revision is served immediately;
- a stale valid revision is still served while one coalesced refresh runs;
- unchanged canonical content reuses the current revision/content;
- changed content creates an immutable revision and atomically advances the
  logical track;
- refresh failure records a safe attempt result and leaves the last valid
  revision active;
- no bulk crawler or browser-to-provider fetch is introduced.

Content collection is disabled unless a grace interval is explicitly
configured. A bounded purge, following the existing on-operation cleanup
pattern, may remove only unreferenced historical content older than the grace
period. Active content and explicitly pinned rollback points are always
protected. Revision hash, provenance, decisions, and audit metadata remain even
after an eligible blob is collected.

## Selection and room state

The initial default source order is the user-approved order:

```text
server-stored -> provider-official -> local -> third-party
```

A `Komon` may change the allowed classes and order. Resolution precedence is:

```text
valid viewer override
  -> valid persisted room/Enmoku default
  -> first usable policy-ranked candidate
  -> no timeline track
```

The server returns candidate summaries and the room default; the browser adds
its current local-file candidate and applies the viewer override from a
versioned localStorage record keyed by stable release identity. Local files are
viewer-only and cannot become a room default or public proposal unless a future
explicit upload/import flow places them in the server pool.

The `Buchou` default follows a logical track's current valid revision. A
disabled, removed, failed, or inaccessible candidate falls through without
rewriting the stored preference. Server writes precede a room-targeted
authoritative selection snapshot; clients do not optimistically mutate room
truth.

## API and protocol shape

All state-changing routes require trusted Origin plus `Seitoshou`; room
operations retain admission/owner checks.

- Candidate resolution/read API accepts an `Enmoku` or safe release reference
  and returns typed candidates, evidence explanations, availability, source
  class, logical track/revision identity, alignment, and room default.
- Owner default API sets/clears one eligible logical track for an `Enmoku` and
  publishes a room-targeted full selection snapshot.
- Personal confirmation and proposal APIs are distinct. Selecting a candidate
  never submits a proposal.
- `Komon` APIs cover source policy, canonical identity, proposal decisions,
  promotion, track disable, revision pin, and rollback.
- Baidu matching derives existing server-safe metadata from the authenticated
  source. An optional client/adaptor fingerprint adds only its labelled digest;
  it never sends paths, fsid, dlinks, credentials, or media bytes.

The old `Enmoku.danmaku { type, ref }` remains readable throughout rollout. New
APIs are additive; the source-migration child removes the frontend's
Bilibili-specific branch only after the common path passes regression tests.

## Interaction design

The source selector is progressive disclosure adjacent to the existing danmaku
controls, not a new visual theme or a blocking playback modal. It reuses the
warm-club semantic tokens and existing timeline overlay.

- The collapsed control shows active source class/name and state.
- The panel lists one selected candidate plus alternatives with text provenance,
  compatibility/evidence summary, loading, unavailable, disabled, empty, and
  retry states. State is never communicated by color alone.
- Selecting a personal override and setting a room default are visibly distinct
  actions. Proposal submission is a third explicit, confirmed action.
- Only `Buchou` sees room-default controls; only `Komon` sees global governance
  actions. Ordinary viewers can always understand why an action is unavailable.
- Buttons use semantic elements, visible focus, at least 44px targets, and
  accessible live feedback. The panel is keyboard operable, fits 375px without
  horizontal scroll, preserves player space, and does not depend on hover.
- Loading beyond 300ms is visible, errors include recovery, and switching cues
  does not remount `EnmokuPlayer` or reset playback/fullscreen.

The UUPM search suggested a generic vibrant/video-first restyle. This design
intentionally takes only its interaction, responsive, feedback, and
accessibility guidance; replacing Houkago's established visual system is out of
scope.

## Compatibility, rollout, and rollback

1. Add `Komon`, identity, pool, policy, and audit tables without changing
   `enmoku.danmaku_json` or `baidu_source`.
2. Read the common pool first but retain legacy `Enmoku.danmaku` fallback.
3. Lazily ingest Bilibili official tracks and expose local files through the
   common client candidate shape.
4. Switch the UI to common orchestration, then add Baidu evidence/matching.
5. Enable content GC only by explicit operator configuration after revision
   and rollback behavior is verified.

Rollback disables the new resolver/UI and restores legacy reads; additive
tables remain harmless. Never roll back by promoting filename matches,
discarding audit/provenance, fetching media through `housou`, or broadening
provider credential exposure.

## Risks and deferred work

- Existing Bilibili duration is not in the public provider model; add it only
  as safe typed evidence when required.
- Local input currently means Bilibili XML-subset parsing, not generic XML or
  ASS. Additional formats need separate parsers.
- A collected historical blob cannot be replayed unless refetched/imported;
  its identity and audit remain queryable.
- Third-party source class is policy-ready but has no runtime connector in this
  deliverable.
- Community voting/reputation, automatic promotion, arbitrary multi-track
  merge, bulk crawling/import, and a general media catalogue remain deferred.

