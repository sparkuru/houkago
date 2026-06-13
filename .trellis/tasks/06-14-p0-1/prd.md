# P0 纵切1：单房间房主权威同步端到端

## Goal

把 design.md §5 同步核心的第一条端到端链路跑通：单个部室内，**部長(host) 的播放操作（play/pause/seek/ratechange）经 SHINKOU 广播 → 部員 应用并抑制回声**，且**迟到部員 进房后经 OIKAKE→GENJOU 投影追平**。P0「证明同步」的最小纵切，验证房主权威模型与追平投影正确性，不含漂移校正调参。

## What I already know（scaffold 现状）

- `kousoku` 已定义全套 WS 协议 envelope（§4 全表）+ `Bushitsu.buchouId` / `Yakuwari(buchou|buin|kengaku)` / `Shinkou` 模型。
- `housou`：REST 建房（创建者 id → `buchouId`）、WS hub pub/sub、`ShinkouSeigyo`（存权威态 + `projected()`）、OIKAKE→GENJOU 通道、presence(SHUSSEKI)。OSHABERI/DANMAKU 已 echo 通；`NotBuchou` 错误类 + onError 映射已在。
- `housou` 挂点：`handler.ts` SHINKOU 接受**任意**连接并广播（未校验 buchou）；TENKO no-op。
- `kyoushitsu`：`KousokuClient` 骨架、`EnmokuPlayer`（ArtPlayer+hls.js）、store（`apply()` 已落 GENJOU/SHINKOU）。同步算法未接线。

## Requirements

- 服务端：SHINKOU 仅接受 `senderId === bushitsu.buchouId`；非部長 → `throw NotBuchou` → KEIHOU 发回发送者，不广播、不断连。`ShinkouSeigyo` 接 `buchouId` 做纯权威判定（可脱 socket 单测）。
- 服务端：GENJOU 携带 `serverTime`（已具备），投影在客户端算。
- 客户端：进房拉 `GET /bushitsu/:id` 得 `buchouId`，store 记 `isBuchou = senderId === buchouId`。
- 客户端（部長）：播放器 play/pause/seek/ratechange → 发 SHINKOU。
- 客户端（部員）：收 SHINKOU → 应用到播放器 + `tsuijuuChuu` 回声抑制 ~200ms；本地播放操作不广播。
- 客户端（部員）：NYUUBU 后发 OIKAKE → 收 GENJOU → 用 `serverTime` 算 `projected` → seek 并按 isPlaying 播/停。

## Decision（切片边界已收敛）

- 漂移校正（TENKO 周期 + zure 分级）→ **第二片**，本片 TENKO 仅占位。理由：§11「先把模型做简单做对」，zure 调参需真实多端环境。
- 聊天/弹幕 → 本片**只验同步**，保持 scaffold echo 现状，不接前端 UI。
- 非部長 SHINKOU → **KEIHOU**（非静默丢弃）。依 backend/error-handling spec「房主权威是错误而非静默 no-op，让客户端知道动作被拒」。正确部員客户端本就不广播本地事件，KEIHOU 仅在异常/恶意客户端触发。
- 身份 P0 简化：前端生成 `buinId`（localStorage 持久），建房即 `buchouId`；无真鉴权（OAuth/JWT → P4）。
- 时钟对齐走 §5 v1 简化：信任 host.currentTime + 单程延迟补偿（暂忽略或 RTT/2），不做 NTP-lite clockOffset。

## Acceptance Criteria

- [ ] `ShinkouSeigyo` 权威判定（部長记录/非部長抛 NotBuchou 且状态不变）+ `projected` 投影（停=currentTime、播=currentTime+elapsed*rate）脱 socket 单测。
- [ ] 容器内 `./dx` 起 housou + 驱动两 WS 客户端（buchou + 迟到 buin），断言 buin 收到 buchou 的 SHINKOU 广播；非 buchou 发 SHINKOU 收到 KEIHOU 且不广播给他人。
- [ ] typecheck / lint / test 全绿（容器内实跑）。

## Definition of Done

- 同步纯逻辑单测；端到端 ./dx 实跑证据。
- Lint / typecheck / test green（容器内）。
- design.md §5 若有偏离则回填说明。

## Implementation Plan（小步）

- **PR1（服务端权威 + 纯逻辑单测）**：`ShinkouSeigyo.shinkou()` 接 `senderId`+`buchouId`，非部長抛 `NotBuchou`；`handler.ts` SHINKOU 经 domain 取 buchouId、message 体集中 catch 域错误→KEIHOU 发回发送者。`test/shinkou.test.ts` 覆盖权威 + 投影。
- **PR2（客户端进行制御接线）**：进房拉 buchouId 定 `isBuchou`；EnmokuPlayer 接 store——部長事件→SHINKOU、部員 SHINKOU→应用+`tsuijuuChuu`、OIKAKE→GENJOU→投影 seek。
- **PR3（端到端验证 + 收尾）**：`./dx` 起 housou + 驱动两 WS 客户端断言追平与权威拒绝；typecheck/lint/test 全绿；偏离回填 design §5。

## Out of Scope

- 漂移校正调参、WebRTC、鉴权、解析器/代理(eisha)、弹幕文件/抓取(kokuban)、多演目队列切换。

## Technical Notes

- 参考实现（只读，禁拷 AGPL）：`synctv-web/src/plugins/sync.ts`（回声抑制/seek 追平真实写法）、`control.ts`（播放器事件↔同步接线）。
- 验证一律容器内 `./dx`（design §16），两个 ./dx 不可并发，起服务+驱动放同一 `./dx sh -c`。
- WS message 体内域错误无 onError 兜底（onError 仅 HTTP / WS 校验），故 message() 内置 try/catch 映射 code→KEIHOU，等价 WS 通道的集中错误映射。
