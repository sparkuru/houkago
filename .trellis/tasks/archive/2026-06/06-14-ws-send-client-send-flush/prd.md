# 修复 WS send 未连通抛错致放映断（client send 缓冲 flush）

## Goal

JOUEI 源同步上线后出现回归：房主点「再生」整页报错、视频不播。修复 WS 客户端在连接未就绪时发送消息的脆弱性。

## Root Cause（已勘定）

- `packages/kyoushitsu/src/ws/client.ts` 的 `send()` 直接 `this.ws?.send(...)`，不检查 `readyState`。WebSocket 处于 CONNECTING(0) 时 `send()` 抛 `DOMException: InvalidStateError`（"object is not, or is no longer, usable"）。HMR 重连 / 进房瞬间点再生都会触发。
- 与新 `playManual` 叠加成可见故障：房主 playManual 把 `client.send(JOUEI)` 放最后，且**房主不再直接设 current**（依赖 JOUEI echo→store.enmokuId watch）。send 一抛 → JOUEI 没发 → store.enmokuId 不变 → applyEnmokuId 不跑 → current 恒 null → 视频不播。旧版直接设 current 故未暴露此竞态。

## Requirements

1. `KousokuClient.send()` 健壮化：WS 为 OPEN 时立即发；CONNECTING 时**缓冲**消息，`open` 事件触发后按序 flush；CLOSING/CLOSED 时安全丢弃不抛。
2. `connect()` 注册 `open` 监听器 flush 缓冲队列；`close()` 清空队列与监听。
3. 不改变正常已连通时的发送行为（不回归 OSHABERI/SHINKOU）。

## Acceptance Criteria

- [ ] 房主进房后点再生（即便 WS 刚连）不再抛错，JOUEI 正常下发，视频播放。
- [ ] HMR 重连后发送不抛 InvalidStateError。
- [ ] OSHABERI/SHINKOU 正常发送不回归。
- [ ] 补单测：CONNECTING 时 send 入队、open 后按序 flush、CLOSED 时不抛。
- [ ] 容器内 typecheck/lint/build 全绿；kyoushitsu test 不回归。

## Out of Scope

- 断线自动重连 / 指数退避 / 离线持久化（独立任务）。
- 发送失败的用户可见提示（KEIHOU UI）。

## Technical Notes

- 缓冲为内存数组，仅覆盖 CONNECTING→OPEN 窗口；不做跨重连持久化。
- 测试可用 mock WebSocket（手动控制 readyState 与触发 open 事件）；参考既有 kyoushitsu 测试风格。
- 验证：容器内 `./dx`（端口被 dev-server 占用时用等价无端口 docker run）。
