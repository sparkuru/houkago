# 中途加入追平 + 离开后昵称保留 两 bug 修复

## Goal

实跑暴露两个 join/leave 正确性 bug：(1) 成员离开后其历史消息在他人处变回 uuid；(2) 部員中途加入点遮罩后从头播放、不追平 A 进度，必须 A 手动暂停/播放一次才进入正常同步。

## Bug 1：离开后昵称丢失（已定位，修法清楚）

- 现象：成员离开，其在聊天/弹幕里的历史消息 sender 从昵称变回 uuid。
- 根因：`stores/bushitsu.ts` apply SHUSSEKI 用 `roster.value = next` **整表重建**，离开者从 members 名单消失 → roster 丢该 senderId → `nicknameOf` 回退 uuid。
- 修法：SHUSSEKI 时把 members **合并**进 roster（名字累积、不删除离开者），出席计数仍用 `n`。roster 仅用于显示名，累积无害。

## Bug 2：中途加入不追平（需运行时确认根因后修）

- 现象：A 已播放中，B 加入→输名→点遮罩→B 从 0 播放，与 A 不同步；必须 A 暂停再播放一次（A 发 SHINKOU），B 才追平并此后正常同步；后续再加入也正常。
- 已排除：catchUp/applyShinkou/applyGenjou 客户端逻辑读下来正确；OIKAKE 在 startSession 中有发。
- 关键线索：「必须 A 手动 toggle（SHINKOU）才恢复」强烈暗示**周期心跳 GENJOU 没有真正驱动 follower**——否则 B 应在 ≤4s（一个 tick）内自动追平，无需 A 操作。两个待确认根因：
  - **(A) 心跳投递**：`ws/tenko.ts` setInterval 用 `app.server?.publish(topic, ...)`（非 WS 请求上下文）。需运行时确认该 publish 是否真送达房间 WS 订阅者；若 Bun/Elysia 此上下文 publish 不生效，follower 永远收不到周期 GENJOU，只能靠 A 的 SHINKOU(handler 内 ws.publish，正常) 恢复——与现象吻合。
  - **(B) 早 seek 失效**：B 刚挂载、hls.js 尚未可 seek 时，@ready 的 catchUp `art.seek` 不生效（被重置回 0）；点遮罩 safePlay 从 0 起播；若心跳又不驱动，则一直停在 0。
- 期望行为：B 中途加入并点遮罩后，立即追平到 A 当前进度并持续同步，**无需 A 手动操作**；后续加入者同样。

## Requirements

1. Bug1：SHUSSEKI 合并 members 进 roster（不丢离开者名字）；出席计数不回归。
2. Bug2：确认心跳 GENJOU 是否送达 follower（运行时验证，必要时给 tenko/handler 加临时日志看 /tmp/houkago-dev.log，或在 dev 容器网络内连 WS 探测）。
   - 若心跳投递坏：修复 publish 使周期 GENJOU 真正到达房间订阅者。
   - 使中途加入的 catch-up seek 在媒体可 seek 后可靠生效（如 join 后/媒体 canplay 后再 apply 一次权威位置，或重试 seek），不依赖 A 手动 toggle。
3. 不破坏房主权威、JOUEI 源同步、既有已连通后的双向同步、昵称显示、autoplay join-gate、nameGate。

## Acceptance Criteria

- [ ] 成员离开后，其历史聊天/弹幕消息仍显示昵称（不回退 uuid）；出席计数正确。
- [ ] A 播放中 B 加入并点遮罩后，**无需 A 操作**即追平到 A 当前进度并持续同步。
- [ ] 后续加入者同样自动追平。
- [ ] 房主/源同步/双向同步/昵称/gate 不回归。
- [ ] 容器内(./dx) typecheck/lint/build 全绿；housou+kyoushitsu test 不回归并补关键用例。

## Out of Scope

- 断线重连、NTP-lite 时钟偏移、房间控制权限、全屏 UI 调优。

## Technical Notes

- 运行时验证一律走 ./dx（强约束，禁裸 docker）。dev 容器到宿主 :3000 不通（docker 网络隔离），探测需在 dev-server 容器内或加日志看 /tmp/houkago-dev.log。
- 心跳：`ws/tenko.ts` startTenko(app) 在 index.ts app.listen 后调用；`activeRooms()`(=roster keys) + `shinkouSeigyo.has()` 门控。
- 客户端同步：`composables/useShinkou.ts`（catchUp/applyShinkou/applyGenjou/handleRemote）、`components/player/EnmokuPlayer.vue`（apply/safePlay/seek/onJoin）、`views/BushitsuView.vue`（startSession/onJoin/@ready）。
- 双端实跑最终由用户确认。
