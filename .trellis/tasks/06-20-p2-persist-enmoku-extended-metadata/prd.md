# P2 Enmoku 扩展元数据持久化

## Goal

让 `Enmoku.headers/subtitles/sources/danmaku/live` 能在 `housou` 的 SQLite 番組表中完整保存和读回，为后续平台解析器、字幕/多源 UI、弹幕引用和 live 标记打地基。

## What I Already Know

* `houkago-kousoku` 的 `Enmoku` 类型已经定义了 `headers`、`subtitles`、`sources`、`danmaku`、`live` 可选字段。
* 当前 `packages/housou/src/db/schema.sql` 的 `enmoku` 表只保存 `id/bushitsu_id/title/type/url/added_by/created_at`。
* 当前 `packages/housou/src/db/queries/enmoku.ts` 映射只读写最小字段，扩展字段会在 `addEnmoku()` 后丢失。
* `POST /bushitsu/:id/enmoku` 已支持 legacy direct body 和 resolver body；resolver 目前只有 dev `sourceUrl` 表单使用。
* 现有 schema bootstrap 只执行 `CREATE TABLE IF NOT EXISTS`，对已存在旧表不会自动加列。

## Assumptions

* 本任务只持久化小型元数据，不存媒体字节。
* 结构化字段使用 JSON TEXT 列保存，避免为字幕、多源、弹幕引用在 P2 阶段拆多张表。
* `headers` 存的是 eisha 稳定代理/解析链路所需的小型 header map；过期 URL 自动续期仍属于后续任务。
* `live` 使用 SQLite INTEGER 0/1/null 映射到 `boolean | undefined`。
* 需要兼容已有本地旧库，所以除了更新 `schema.sql`，还要在启动 bootstrap 中做幂等 `ALTER TABLE ADD COLUMN`。

## Requirements

* `enmoku` 表新增并保存：
  * `headers_json`
  * `subtitles_json`
  * `sources_json`
  * `danmaku_json`
  * `live`
* `insertEnmoku()` 写入可选字段；`listEnmoku()` 读回并恢复为 `Enmoku` 类型。
* 旧行没有扩展字段时，读回对象不应出现空对象/空数组/false 默认值；字段应保持 `undefined`。
* `addEnmoku()` 的输入允许传入 `Enmoku` 扩展字段并保留。
* REST legacy create body 支持扩展字段；resolver create body 至少支持 `headers` 并把它传给 `resolveUrl()`。
* 创建、列表、BANGUMI 广播中的 `Enmoku` 都应包含持久化后的扩展字段。
* 已存在旧库启动时能补齐新列，不需要手动删库。

## Acceptance Criteria

* [x] REST 测试覆盖 legacy create 带 `headers/subtitles/sources/danmaku/live` 后，创建响应和 `GET /bangumi` 都能完整读回。
* [x] REST 测试覆盖带扩展字段的创建会在 BANGUMI 广播中出现这些字段。
* [x] resolver body 的 `headers` 会进入 eisha proxy token，并且创建后的 `Enmoku.headers` 被持久化。
* [x] 旧字段-only 演目读回不带空扩展字段。
* [x] `./dx bun run --filter houkago-housou test` 通过。
* [x] `./dx bun run typecheck` 通过。
* [x] `./dx bun run lint` 通过。

## Definition of Done

* SQLite schema and bootstrap upgrade handle fresh DB and old DB.
* DB query mapping is type-safe and does not leak raw row JSON outside `db/`.
* Route/domain create path preserves optional Enmoku metadata.
* `design.md` 和 backend spec 更新。

## Technical Approach

在 `enmoku` 表上增加 JSON TEXT 列保存对象/数组型小元数据，`live` 用 INTEGER。`db/client.ts` 在执行 `schema.sql` 后检查 `PRAGMA table_info(enmoku)`，对缺失列做幂等 `ALTER TABLE ADD COLUMN`，保证旧本地库可升级。查询层负责 JSON parse/stringify 和 `undefined` 语义，domain/route 层继续只处理 `Enmoku`。

## Decision (ADR-lite)

**Context**: `Enmoku` 类型已经有扩展字段，但 housou 存储层仍只保存直链最小字段。后续平台解析器会产出 headers、字幕、多源和弹幕引用，如果现在不持久化，队列、刷新和 WS BANGUMI 都会丢数据。

**Decision**: P2 先用 JSON TEXT 列持久化扩展元数据，并做简单幂等列升级；暂不拆标准化子表。

**Consequences**: 读取/广播完整 `Enmoku` 变得可靠，迁移成本低。未来若要对字幕/来源做独立查询、编辑、排序，可以再迁移到子表。

## Out of Scope

* 字幕/音轨/多清晰度 UI。
* 平台解析器实现。
* 过期 URL 自动续期。
* header 输入 UI。
* 完整 migration framework / schema_version 表。

## Technical Notes

* Likely files:
  * `packages/housou/src/db/schema.sql`
  * `packages/housou/src/db/client.ts`
  * `packages/housou/src/db/queries/enmoku.ts`
  * `packages/housou/src/domain/bushitsu.ts`
  * `packages/housou/src/routes/bushitsu.ts`
  * `packages/housou/test/rest.test.ts`
  * `design.md`
  * `.trellis/spec/backend/database-guidelines.md`
  * `.trellis/spec/backend/quality-guidelines.md`
