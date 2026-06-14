# NTP-lite 时钟偏移：修跨机 B 端加速/超前

## Goal

跨机器实跑时 B 端有时会加速、跑到比房主 A 还前的进度。根因是 design §5 v1 简化「直接信任服务器时钟、不做 client offset 校正」：投影用 B 机器的 `Date.now()` 减服务器 `serverTime`，若 B 机器墙钟与服务器墙钟有偏差 O，投影目标整体偏移 O → B 追一个偏前的目标 → 软校正(zure nudge ±5%)把 B 加速并稳定停在 A 前面。实现 design §5 预留的 NTP-lite 时钟偏移估计。

## Root Cause（已诊断）

- `composables/useShinkou.ts` `projected(s, serverTime) = s.currentTime + (Date.now() - serverTime)/1000 * rate`。`Date.now()` 是客户端墙钟，`serverTime` 是服务器墙钟。两钟偏差 O 直接进投影。
- LAN 上 O 可达秒级(RTC 未同步)，远大于单向传输延迟(~1ms)。zure 三档(zure.ts)的 nudge 软校正会持续追这个偏移目标 → B 系统性超前 + 忽快忽慢。

## Decision (ADR-lite)

**Context**: 需估客户端↔服务器时钟偏移 offset，投影时扣除。两种测法。
**Decision**: **被动估计（零协议改动）**——从每条 S→C 消息的 `msg.ts`(服务器墙钟) 减客户端收到时刻 `Date.now()` 得 offset 样本，取窗口内最大样本(=最小单向延迟那条，offset 被低估最少)。残差≈单向延迟(LAN ~1ms 可忽略)。投影改用 `Date.now()+offset` 当服务器时刻。
**Consequences**: 不动 kousoku 协议/housou，纯客户端改造，最契合当前 LAN 跨机问题。WWAN 高延迟下残差=单向延迟会偏大，但本任务范围 LAN；后续要 WAN 再上 ping/pong(已记于 Out/备选)。offset 用「窗口最大样本」抗抖动，避免单条网络抖动致反复 seek。

## Requirements（部分待选型）

1. 客户端估计 offset = serverClock − clientClock；投影改用 `clientNow + offset` 当服务器时刻：`projected = s.currentTime + ((Date.now()+offset) − serverTime)/1000 * rate`。
2. offset 估计要稳(避免单条抖动)：多样本平滑/取最优(min-RTT 或 min/中位)；连接后尽快得到首个 offset，并随消息更新。
3. 修复后:B 与 A 进度一致，不再系统性超前/加速;zure 软校正只处理真实播放漂移而非时钟偏移。
4. 不破坏房主权威、JOUEI、catchUp/seek、zure 三档逻辑(仅投影输入的时间基准变准)。

## Acceptance Criteria

- [ ] 人为制造 B 机器墙钟偏差(或逻辑测试注入 offset)后，B 投影目标仍对齐 A 实际进度，不系统性超前。
- [ ] 正常 LAN 跨机:A、B 进度一致、B 不再无故加速/超前。
- [ ] offset 估计稳定不抖动致反复 seek/nudge。
- [ ] 容器内(./dx) typecheck/lint/build 全绿；housou+kyoushitsu test 不回归并补 offset 估计/投影纯函数用例。

## Out of Scope

- 完整 NTP（多轮统计、时钟漂移率补偿）；本任务只做一阶 offset。
- guest 权限 epic、断线重连。

## Technical Notes

- 被动估计:每条 S→C 消息 `offset_sample = msg.ts − clientRecvNow`(误差 = −单向延迟，LAN ~1ms 可忽略)；取窗口内 max(=最小延迟样本,offset 被低估最少) 或平滑。投影/估计抽纯函数便于测。
- 主动:新增 PING{t0}/PONG{t0,t1}，client: rtt=t2−t0, offset=t1−(t0+t2)/2，留 min-rtt 样本。协议(kousoku messages) + housou handler + 客户端定时。
- offset 存于 useShinkou 或 store(sync 基础设施)；projected 单点改造。
- 验证用 ./dx（禁裸 docker）。跨机实跑由用户最终确认。
