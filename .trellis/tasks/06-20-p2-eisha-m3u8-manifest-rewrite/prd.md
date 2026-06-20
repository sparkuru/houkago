# P2 m3u8 manifest 重写

## Goal

让 `houkago-eisha` 的稳定代理地址可以真正承载 HLS 播放：当代理目标是 m3u8 playlist 时，把 playlist 内部的相对分片、子 playlist、key/map 等 URI 改写为新的 `/eisha/proxy/:token` 地址，避免浏览器拿到上游相对路径后绕过代理或 404。

## What I Already Know

* `houkago-eisha` 已有通用 resolver、base64url proxy token、`/eisha/proxy/:token` 路由和基础 Range/seek 代理测试。
* `proxyUpstream` 当前会透传上游 body，并保留 seek 相关响应头；它不会读取或改写 m3u8 内容。
* `housou` 已挂载 eisha routes，现有 e2e 覆盖了 Range header、content-range、content-type 透传。
* 设计文档 P2 backlog 明确下一刀可选「前端 dev 直链表单接 resolver/create 流程」或「先做 m3u8 manifest segment 重写」。

## Assumptions

* 先做 manifest 重写更稳：用户常用测试链接是 m3u8，若前端先接入 resolver，但 playlist 内部仍是相对 segment，会导致 HLS 播放链路不完整。
* 这次只处理完整 m3u8 响应；带 `Range` 的请求继续按媒体字节直传，不对部分内容做文本改写。
* 子资源 token 继续携带原始 `headers`，保证需要 header 的上游 segment/key 请求仍能通过 eisha 拉取。

## Requirements

* 新增可测试的 m3u8 manifest 重写逻辑。
* 对 playlist 中普通 URI 行进行改写：
  * 相对 URI 以当前 playlist 上游 URL 为 base 解析。
  * 绝对 http(s) URI 直接改写为代理 URL。
  * 空行、注释行和不支持的非 http(s) URI 保持原样。
* 对 HLS tag 中的 `URI="..."` 属性进行改写，至少覆盖 `EXT-X-KEY`、`EXT-X-MAP`、`EXT-X-MEDIA` 这类常见 tag。
* `proxyUpstream` 在上游 URL path 为 `.m3u8` 或响应 `content-type` 表示 HLS playlist 时，返回改写后的 playlist。
* 改写后的 playlist 响应不能保留 stale 的 `content-length`、`content-range`、`accept-ranges`、`etag`。
* 非 playlist 资源保持当前代理行为：Range passthrough、seek 相关响应头、流式 body 直传。

## Acceptance Criteria

* [x] eisha 单元测试覆盖普通 URI 行、相对路径、绝对路径、`URI="..."` 属性和非 http(s) URI 保持。
* [x] eisha 单元测试覆盖 m3u8 proxy 响应会改写 playlist，并移除 stale body/Range 相关响应头。
* [x] eisha 单元测试确认非 m3u8 媒体响应仍按当前 Range 行为直传。
* [x] housou e2e 覆盖 `/eisha/proxy/:token` 返回被改写的 playlist，且改写后的 segment URL 可继续经同一路由获取。
* [x] `./dx bun run --filter houkago-eisha test` 通过。
* [x] `./dx bun run --filter houkago-housou test` 通过。
* [x] `./dx bun run typecheck` 通过。
* [x] `./dx bun run lint` 通过。

## Definition of Done

* Tests added/updated for unit and route-level behavior.
* Lint / typecheck / focused tests pass.
* `design.md` 的 P2 状态与下一步 backlog 更新。
* 若实现沉淀出可复用约束，更新 `.trellis/spec`。

## Technical Approach

在 `houkago-eisha` 内新增纯函数重写器，`proxyUpstream` 只负责判断响应是否应该重写、调用重写器、整理响应头。URI 改写统一复用 `ProxyRef` + `encodeProxyRef`，避免为 playlist 子资源另建一套 token 规则。

## Decision (ADR-lite)

**Context**: eisha 已有稳定 proxy token，但 HLS playlist 内部仍可能指向相对资源。浏览器请求这些相对资源时会落到 housou/eisha 代理路径之下的错误位置，或直接绕过 eisha。

**Decision**: 先实现 playlist 文本改写，不在本任务接前端 dev 表单，也不做过期 URL 自动续期。

**Consequences**: HLS 通用直链可以通过代理端点跑通；后续前端接 resolver 时已经有完整媒体链路。过期 URL 和平台解析器仍需后续任务处理。

## Out of Scope

* 前端 dev 直链表单接入 resolver/create 流程。
* 平台解析器、搜索/浏览 UI。
* 过期 URL 自动重解析。
* DASH MPD 重写。
* DRM license 流程和 key 续期策略。

## Technical Notes

* Likely files:
  * `packages/eisha/src/proxy.ts`
  * `packages/eisha/src/index.ts`
  * `packages/eisha/test/proxy.test.ts`
  * `packages/housou/test/eisha-proxy.e2e.test.ts`
  * `design.md`
* Existing code preserves `accept-ranges`, `content-length`, `content-range`, `content-type`, `etag`, `last-modified`; rewritten text responses need a smaller safe header set.
* No external dependency is needed for the MVP rewrite; HLS URI references are simple playlist lines plus quoted `URI` attributes.
