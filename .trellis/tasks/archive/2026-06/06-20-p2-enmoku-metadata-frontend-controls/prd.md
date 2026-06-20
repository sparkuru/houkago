# P2 Enmoku Metadata Frontend Controls

## Goal

让刚由 `houkago-eisha` 解析并由 `houkago-housou` 持久化的 `Enmoku.sources/subtitles/live` 在前端变得可见、可验证，并先提供最小的 HLS 多源选择入口。这样 dev 手填 m3u8 后，用户能看到 parser 产物，不再只能在数据库/API 里确认 metadata。

## What I Already Know

* `Enmoku` 已包含 `headers/subtitles/sources/danmaku/live`，并能从 resolver create 持久化到 `BANGUMI`。
* Generic HLS parser 已能产出 `sources`、`subtitles` 和 media playlist 的 `live`。
* `BushitsuView.vue` 当前只把 `current.url/current.type` 传给 `EnmokuPlayer`，未消费 `current.sources/current.subtitles/current.live`。
* `EnmokuPlayer.vue` 只接受 `url` 和 `type`，且内部按 `url/type` 创建 ArtPlayer/Hls 实例。
* 番組表和当前演目是 server-authoritative；清晰度选择目前没有协议字段，不能假装它是房间权威状态。
* 前端已有 `bangumi-actions`、`enmoku-resolve` 等纯函数测试模式，适合新增 metadata 辅助函数测试。

## Assumptions

* 本任务只做“可见 + 本地可切换”，不把清晰度选择广播给其他部员。
* `sources` 里的 URL 已经是 eisha proxy URL；前端只消费，不自行解析 token。
* 当前演目切换、JOIN/catch-up、SHINKOU 权威仍以原始 `Enmoku.id` 为准；source selection 是本地播放器 URL 选择。
* 字幕 metadata 先展示数量/名称，不接 ArtPlayer subtitle track；完整字幕/音轨 UI 后续独立切片。

## Requirements

* 新增前端纯 helper，用共享 `Enmoku` 类型派生：
  * 当前可播放 URL：默认 `enmoku.url`；若用户选中 source index 且存在 `sources[index]`，使用该 source URL。
  * metadata 摘要：sources 数、subtitles 名称、live 状态。
  * source label fallback：若 parser 没给 name，则显示稳定 fallback。
* `BushitsuView` 当前演目区域显示 metadata：
  * 有 `sources` 时显示清晰度/来源选择控件。
  * 有 `subtitles` 时显示字幕名称列表或数量。
  * `live === true/false` 时显示直播/点播状态；缺失时不显示。
* source selection 行为：
  * 选择某个 `sources` 项后，`EnmokuPlayer` 使用对应 URL。
  * 当前演目变化时，重置本地 source selection。
  * 若所选 index 越界或 metadata 缺失，回退到 `enmoku.url`。
  * 控件只在当前演目存在且有多个可选 URL 时出现。
* 不改变 server protocol / REST schema / database schema。
* 不改变 `JOUEI`、`SHINKOU`、`BANGUMI` 的权威语义。

## Acceptance Criteria

* [x] `houkago-kyoushitsu` 单测覆盖 helper：默认 URL、source index URL、越界 fallback、metadata 摘要。
* [x] `BushitsuView` 使用 helper 计算传给 `EnmokuPlayer` 的 URL，并在 source selection 改变时重建播放器。
* [x] 当前演目切换会重置 source selection。
* [x] UI 文案走 `i18n/messages.ts`，没有硬编码可见中文。
* [x] `./dx bun run --filter houkago-kyoushitsu test` 通过。
* [x] `./dx bun run typecheck` 通过。
* [x] `./dx bun run lint` 通过。

## Definition of Done

* Parser metadata 在前端房间页可见。
* HLS master playlist 产出的 `sources` 可被本地选择并驱动播放器 URL。
* 不引入新的房间同步语义或服务端数据结构。
* `design.md` / spec 如有长期契约变化则更新。

## Out of Scope

* 字幕轨道真正接入 ArtPlayer / hls.js。
* 多清晰度选择广播给房间其他成员。
* 站点平台解析器。
* 浏览/搜索 UI。
* 过期 URL 自动重解析。

## Technical Notes

* Likely files:
  * `packages/kyoushitsu/src/lib/enmoku-metadata.ts`
  * `packages/kyoushitsu/test/enmoku-metadata.test.ts`
  * `packages/kyoushitsu/src/views/BushitsuView.vue`
  * `packages/kyoushitsu/src/i18n/messages.ts`
  * `design.md`
* Frontend state-management rule: source selection is local UI state, not Pinia, because it is not currently server authority and only affects the local player.
* Component guideline: all visible text must go through `t()`.
