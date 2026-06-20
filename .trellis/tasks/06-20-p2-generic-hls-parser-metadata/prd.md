# P2 Generic HLS Parser Metadata

## Goal

实现第一个可真实工作的解析器：Generic HLS manifest parser。它在 dev 手填 m3u8 链接时读取 HLS manifest，解析 master playlist 中的多清晰度 `sources`、字幕 `subtitles`，并识别 media playlist 的 `live` 标记，产出刚刚持久化的 Enmoku 扩展元数据。

## What I Already Know

* `houkago-eisha` 目前有同步 `resolveUrl()`：校验 URL、推断类型、生成稳定 `/eisha/proxy/:token`。
* `houkago-eisha` 已有 m3u8 proxy manifest rewrite，能让 playlist 内 URI 继续走 proxy。
* `houkago-housou` 的 create endpoint 已接入 resolver body，并且 `Enmoku.headers/subtitles/sources/danmaku/live` 已能持久化与广播。
* 当前没有 `src/parsers/` 目录，也没有平台/manifest parser 插口。
* 用户常用测试链接是 m3u8，因此 Generic HLS 是最适合先落地的真实解析器；B 站等平台涉及 cookie/签名/反爬，后续单独切更稳。

## Assumptions

* 保留现有同步 `resolveUrl()` 作为基础 fallback，不破坏现有单测和调用。
* 新增 async `resolveUrlWithMetadata()`，HLS 链接才拉上游 manifest；direct/dash 仍走同步基础解析。
* Parser 只读取 manifest 文本，不代理媒体字节。
* Parser 为 HLS 子 playlist / 字幕 playlist 生成稳定 eisha proxy URL，并继承父级 headers。
* Master playlist 不强行设置 `live`；media playlist 根据是否缺少 `#EXT-X-ENDLIST` 判断 `live`。

## Requirements

* 新增 Generic HLS parser：
  * 识别 `#EXT-X-STREAM-INF` 后一行 URI，生成 `sources: { name, url }[]`。
  * 从 `BANDWIDTH` / `RESOLUTION` 生成可读 source name。
  * 解析 `#EXT-X-MEDIA:TYPE=SUBTITLES,...,URI="..."` 生成 `subtitles`。
  * 相对 URI 以当前 manifest URL 解析为绝对 URL。
  * 子资源 URL 通过 `/eisha/proxy/:token` 包装，并保留 headers。
  * media playlist 若没有 `#EXT-X-ENDLIST`，产出 `live: true`；若有则 `live: false`。
* 新增 `resolveUrlWithMetadata(input, options, fetcher?)`：
  * 复用 `resolveUrl()` 的校验、标题、类型和 proxy URL。
  * HLS 时 fetch manifest 并合并 parser metadata。
  * fetch 失败或非 OK 返回应抛 `EishaUpstreamError`。
* housou 的 resolver create path 改用 `resolveUrlWithMetadata()`，把 parser 产出的 metadata 存入 `Enmoku`。
* 旧的 legacy create path 和同步 `resolveUrl()` 行为保持不变。

## Acceptance Criteria

* [x] eisha 单测覆盖 master playlist 解析出多 `sources`，且 source proxy token 指向绝对子 playlist URL。
* [x] eisha 单测覆盖 subtitle media tag 解析为 `subtitles`。
* [x] eisha 单测覆盖 media playlist 的 live/endlist 判断。
* [x] eisha 单测覆盖 `resolveUrlWithMetadata()` 拉 manifest 并返回 metadata。
* [x] housou REST 测试覆盖 resolver create 从本地 HLS manifest 产出并持久化 `sources/subtitles`。
* [x] `./dx bun run --filter houkago-eisha test` 通过。
* [x] `./dx bun run --filter houkago-housou test` 通过。
* [x] `./dx bun run typecheck` 通过。
* [x] `./dx bun run lint` 通过。

## Definition of Done

* Parser 代码位于 `houkago-eisha`，housou 不解析 manifest。
* Parser 输出通过现有 housou create/list/BANGUMI 链路持久化。
* Specs/design 更新，说明 Generic HLS parser 的契约和限制。

## Technical Approach

在 `packages/eisha/src/parsers/hls.ts` 新增纯 parser 与 URL 包装 helper。`resolver.ts` 保留同步 `resolveUrl()`，新增 `resolveUrlWithMetadata()`，它用 fetcher 获取 manifest 后调用 parser。`housou` 的 resolver body create 改为 async，并传入请求 origin 作为 `proxyBase`。

## Decision (ADR-lite)

**Context**: 项目需要第一个真实解析器来产出已持久化的 Enmoku metadata。平台站点解析器通常需要网络、cookie 或签名，测试稳定性较差；Generic HLS 可以基于标准 manifest 文本离线测试，并直接改善当前 dev m3u8 链路。

**Decision**: 第一个解析器先做 Generic HLS manifest parser，不做 B 站等站点解析。

**Consequences**: 立刻获得可测试的 `sources/subtitles/live` metadata 链路；后续平台解析器可以复用同样的 resolver/create/persist/BANGUMI 通道。

## Out of Scope

* Bilibili / YouTube / 其他平台解析器。
* 过期 URL 自动重解析。
* DASH MPD parser。
* 字幕/多清晰度 UI。
* HLS DRM/license 处理。

## Technical Notes

* Likely files:
  * `packages/eisha/src/parsers/hls.ts`
  * `packages/eisha/src/resolver.ts`
  * `packages/eisha/src/index.ts`
  * `packages/eisha/test/resolver.test.ts`
  * `packages/housou/src/routes/bushitsu.ts`
  * `packages/housou/test/rest.test.ts`
  * `design.md`
  * `.trellis/spec/backend/quality-guidelines.md`
