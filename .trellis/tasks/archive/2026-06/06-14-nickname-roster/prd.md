# 昵称显示：聊天/弹幕气泡显 nickname 而非 senderId(uuid)

## Goal

聊天框与弹幕气泡当前显示 `senderId`(uuid)，应显示用户昵称。打通 nickname 从进房到展示的链路。

## What I already know（现场已勘）

- 协议已备料：`NYUUBU{nickname}`（C→S 入部）、`BuinSchema{id,bushitsuId,nickname,yakuwari}` 都在。
- HomeView 收集 nickname → `store.nickname`，导航进房；但 **BushitsuView.connect 只传 senderId、从不发 NYUUBU**。
- housou `ws/housou.ts` presence 仅维护 per-room **计数**(Map<bushitsuId,number>)，不存 senderId→nickname。open() 发 `SHUSSEKI{n}`。
- 显示点：ChatPanel `{{ line.senderId }}`、DanmakuOverlay `{{ b.senderId }}`，均 uuid。
- WS client.send 已支持连接前缓冲(connect 后即可 send)。

## Requirements

1. `client.connect` 把 nickname 作为 `?nickname=` query 参数传到 housou `/ws`；BushitsuView 传入 `store.nickname`。
2. housou 维护 per-room roster(senderId→nickname)，按 ws.id→conn 在 open 加入、close 移除；`SHUSSEKI` 负载扩为 `{n, members:[{id,nickname}]}`，open/close 广播全房（含回发自己）。
3. kousoku `ShussekiSchema` 扩展；store apply SHUSSEKI 同时更新 `shusseki` 计数与 `roster` 映射。
4. store 暴露 `nicknameOf(senderId)`（缺失回退 senderId）；ChatPanel、DanmakuOverlay 改用之。
5. 自己发的消息也经 roster 显示自己昵称。

## Acceptance Criteria

- [ ] A、B 进房后，聊天与弹幕气泡显示对方昵称而非 uuid。
- [ ] 新进者看到房内既有成员昵称；老成员看到新进者昵称。
- [ ] 成员退出后其 roster 项移除（计数与名单一致）。
- [ ] 昵称缺失时回退显示 senderId，不报错。
- [ ] 容器内(./dx) typecheck/lint/build 全绿；housou+kyoushitsu test 不回归并补关键用例。

## Out of Scope

- 昵称改名/重名消歧/头像。
- 昵称持久化到 DB（roster 为内存态，与 presence 同）。
- 房间控制/权限、全屏 UI 调优（各自独立任务）。

## Decision (ADR-lite)

**Context**: nickname 需从进房到达全房并随成员增减更新。两处选型。
**Decision**:
1. **nickname 传输 = connect query 参数**：`client.connect` 把 `nickname` 随 `senderId` 一起作为 `?nickname=` 查询参数传给 `/ws`。housou `open()` 即有昵称，原子加入 roster + 广播，无"进场到报名"窗口。NYUUBU 消息暂不依赖（保留协议定义）。
2. **roster 下发 = 扩展 SHUSSEKI**：`SHUSSEKI` 负载从 `{n}` 扩为 `{n, members: [{id, nickname}]}`。SHUSSEKI 即 presence 全量快照（计数+名单），open/close 时广播。复用现有 presence 通道，改动最小。
**Consequences**: SHUSSEKI 契约扩展（kousoku schema + housou 构造 + store apply 同步改）。roster 服务端内存态，与 presence 同生命周期（按 ws.id→conn 在 close 清理）。query 传昵称对改名不友好，但本任务不含改名（Out of Scope）。

## Technical Notes

- senderId 已作为 connect query 参数传输；roster 服务端为内存 Map，按 ws.id→conn 在 close 清理（与 presence 一致）。
- 显示层加一个 `nicknameOf(senderId)` 帮助（store getter 或纯函数），ChatPanel/DanmakuOverlay 共用。
- 验证用 ./dx（强约束，禁裸 docker）。双端实跑由用户确认。
