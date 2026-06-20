# P2 eisha 解析与代理骨架

## Goal

推进 P2 解析+代理：新增 `houkago-eisha` 包作为“平台/直链解析 → 稳定播放 URL → 上游代理”的边界，先跑通通用直链与 m3u8 的 resolver、稳定代理 URL 生成、基础流代理与 Range/seek 行为。复杂平台解析、m3u8 manifest 重写、过期 URL 自动续期、浏览/搜索 UI 留到后续切片。

## What I Already Know

- `design.md` §10.2 的 P1 文件弹幕与 kokuban 骨架已经完成并通过人工 smoke test。
- `design.md` 的下一块未开始范围是 P2：新建 `houkago-eisha` 包、定义解析器接口、先做通用直链 / m3u8 resolver、实现稳定流代理端点和 Range/seek 基础行为。
- `houkago-kousoku` 的 `Enmoku` 已预留 `headers`、`subtitles`、`sources`、`danmaku`、`live` 字段，且 `url` 设计为后续指向 eisha 稳定代理地址。
- `housou` 当前 REST `POST /bushitsu/:id/enmoku` 只接收并持久化 `title/type/url/addedBy`；SQLite `enmoku` 表也只存这些最小字段。
- 当前前端 dev 直链入口仍直接提交 URL；本任务可以不改 UI，也可以让它调用 housou 的 resolver API。
- `archive/refer/synctv/utils/m3u8/m3u8.go` 提供了 m3u8 segment 遍历/改写思路；本任务只借鉴设计，不拷 AGPL 代码。
- `archive/refer/synctv-web/src/plugins/source.ts` 说明后续多源切换 UI 会消费 `sources`，但本任务不做 ArtPlayer source selector。

## Assumptions

- `houkago-eisha` 首版是纯 TS/Bun 包，导出 resolver 与 proxy helper；不单独起服务进程。
- `housou` 可以挂载最小 eisha 路由，作为当前部署里的稳定代理端点；后续再拆成独立 eisha 服务也能保持接口。
- 稳定代理 URL 首版可以用 URL-safe token 编码上游 URL/headers/type；不做长期持久化映射表。
- 只允许代理 `http:` / `https:` 上游，拒绝其他协议，避免 file/local 协议风险。
- Range/seek 基础行为 = 转发客户端 `Range` header 到上游，并透传关键响应状态/headers（`206`、`content-range`、`accept-ranges`、`content-length`、`content-type`）。
- m3u8 首版代理 playlist 本体；segment URI manifest 重写后置，因此复杂相对 segment 播放可能仍不完整。

## Open Questions

- None.

## Requirements

- 新建 `packages/eisha` / `houkago-eisha` workspace package。
- 定义框架无关 resolver 接口：输入原始 URL/title/addedBy/bushitsuId，输出 `Enmoku` 创建所需字段和稳定代理 URL。
- 支持通用 `http(s)` 直链 resolver：`.m3u8` → `hls`，`.mpd` → `dash`，其他默认 `direct`。
- 生成稳定代理 URL，包含足够信息让 housou/eisha 代理到上游。
- 实现基础代理 helper：校验 token、恢复上游 URL/headers、转发 `Range`，透传关键响应 header 和 status。
- 在 housou 挂载最小 eisha 路由，提供代理端点（例如 `/eisha/proxy/:token`）。
- 为 resolver、token 编解码、Range header 转发/响应透传添加测试。
- 不新增复杂平台解析器，不做 B 站/YouTube 等反爬解析。
- 不实现 m3u8 manifest segment 重写、过期 URL 自动重解析、浏览/搜索 UI。

## Acceptance Criteria

- [ ] `houkago-eisha` 包存在并可被 workspace typecheck。
- [ ] resolver 能把普通 mp4 URL 解析为 `type: "direct"`，`url` 指向稳定代理端点。
- [ ] resolver 能把 `.m3u8` URL 解析为 `type: "hls"`，`url` 指向稳定代理端点。
- [ ] 非 `http(s)` URL 被拒绝并有可测试错误。
- [ ] 代理请求会把客户端 `Range` header 转发到上游。
- [ ] 代理响应保留上游 `206` 和 `content-range` / `accept-ranges` / `content-length` / `content-type` 等基础 seek 所需 header。
- [ ] housou 暴露代理路由，E2E 测试可通过本地上游服务验证 range/seek 行为。
- [ ] `bun run typecheck`、`bun run lint`、相关包测试通过。

## Definition of Done

- Tests added for resolver, proxy token/security, and housou proxy route behavior.
- Lint / typecheck green.
- PRD/design/spec updated if durable API or boundary decisions emerge.
- Rollback path is simple: remove eisha route/package dependency and keep current direct-link flow.

## Technical Approach

Confirmed MVP: **standalone eisha core + housou-mounted proxy route, no UI change yet**.

- `houkago-eisha` exports pure functions:
  - `resolveUrl(input, options): ResolvedEnmokuSource`
  - `encodeProxyRef(ref): string`
  - `decodeProxyRef(token): ProxyRef`
  - `proxyUpstream(ref, request): Promise<Response>`
- `ProxyRef` contains `url` plus optional upstream `headers`.
- `resolveUrl` infers `Enmoku["type"]` from URL extension/path and returns `url = <proxyBase>/eisha/proxy/<token>`.
- `housou` imports eisha and mounts `/eisha/proxy/:token` in its app.
- Tests use a local in-process upstream server or mocked global `fetch` to verify Range forwarding and header passthrough.

## Decision (ADR-lite)

**Context**: P2 eventually wants platform parsers, expiring URL renewal, manifest rewriting, stable proxy URLs, browser/search UI, and persistence of expanded `Enmoku` fields. Doing all at once would couple platform parsing, storage, security, and playback behavior.

**Decision**: First implement the proxy/resolver skeleton with generic direct/m3u8 URLs only. Keep eisha framework-free and mount its route through housou for now. Do not persist expanded `Enmoku` fields or change the frontend dev form in this first slice unless explicitly confirmed.

**Consequences**: This gives a concrete stable proxy seam and testable Range behavior quickly. It does not yet make all HLS playlists with relative segments work, because manifest rewriting is deferred; those remain a later P2 task.

## Options For MVP Boundary

1. **Backend/API skeleton only (Recommended)** — create eisha package + housou proxy route + tests; dev form still submits direct URLs for now. Lowest risk and proves the hard proxy behavior first.
2. **Also wire dev form to resolver** — add a REST resolve/create path and make the frontend submit through eisha. More visible immediately, but expands scope across frontend + persistence decisions.
3. **Full P2 vertical slice** — resolver + proxy + dev form + manifest rewrite. Most useful, but too large for one clean task.

## Out of Scope

- Platform-specific parsing for Bilibili/YouTube/etc.
- m3u8 manifest rewriting and segment URL rewriting.
- Expiring URL refresh/re-resolve.
- Search/browse UI.
- Persisting `headers/subtitles/sources/danmaku/live` in SQLite.
- Subtitle/audio/multi-quality UI.
- Authenticated private proxy URLs or quota/rate limiting.

## Technical Notes

- Inspected `design.md` §6, §7, §10.1, §10.2.
- Inspected `packages/kousoku/src/domain.ts`: `Enmoku` already has future eisha fields.
- Inspected `packages/housou/src/routes/bushitsu.ts`, `domain/bushitsu.ts`, `db/schema.sql`, `db/queries/enmoku.ts`: current persistence is minimal direct-link fields only.
- Inspected `packages/housou/src/index.ts`: app composition can mount a new route module beside `bushitsuRoutes` and `wsRoutes`.
- Inspected `archive/refer/synctv/utils/m3u8/m3u8.go` for future m3u8 rewrite concepts only.
- Inspected `archive/refer/synctv-web/src/plugins/source.ts` for later source selector shape only.
