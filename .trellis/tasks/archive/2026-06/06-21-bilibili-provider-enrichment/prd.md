# Bilibili Provider Enrichment

## Goal

Make Bilibili submissions feel like first-class media items rather than generic manual links: pasted share text should resolve automatically, 番組表 rows should show Bilibili identity and metadata, and Bilibili XML danmaku should load automatically for the current video.

## What I Already Know

- Users paste Bilibili share text that may contain arbitrary leading text before the URL.
- The existing `eisha` Bilibili parser already resolves view/playurl metadata, DASH playback URLs, and a `danmaku: { type: "fetch", ref: "bilibili:<cid>" }` reference.
- `kokuban` already parses Bilibili XML into normalized `DanmakuCue[]`.
- `Enmoku` has persisted JSON fields for `sources`, `subtitles`, `danmaku`, and `live`, but no provider metadata yet.
- `BushitsuView` owns local file danmaku state and already renders `FileDanmakuOverlay` by current playback time.

## Requirements

- Accept full Bilibili share text in the manual source field and extract the embedded Bilibili video URL automatically.
- Preserve generic direct/HLS/DASH URL behavior for non-Bilibili input.
- Extend `Enmoku` with optional provider metadata that can represent:
  - provider kind (`bilibili` for this task)
  - original canonical/external URL
  - cover image URL
  - owner/up name
  - public stats such as comments/replies, likes, coins, danmaku count, views, favorites, shares
- Persist provider metadata through housou DB, REST, and WS `BANGUMI` snapshots.
- In 番組表, render provider-aware rows for Bilibili items:
  - Bilibili icon/mark
  - video title as the row title
  - an info action that opens an in-page dialog/popover with cover, owner, external link, and stats
- Automatically fetch Bilibili danmaku for the current Enmoku when `enmoku.danmaku.type === "fetch"` and `ref` is `bilibili:<cid>`.
- Render fetched Bilibili danmaku through the existing file/timeline overlay path so playback time, pause state, size, opacity, offset, and the existing danmaku toggle still apply.
- Prefer local file danmaku over fetched danmaku when a local file exists for the current Enmoku.

## Acceptance Criteria

- [ ] Pasting `【title】 https://www.bilibili.com/video/BV.../?share_source=...` creates a playable Bilibili Enmoku.
- [ ] Generic media URLs still resolve as before.
- [ ] Bilibili Enmoku rows show a provider mark and video title in 番組表.
- [ ] Bilibili row info action opens provider metadata with cover, UP name, external URL, and numeric stats when present.
- [ ] Current Bilibili video automatically loads remote danmaku and displays it in sync with playback when file danmaku is enabled and no local file overrides it.
- [ ] Local file danmaku continues to override fetched Bilibili danmaku for the same Enmoku.
- [ ] Missing/failed remote danmaku does not break playback or the room UI.
- [ ] Provider metadata is preserved across refresh / REST `bangumi` fetch / WS `BANGUMI`.

## Definition of Done

- Tests added/updated for Bilibili share text extraction, provider metadata parsing/persistence, metadata view-model behavior, and danmaku fetch parsing path.
- `./dx bun run format`, `./dx bun run lint`, `./dx bun run typecheck`, and relevant tests pass.
- Specs/design updated if new provider metadata or fetched danmaku contracts are introduced.
- Manual test checkpoint states what needs human browser verification.

## Technical Approach

- Treat provider data as optional `Enmoku.provider`, keeping core playback contract unchanged.
- Keep Bilibili-specific fetching/parsing in `eisha`; expose fetched danmaku through an `/eisha/danmaku/:token` route returning normalized JSON cues.
- Use `kokuban`'s existing Bilibili XML parser server-side instead of duplicating XML parsing in the browser.
- Keep selected/fetched danmaku as local view state in `BushitsuView`, consistent with existing local file danmaku behavior.

## Decision (ADR-lite)

**Context**: The user wants Bilibili-specific UI and danmaku, but the player and room model should remain platform-agnostic.

**Decision**: Add a provider metadata extension and a generic fetched-danmaku route while implementing only Bilibili in this slice.

**Consequences**: The main design stays intact. Future providers can populate the same metadata/danmaku shapes, while Bilibili-specific API details stay behind `eisha`.

## Out of Scope

- Authenticated/private Bilibili resources.
- Multi-page Bilibili video page selection.
- Searching Bilibili by title.
- Broadcasting source/quality choice across clients.
- Replacing the current Vue/CSS timeline overlay with a canvas danmaku engine.
- Full provider management UI beyond the 番組表 info action.

## Technical Notes

- Relevant files inspected:
  - `packages/kousoku/src/domain.ts`
  - `packages/housou/src/db/schema.sql`
  - `packages/housou/src/db/queries/enmoku.ts`
  - `packages/housou/src/routes/bushitsu.ts`
  - `packages/eisha/src/resolver.ts`
  - `packages/eisha/src/parsers/bilibili.ts`
  - `packages/eisha/src/routes.ts`
  - `packages/kokuban/src/index.ts`
  - `packages/kyoushitsu/src/views/BushitsuView.vue`
  - `packages/kyoushitsu/src/lib/enmoku-metadata.ts`
  - `packages/kyoushitsu/src/lib/file-danmaku.ts`
- Existing design already names third-party platform danmaku as a planned source and requires media/danmaku cross-origin access to go through server-side fetchers.
