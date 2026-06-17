# 番組表队列管理

## Goal

把当前只读的番組表变成可操作队列：房主/有选源权限者可以从番組表选择任意演目播放，并删除不需要的演目。先补齐最影响复测和日常使用的队列操作，自动下一首和拖拽排序留后续。

## What I Already Know

- `design.md` 明确 `housou` 负责“番組表（当前演目 + 队列）”，但当前实现只做到列表展示。
- 当前数据模型：`enmoku` 表按 `created_at ASC` 列表；无排序字段、无删除接口。
- 当前 REST：
  - `GET /bushitsu/:id/bangumi` 返回房间演目列表。
  - `POST /bushitsu/:id/enmoku` 新增演目。
- 当前 WS：
  - `JOUEI { enmokuId }` 已能广播当前上映源。
  - 服务端已按 `canDo(..., "playlist")` 强制有权者才能 `JOUEI`。
- 当前前端：
  - `playManual()` 新增演目后立即发送 `JOUEI` 播放。
  - 番組表只渲染标题：`<li>{{ e.title }}</li>`。
  - `bushitsu.canPlaylist` 已用于源输入入口 gating。

## Requirements

1. 番組表列表可操作：
   - 当前上映演目有明确状态标识。
   - 有 `canPlaylist` 权限者可点击番組表条目播放该演目（发送 `JOUEI`）。
   - 无 `canPlaylist` 权限者只能查看番組表，不能播放/删除。
2. 删除演目：
   - 有 `canPlaylist` 权限者可删除非当前上映演目。
   - 删除后刷新/更新本地番組表。
   - MVP 禁止删除当前上映演目，避免引入“停播/自动下一首”的额外同步语义。
3. 新增演目的现有体验尽量不破坏：
   - 保留“手填源后立即播放”，同时该演目也出现在番組表。
4. 服务端提供删除所需 REST/domain/db 能力。
   - 由于当前 REST POST 本身没有鉴权，本任务的删除鉴权先保持与现状一致：前端 gating + WS `JOUEI` 服务端强制；真正 REST 鉴权留后续账号/鉴权任务。
5. 不破坏：
   - JOUEI/GENJOU 迟到追平。
   - guest 权限 gating。
   - 入房控制。
   - 现有手填直链复测路径。

## Acceptance Criteria

- [x] 房主添加多个源后，番組表显示多个条目。
- [x] 房主点击任一番組表条目，所有已入房客户端切到对应演目。
- [x] guest 无选源权限时，不能点击播放/删除番組表条目。
- [x] guest 有选源权限时，能点击番組表条目驱动所有人切源。
- [x] 删除演目后，番組表立即移除该条目；刷新页面后仍不出现。
- [x] 当前上映演目不可删除；删除按钮禁用或隐藏，并且不会发起删除请求。
- [x] 补 REST/domain/db 测试和前端纯逻辑/store 或组件可测逻辑。
- [x] `./dx bun run typecheck`、`./dx bun run lint`、housou/kyoushitsu 测试通过；必要时 build 通过。

## Decision (ADR-lite)

**Context**: 当前“番組表”只是添加历史列表，房主无法从列表切回旧源，也不能清理错填源。设计目标里番組表是队列，但完整队列包含排序、自动下一首、删除当前项策略、权限鉴权等多个子问题。

**Decision**: MVP 先做“选择播放 + 删除”两项。排序和自动下一首留后续，这样能快速把番組表从静态列表变成可用队列，同时不改同步状态机。

**Consequences**: 实现范围较小，复用现有 `JOUEI` 切源链路；缺点是仍不是完整播放队列，没有自动播下一首，也没有拖拽排序。

## Resolved Decisions

- 新增手填源后继续立即播放，保留当前复测路径；后续再加“仅加入队列”按钮。
- MVP 禁止删除当前上映项，避免引入“停播/自动下一首”的额外同步语义。

## Out of Scope

- 拖拽排序 / 上移下移。
- 播完自动下一首。
- 播放历史、循环/随机播放。
- REST 层账号鉴权。
- eisha 解析器和平台源搜索。
- 弹幕文件/抓取源随演目挂载。

## Technical Approach

- 后端：
  - `db/queries/enmoku.ts` 增加按 `id + bushitsu_id` 删除。
  - `domain/bushitsu.ts` 增加删除演目用例，确保房间存在。
  - `routes/bushitsu.ts` 增加 `DELETE /bushitsu/:id/enmoku/:enmokuId`。
- 前端：
  - 抽小纯函数判断番組表条目是否当前上映、是否可操作。
  - `BushitsuView.vue` 的番組表渲染加入播放/删除按钮。
  - 点击播放复用现有 `JOUEI` 发送路径。
  - 删除后本地移除或重新 GET 番組表。

## Technical Notes

- Inspected files:
  - `design.md`
  - `packages/housou/src/routes/bushitsu.ts`
  - `packages/housou/src/domain/bushitsu.ts`
  - `packages/housou/src/db/schema.sql`
  - `packages/housou/src/db/queries/enmoku.ts`
  - `packages/kyoushitsu/src/views/BushitsuView.vue`
  - `packages/housou/test/rest.test.ts`
  - `packages/housou/test/jouei.e2e.test.ts`
  - `packages/kyoushitsu/src/lib/enmoku-resolve.ts`

## Implementation Notes

- Backend added `DELETE /bushitsu/:id/enmoku/:enmokuId`, backed by a prepared `DELETE` constrained by `bushitsu_id`.
- Domain deletion ensures the 部室 exists and returns `ENMOKU_NOT_FOUND` when no row is removed.
- Frontend 番組表 rows now show the current 演目, expose play/delete controls only to `canPlaylist` users, and disable current-item deletion.
- Manual direct-link add still immediately sends `JOUEI`.
- Follow-up fix: REST create/delete now broadcasts full `BANGUMI` snapshots so host and guest queues stay synchronized without refresh.
- Follow-up fix: `JOUEI` source switches reset transport to paused `0s` and broadcast a fresh `GENJOU`, so followers do not inherit the previous source's play/time state.

## Verification

- `./dx sh -c 'cd packages/housou && bun test && cd ../kyoushitsu && bun test'`
- `./dx bun run format`
- `./dx bun run typecheck`
- `./dx bun run lint`
- `./dx sh -c 'cd packages/housou && bun test && cd ../kyoushitsu && bun test && bun run build'`
- User manual test passed: queue display, host item click sync, guest permission gating, guest playlist driving sync, current-item delete disabled.
- User manual test found and this task fixed: guest delete did not sync host until refresh; source switch could make follower play while host stayed paused.
