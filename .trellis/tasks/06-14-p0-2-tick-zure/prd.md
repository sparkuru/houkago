# P0 纵切2：漂移校正（周期 tick + zure 分级）

## Goal

在纵切1 房主权威同步之上补 design.md §5 的**漂移校正**：服务端权威钟周期广播权威播放状态，部員比较本地位置与权威投影位置，按 `zure`（ずれ）分级——硬 seek / 软速率校正 / 忽略——消除累积漂移。核心可测算法是 `zureHosei`（design §14）。

## What I already know（scaffold + 纵切1 现状）

- 服务端 `ShinkouSeigyo` 已存权威 `shinkou + shinkouServerTime`、有 `projected(now)`；`handler.ts` 房主权威 SHINKOU 已强制并广播；presence map 在 `housou.ts`。
- 客户端 `useShinkou`：收远端 SHINKOU/GENJOU → 经 store watch → `applyLatest` **总是硬 seek** 到 projected（纵切1）。store 持 `shinkou + shinkouServerTime`，`isBuchou` 派生。EnmokuPlayer 暴露 `apply(shinkou)`（含 0.3s seek 阈值），可读 currentTime/playbackRate/playing，发本地 shinkou 事件。
- Elysia spike #781 已验证**非 WS 上下文**（timer）可 `app.server?.publish(topic,msg)`。

## Requirements

- 服务端：单个全局 `setInterval`（~4s）遍历有 presence 且有权威态的房间，`app.server?.publish` 一条 **GENJOU**（携 `shinkou{isPlaying,currentTime,playbackRate}` + `serverTime`，currentTime 取 `projected(now)`）。仅在 `import.meta.main` 启动，返回 stop 句柄避免测试泄漏。
- 客户端：`useShinkou` 改为**显式按 type 处理远端消息**（替代 slice1 的笼统 store watch）：
  - `SHINKOU`（房主显式操作）→ 硬 apply（play/pause/rate + seek），权威状态变更。
  - `GENJOU`（周期心跳 + OIKAKE 追平）→ apply play/pause/rate；时间对齐走 `zureHosei` 分档。
  - 任何 player 变更外包 `tsuijuuChuu` 回声抑制（沿用 slice1）。
- `zureHosei(zure, isPlaying)` 纯函数 → 决策 `{kind:'ignore'|'seek'|'nudge', rate?}`：
  - `zure ≤ 0.3` → ignore
  - `0.3 < zure ≤ 1.5` → isPlaying ? nudge（rate = authRate × (behind?1.05:0.95)）: seek（暂停态不能调速率）
  - `zure > 1.5` → seek
- 软校正自回退：nudge 后下个心跳重算 zure≤0.3 → 恢复权威速率；useShinkou 跟踪「正在 nudge」以恢复。
- 部員 zure = |localCurrentTime − projectedRemote|，`projectedRemote = shinkou.currentTime + (isPlaying ? (clientNow − serverTime)/1000 × rate : 0)`（v1 信任服务端钟，无 NTP-lite offset）。

## Decision（ADR-lite）

- **tick 源 = 服务端权威钟**（用户选）：setInterval + `app.server?.publish`。权威钟集中、不依赖房主 tab 活跃、正合 spike #781。
- **zure 全三档**（用户选）：硬 seek / 软 ±5% / 忽略，`zureHosei` 纯函数单测三档边界。
- **心跳复用 GENJOU**（AI 定，避免协议churn）：心跳与 OIKAKE 追平同为「权威現状下发」，late joiner 追平即 zure 极大 → seek 档，与漂移统一一条路径。design §4 的 TENKO（C→S 成员上报）在服务端权威钟模型下 v1 不用——记此偏离。
- **软校正自回退**（AI 定，标准做法）：跨 tick 自收敛恢复权威速率。

## Acceptance Criteria

- [ ] `zureHosei` 纯函数单测：三档边界（>1.5 seek、0.3–1.5 playing→nudge / paused→seek、≤0.3 ignore）+ nudge 方向（behind→1.05 / ahead→0.95）。
- [ ] 容器内 `./dx` 集成：服务端周期 GENJOU 心跳实际 publish 到房间（部員 WS 客户端收到 ≥1 条非 OIKAKE 触发的 GENJOU）。
- [ ] typecheck / lint / test / build 全绿（容器内）。

## Definition of Done

- `zureHosei` 纯逻辑单测（kyoushitsu 加 bun test 脚本）；服务端心跳集成验证。
- design §5 偏离（GENJOU 复用作心跳、TENKO v1 不用）回填说明。

## Out of Scope

- 自由控制权、断线重连、NTP-lite clockOffset、WebRTC、自适应 tick 周期。

## Implementation Plan（小步）

- **PR1（zureHosei 纯函数 + 单测）**：`kyoushitsu/src/lib/zure.ts` 三档决策；`kyoushitsu/test/zure.test.ts` + package.json `test` 脚本。
- **PR2（服务端心跳）**：`housou/src/ws/tenko.ts` 全局 setInterval 遍历房间 publish GENJOU(projected)；index.ts main 启动；集成测试收到心跳。
- **PR3（客户端接线 + 收尾）**：useShinkou 显式 type 路由（SHINKOU 硬 / GENJOU→zureHosei）、nudge 回退跟踪；typecheck/lint/test/build 全绿；偏离回填 design §5。

## Technical Notes

- 参考实现（只读，禁拷 AGPL）：`synctv-web/src/plugins/sync.ts`（软校正/seek 真实写法）。
- 验证一律容器内 `./dx`（design §16），两个 ./dx 不可并发，起服务+驱动放同一 `./dx sh -c`。
- `zureHosei` 命名见 design §14/§15（DriftCorrection → zureHosei）。
- 心跳 timer 用 `app.server?.publish`（非 WS 上下文），仅 `import.meta.main` 启动避免 test 泄漏。
