# Elysia.js on Bun — housou spike 结果

> 这是 throwaway evaluation spike 的结论留档。spike 工程位于 `/tmp/elysia-spike/`（不进仓库），本文件是唯一保留产物。

## Verdict（最终判定）

**采用 Elysia.js on Bun。** 6/6 能力探针全部 PASS，**硬指标 #781（非 WS 上下文全局 publish）PASS**。无需退 Fastify-on-Bun。

## 环境与解析版本（实测）

| 项 | 值 |
|----|----|
| Bun 镜像 | `oven/bun:1`（IMAGE 59cef0f85ea4，本机已缓存） |
| elysia | `1.4.28` |
| OpenAPI 插件 | `@elysiajs/openapi@1.4.15`（当前包名是 `@elysiajs/openapi`，**不是** `@elysiajs/swagger`；后者已被取代） |
| Eden | `@elysiajs/eden@1.4.9` |
| typescript | `6.0.3` |
| Bun 类型 | `@types/bun`（tsconfig `types: ["bun"]`；镜像不带 `bun-types`，写成 `bun-types` 会 TS2688） |

Docker build + 容器内运行均已验证（非 fallback）。docker daemon 可用，镜像构建成功并实际运行测试驱动。

## 逐探针结果

| 探针 | 结果 | 证据 |
|------|------|------|
| **P1 房间 pub/sub 广播+隔离** | **PASS** | `room:r1` 内一客户端发 CHAT，同房另一客户端收到；`room:r2` 客户端未泄漏。`ws.subscribe(topic)` + `ws.publish(topic,msg)` 工作正常。 |
| **P2A #781 HTTP handler 全局 publish** | **PASS（硬指标）** | `POST /broadcast/:room` 在普通 HTTP handler 内 `server?.publish('room:r1',msg)`，WS 订阅者实时收到。`published` 返回投递数（59 = 当时所有连接计数）。 |
| **P2B #781 setInterval 定时器全局 publish** | **PASS（硬指标）** | 模块级 `setInterval` 中 `app.server?.publish('room:ticks',msg)`，加入 `ticks` 房间的 WS 客户端持续收到 TICK。 |
| **P3 WS schema 校验（TypeBox）** | **PASS** | `.ws('/ws',{ body: t.Object({...}) })`。发畸形消息得到结构化校验错误（**error 事件，非静默丢弃、非断连**）：`{"type":"validation","on":"message","property":"/type","message":"Expected required property","summary":"Property 'type' is missing",...}`。随后合法消息正常被接受。 |
| **P4 出席计数（presence）** | **PASS** | `open`/`close` 维护 `room→count`；JOIN/LEAVE 向房间广播 PRESENCE。HTTP `GET /presence/r1` 实测 `count=2`，且房间内收到 PRESENCE 消息。 |
| **P5 OpenAPI 导出** | **PASS** | `@elysiajs/openapi` 在 `/openapi/json` 提供有效 spec：`openapi: 3.0.3`，`paths` 含 `/broadcast/{room}`、`/presence/{room}`、`/ws`（WS 端点亦被自动收录）。 |
| **P6 Eden Treaty 类型共享** | **PASS（编译期）** | 导出 `export type App = typeof app`；`client.ts` 用 `treaty<App>()`。`bunx tsc --noEmit` 正确调用 rc=0；负向对照（`post({content:123})`）报 `TS2322: Type 'number' is not assignable to type 'string'`，rc≠0 → 类型确实端到端流通。**仅编译期，无运行时开销。** |

## #781 硬指标结论（明确陈述）

**PASS。** 命中 #781 的真实场景——housou 的 `JOUEI`/`BANGUMI`/`SHUSSEKI` 等 S→C 事件由 HTTP handler 与定时器（非 WS 上下文）触发——在当前 Elysia 1.4.28 上可干净实现。

**可用工作模式（即结论）：**
- HTTP handler 内：从 handler context 解构 `server`，调 `server.publish(topic, JSON.stringify(msg))`。
- 模块级定时器/任意非请求上下文：`app.server?.publish(topic, JSON.stringify(msg))`（`app.server` 在 `app.listen()` 之后可用，是底层 Bun server 句柄）。
- 二者都直接命中 Bun 原生 pub/sub topic，与 WS 内 `ws.publish` 投递到同一 `room:<id>` topic。

#781 描述的历史痛点在此版本已不构成阻塞。

## 设计落点（回填 design.md / readme 用）

- housou 运行时：**Bun**；Web 框架：**Elysia.js**。
- 房间广播直接用 Bun 原生 pub/sub topic（`room:<bushitsuId>`），WS 内 `ws.publish`、非 WS 用 `server.publish`/`app.server.publish` 统一投递。
- WS 消息信封用 TypeBox `t.Object` 校验，校验失败走 error 事件（结构化错误，可据此回 `KEIHOU`）。
- 契约共享走 Eden Treaty（编译期类型），与 kousoku 的 TS 类型策略一致。
- 弹幕渲染引擎采用 MIT 的 `weizhenye/Danmaku`（canvas），不自研。

## 如何复现

```bash
# 工程在 /tmp/elysia-spike/（spike 产物，不进仓库）
cd /tmp/elysia-spike
docker build -t elysia-spike .
# 容器内：起服务 + 跑驱动(探针1-5) + 类型检查(探针6) + 负向对照
docker run --rm --entrypoint bash elysia-spike /app/run.sh
```

预期尾部：
```
6/6 passed
HARD GATE (#781): PASS
...
driver_rc=0 typecheck_rc=0 negctrl_rc=2   # negctrl 非零 = 错误调用被正确拒绝
```

文件：`server.ts`（6 探针服务端）、`driver.ts`（WS+fetch 自动化断言）、`client.ts`（Eden 类型证明）、`Dockerfile`、`run.sh`（容器内一键编排）。
