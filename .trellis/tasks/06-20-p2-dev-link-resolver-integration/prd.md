# P2 dev 直链接 eisha resolver

## Goal

让前端部室页的 dev 手填播放链接通过 `houkago-eisha` resolver 创建演目，而不是直接把原始 m3u8/mp4 URL 塞入番組表。这样 HLS 链接会进入稳定 `/eisha/proxy/:token` 地址，并复用上一项完成的 m3u8 manifest 重写能力。

## What I Already Know

* 上一项已完成 m3u8 manifest segment/key/map/media URI 重写。
* `houkago-eisha` 已提供 `resolveUrl(input, { proxyBase })`，可返回 `{ title, type, url, headers }`。
* `houkago-housou` 已 co-deploy `eishaRoutes`，目前 `/bushitsu/:id/enmoku` 只接收 `{ title, type, url, addedBy }` 并原样入队。
* `houkago-kyoushitsu` 的 `BushitsuView.playManual()` 当前在前端用 `.endsWith(".m3u8")` 判断类型，然后 POST 原始 URL。
* `Enmoku` 类型已有 `headers` 字段，但当前 SQLite `enmoku` 表只持久化最小字段，尚未保存 headers/subtitles/sources。

## Assumptions

* 这次保留旧的 `{ title, type, url, addedBy }` POST body 兼容现有测试与后续内部调用。
* 新增 dev resolver body：`{ sourceUrl, title?, addedBy }`。服务端调用 `resolveUrl()`，再创建 `Enmoku`。
* `proxyBase` 使用当前请求 origin，生成同源的 `http://host/eisha/proxy/:token`。
* 暂不持久化 `headers`，因为 dev 手填链接没有 header 输入窗口；需要 header 的平台解析器/高级表单后续单独切片。

## Requirements

* `POST /bushitsu/:id/enmoku` 支持两种 body：
  * 旧模式：`{ title, type, url, addedBy }`，行为保持不变。
  * resolver 模式：`{ sourceUrl, title?, addedBy }`，服务端解析为稳定 eisha proxy URL 后入队。
* resolver 模式应：
  * 校验 `sourceUrl` 仅支持 http(s)，复用 eisha 的 bad request 行为。
  * 根据 URL 推断 `direct` / `hls` / `dash`。
  * 默认标题使用用户提交的 `title`，没有时使用 resolver 的默认标题。
  * 创建后广播完整 `BANGUMI`，与旧模式一致。
* 前端 dev 手填表单改为提交 `sourceUrl`，不再自己推断 `.m3u8` 类型。
* 番組表显示与 JOUEI 播放继续使用服务端返回的 `Enmoku`。

## Acceptance Criteria

* [x] housou REST 测试覆盖旧 body 仍可创建演目。
* [x] housou REST 测试覆盖 `sourceUrl` 创建 HLS 演目，返回 URL 为 `/eisha/proxy/:token`，token 解码后指向原始 URL。
* [x] housou REST 测试覆盖 resolver 创建后仍广播 `BANGUMI`。
* [x] kyoushitsu 相关测试或类型检查确认 dev 表单调用新的 `sourceUrl` body。
* [x] `./dx bun run --filter houkago-housou test` 通过。
* [x] `./dx bun run --filter houkago-kyoushitsu test` 通过。
* [x] `./dx bun run typecheck` 通过。
* [x] `./dx bun run lint` 通过。

## Definition of Done

* Backend route contract and frontend call are updated.
* Tests cover resolver and legacy create paths.
* `design.md` P2 backlog/status updated.
* Spec updated if the POST body contract changes need to be preserved.

## Technical Approach

Keep `housou` as the control-plane owner of room/playlist creation while delegating URL resolution to `houkago-eisha`. The REST handler chooses between legacy direct create and resolver create based on body shape, then calls the existing `addEnmoku()` domain function and shared BANGUMI broadcast path.

## Decision (ADR-lite)

**Context**: The frontend dev form is currently a direct-link scaffold. After eisha proxy and manifest rewrite landed, the useful next step is to route those manually entered links through eisha so HLS playback uses stable proxy URLs.

**Decision**: Add resolver mode to the existing enmoku create endpoint instead of adding a separate `/eisha/resolve` endpoint for the frontend.

**Consequences**: The frontend only needs one create call and receives a normal `Enmoku`. `housou` remains the owner of queue mutation and BANGUMI broadcast. The endpoint now has a union body, which should be recorded in backend spec.

## Out of Scope

* Persisting `headers/subtitles/sources/danmaku/live` in SQLite.
* Header input UI for dev links.
* Platform parser/search/browse UI.
* Expired URL renewal.
* DASH MPD rewrite.

## Technical Notes

* Likely files:
  * `packages/housou/src/routes/bushitsu.ts`
  * `packages/housou/test/rest.test.ts`
  * `packages/kyoushitsu/src/views/BushitsuView.vue`
  * `design.md`
  * `.trellis/spec/backend/quality-guidelines.md`
* `housou` already imports `houkago-eisha` for route composition; importing `resolveUrl` in `bushitsuRoutes` does not add a new package dependency.
* The route should avoid duplicating BANGUMI publish logic once it supports two create modes.
