# 后端选型落定：Elysia.js spike 验证 + 弹幕库/Bun 决策回填

## Goal

为 houkago 后端选型做最终落定。三件事：
1. 弹幕渲染：采用现成 MIT 引擎 `weizhenye/Danmaku`（canvas 引擎），不自研——在 readme 标注。
2. 运行时：housou 后端确定用 **Bun**（原生 WS pub/sub topic 天然适配房间广播）。
3. Web 框架：对 **Elysia.js** 做一次隔离 spike（/tmp + docker），用真实测试用例验证它能否满足 housou 的同步广播需求；过则上 Elysia，不过则退 Fastify-on-Bun。结论回填 design.md 与 readme。

核心待验证风险：Elysia [issue #781](https://github.com/elysiajs/elysia/issues/781)——从非 WS 上下文（HTTP handler / 定时任务）发起全局 `publish()` 历史上不顺，而 housou 的 `JOUEI`/`BANGUMI`/`SHUSSEKI` 等 S→C 事件正由非 WS 触发，命中此点。

## What I already know

- 项目当前处于纯设计阶段，`packages/` 下尚无代码——"结论回填"= 改 design.md(§8 选型表、§9 仓库结构) + readme，不涉及现有代码迁移。
- design.md §4 WS 协议表已定义信封 `{type,ts,senderId,payload}` 及 SHINKOU/GENJOU/JOUEI/BANGUMI/SHUSSEKI 等消息。
- 上一轮已决定（ChatGPT review #6）：SHINKOU 拆 command/event + seq/stateVersion，但该改动属另一任务，本任务只在 spike 协议探针里顺带体现。
- Bun 原生 pub/sub：`ws.subscribe(topic)` / `server.publish(topic,msg)`。Elysia 的 `.ws()` 包 Bun WS 并保留 pub/sub，TypeBox schema 同时给：运行时校验 + 静态类型 + OpenAPI 导出；Eden Treaty 给端到端类型共享（服务 kousoku 契约）。

## Assumptions (temporary)

- spike 只验证能力边界，不产出生产代码；产物留 /tmp，仅结论进仓库。
- docker 用官方 `oven/bun` 镜像。
- 验证手段：自动化测试脚本（WS 客户端 + HTTP 客户端）跑通断言，docker 内启服务、外部探针验证。

## Decision (ADR-lite)

**Context**: 后端框架在 Bun 之上选 Elysia 还是 Fastify-on-Bun，取决于 Elysia 能否满足 housou 同步广播的真实需求。

**Decision**:
- spike 用例采用**通用能力探针**——最小用例逐项验证 Elysia 能力边界，不引入 houkago 领域词，最快拿结论；SHINKOU 协议重构属另一任务。
- 判定红线**以 #781 为硬指标**：非 WS 上下文全局 `publish()` 必须能干净实现（S→C 事件 JOUEI/BANGUMI/SHUSSEKI 依赖它）。此项过不了 → 直接退 Fastify-on-Bun。其余项（OpenAPI 导出 / Eden 类型共享 / WS schema 校验 / 出席计数）为加分项，缺一两个不致命，写入结论权衡。

**Consequences**: spike 轻量、结论快；但不顺带验证生产协议手感，SHINKOU command/event 落地时需另测。

## Requirements (evolving)

- [决策] readme 标注弹幕引擎 `weizhenye/Danmaku`。
- [决策] design.md 选型表 housou 运行时改 Bun。
- [验证] /tmp 下建独立 Elysia spike 工程 + 测试用例 + Dockerfile。
- [验证] docker 构建 + 部署 + 外部探针验证测试用例全过/暴露问题。
- [回填] spike 结论（含 #781 结果）写入 design.md 选型表与 readme；给出 Elysia or Fastify-on-Bun 的最终判定。

## Acceptance Criteria (evolving)

- [ ] readme 含弹幕引擎标注。
- [ ] /tmp spike 工程能 docker build 成功并启动。
- [ ] 测试用例覆盖：房间 pub/sub 广播、**非 WS 上下文全局 publish（#781）**、WS schema 校验、出席计数、OpenAPI 导出、Eden 类型共享。
- [ ] 每条用例有明确 pass/fail 断言与实测结果记录。
- [ ] design.md §8/§9 与 readme 按结论更新，给出最终框架判定。

## Definition of Done

- spike 结果可复现（Dockerfile + 测试脚本 + 一键运行说明留档于 research/）。
- 结论有数据支撑，非主观；#781 风险点有明确实测结论。
- design.md / readme 更新一致，一词一义。

## Out of Scope

- 实际 housou 生产代码搭建（另起任务）。
- SHINKOU command/event 协议重构落地（本任务仅探针级体现）。
- 弹幕引擎集成代码（仅 readme 标注选型）。
- eisha/kokuban/前端选型变更。

## Technical Notes

- 参考：design.md §8 技术选型、§9 仓库结构。
- Elysia: https://elysiajs.com/patterns/websocket · Eden WS: https://elysiajs.com/eden/treaty/websocket
- 风险: https://github.com/elysiajs/elysia/issues/781 · 参照: https://github.com/elysiajs/elysia/issues/115
- Bun pub/sub: https://bun.com/guides/websocket/pubsub
- 弹幕引擎: https://github.com/weizhenye/Danmaku
