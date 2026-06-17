# guest 权限 epic 阶段2:入房控制(开放/审批/关闭)

## Goal

在阶段1的两层角色与房间级权限开关之上，补齐 synctv 式入房控制：房主可以选择房间是开放加入、需要审批加入，还是关闭加入。guest 进入房间前由服务端门控；前端提供等待/拒绝/审批 UI，避免未获准用户先进入房间再被动隐藏功能。

## What I already know

- 阶段1已完成两层角色：部長(host) 与 ゲスト，其余个体提升、账号鉴权、持久化均在后续之外。
- 阶段1已完成房间级 `KENGEN`/`SETTEI`，并实现服务端强制 + 前端 UI gating。
- 现有 WebSocket 入房生命周期在 `packages/housou/src/ws/handler.ts` 的 `open()` 中直接 `join()` roster 并广播 `SHUSSEKI`。
- 现有前端 `BushitsuView.vue` 在昵称 gate 后立即 `client.connect(...)`，再拉房间信息、发 `OIKAKE`、加载番組表。
- 现有 name gate 是“连接前”浮层，播放器 join-gate 是“连接后/播放前”浮层；入房控制应放在二者之间或替代连接结果状态。
- 现有权限面板 `KengenPanel.vue` 是 host-only 三 toggle，适合扩展成“ゲスト権限 + 入室設定”同一房主工具区，或拆出相邻组件。
- 既有测试覆盖 `KENGEN` 默认下发、`SETTEI` 鉴权、guest 越权拒绝、store 派生权限。

## Assumptions

- MVP 继续使用内存态，不做 DB 持久化；房间级策略在服务进程内按 room id 保留，服务重启后回默认。
- 默认入房策略为开放，保持当前分享链接即点即进的行为不回归。
- 房间不是“房主在线才存在”。房间记录里的 `buchouId` 是所有者/权限制定者身份，不是在线生命周期开关。
- 已入房成员在房主离线后继续留在房间，并按当前房间权限聊天、播放控制、选源。
- 房主永远允许进入自己的房间，不受入房策略限制；房主回来后能看到并处理 pending 审批。
- “关闭加入”只拒绝新的 guest；已在房内的人不被踢出。
- “审批加入”只覆盖新连接的 guest；已在房内的人不需要重新审批。

## Requirements

1. 协议(kousoku)：新增房间入房策略快照与审批消息。
   - `NYUUSHITSU` 或同类 S→C 快照：`{ mode: "open" | "approval" | "closed" }`。
   - `NYUUSHITSU_SETTEI` 或复用 `SETTEI` 的扩展形态：host-only 设置入房策略。
   - 审批流消息：guest 请求加入、host 收到待审批请求、host 批准/拒绝、guest 收到批准/拒绝结果。
2. 后端(housou)：在 WS open 阶段执行入房门控。
   - host 直接加入。
   - mode=open：guest 直接加入，行为与当前一致。
   - mode=closed：guest 不进入 roster，不广播 `SHUSSEKI`，向该 socket 返回拒绝状态/`KEIHOU` 后安全关闭或保持拒绝页状态。
   - mode=approval：guest 不进入 roster，进入 pending 队列；若 host 在线则收到审批请求，若 host 离线则 guest 继续等待；host 回来后能看到 pending 请求。批准后该 guest 才 `join()` 并收到当前 `SHUSSEKI`/`KENGEN`/`GENJOU` 所需快照；拒绝则返回拒绝状态。
   - 入房策略不跟随 roster 空亡清理；pending 请求随对应等待连接断开而移除，避免断开的等待者残留。
3. 前端 store：存当前入房策略、本人入房状态和待审批列表。
   - 入房状态至少区分：未连接/等待审批/已进入/被拒绝/房间关闭。
   - 待审批列表只对 host 有意义，包含 senderId、nickname、请求时间。
4. 前端 UI：
   - host 可切换入房策略：开放 / 需要承认 / 关闭。
   - host 在审批模式下看到 pending guest，并可批准/拒绝。
   - guest 在审批模式下看到等待 UI；批准后进入既有房间流程，拒绝后看到明确状态。
   - guest 在关闭模式下看到关闭提示，不进入播放器/聊天/番組表。
   - 现有 name gate、autoplay join-gate、KengenPanel、ChatPanel、同步逻辑不被破坏。
5. 服务端仍是最终权限来源；前端 UI 只作体验层，不能靠客户端自报绕过入房策略。

## Acceptance Criteria

- [ ] 默认 open 模式下，现有双端入房、昵称、SHUSSEKI、KENGEN、OIKAKE、播放同步行为不回归。
- [ ] 房主切到 closed 后，新 guest 不能进入 roster，房内人数不增加，guest 端看到关闭提示。
- [ ] 房主切到 approval 后，新 guest 进入等待状态；host 端出现审批请求；host 批准后 guest 才进入房间并获得当前权限/播放状态；host 拒绝后 guest 看到拒绝提示。
- [ ] approval 模式下 host 离线时，新 guest 不被直接拒绝，而是保持等待；host 重新连接后能看到待审批请求并处理。
- [ ] 非 host 不能修改入房策略，也不能审批他人。
- [ ] 已在房内 guest 不因 host 切换 open/approval/closed 被踢出。
- [ ] 入房策略在房主离线/房间暂空时仍保留；pending 审批在等待 guest 断开后移除，不残留已断开的请求。
- [ ] 容器内 `./dx typecheck`、`./dx lint`、`./dx build` 通过；补 housou WS e2e 与 kyoushitsu store/纯函数测试。

## Definition of Done

- Tests added/updated for protocol, server gate, approval decisions, store state, and key UI-derived pure functions.
- Lint / typecheck / build green through `./dx` commands.
- New behavior documented in this PRD and any discovered spec convention captured if needed.
- Rollback path clear: disabling UI and defaulting mode to open restores current behavior.

## Out of Scope

- 账号体系、登录鉴权、跨设备身份绑定。
- DB 持久化入房策略或审批记录。
- 个体权限提升/有权审批者/管理员角色、踢人、封禁、黑名单。
- 邀请链接带 token、一次性入场码、密码房。
- 已在房内成员因策略变化被自动踢出。
- 三层角色或真正的“部員”提升模型。

## Technical Approach

推荐沿用阶段1模式：协议增加入房控制消息，housou 持有 per-room in-memory state，服务端在 WS open/message 处强制，kyoushitsu store 接收 server-truth 快照并驱动 UI。

关键设计点：

- 入房策略和 pending 队列放在 housou 侧独立 `lib/nyuushitsu.ts` 或类似模块，形状仿 `lib/kengen.ts`，提供纯函数/小状态机便于测试。
- `open()` 不能对待审批 guest 立即调用 `join()`；否则 `SHUSSEKI`/聊天/同步都会把未批准者当成已入房。
- 对待审批 socket 需要保留连接态，便于批准后原连接转正；拒绝/关闭可发送明确消息后关闭，或保持只显示拒绝状态。
- host 的审批消息需要广播/单发到 host 连接；若多个 host 连接/同 senderId 多窗口，MVP 可广播给当前房内所有 host senderId 匹配连接。
- 前端 `BushitsuView` 的启动流程要拆成：昵称确认 → 连接/等待入房结果 → 进入后 bootstrap 番組表/OIKAKE/watch。

## Decision (ADR-lite)

**Context**: 阶段1已经把“进入房间后的 guest 能做什么”抽成房间级权限，但“guest 能不能进入房间”仍是无条件开放。入房控制要比 UI gating 更早，在服务端 roster 之前发生。同时，房间不应与房主在线状态强绑定；房主是权限制定者，不是房间存活条件。

**Decision**: 阶段2采用房间级三态入房策略：open / approval / closed。策略和 pending 审批保存在后端内存，host 通过消息更新，guest 连接时由服务端决定直接进入、等待审批或拒绝。approval 模式下 host 离线不会自动拒绝，pending 请求保留到 host 回来处理；已入房成员继续按当前权限使用房间。

**Consequences**: 行为更贴近 synctv：房间可在房主离线时继续运转，新 guest 是否进入由既有入房策略决定。缺点是 approval 模式可能出现长时间等待；MVP 用明确等待 UI 表达，不自动拒绝。因为状态只保存在内存里，服务重启后回到默认开放，审批请求也会丢失。账号、封禁、邀请 token 等高级控制留后续。

## Open Questions

- Resolved: MVP 只允许房主审批入房；“有权审批者”、管理员、三层角色留后续。

## Technical Notes

- Primary files inspected:
  - `packages/kousoku/src/messages.ts`
  - `packages/kousoku/src/domain.ts`
  - `packages/housou/src/ws/handler.ts`
  - `packages/housou/src/ws/housou.ts`
  - `packages/housou/src/lib/kengen.ts`
  - `packages/kyoushitsu/src/stores/bushitsu.ts`
  - `packages/kyoushitsu/src/views/BushitsuView.vue`
  - `packages/kyoushitsu/src/components/kengen/KengenPanel.vue`
- Relevant prior PRD: `.trellis/tasks/archive/2026-06/06-14-role-permissions/prd.md`
- Relevant specs:
  - `.trellis/spec/backend/index.md`
  - `.trellis/spec/frontend/index.md`
  - `.trellis/spec/frontend/state-management.md`
  - `.trellis/spec/frontend/component-guidelines.md`
  - `.trellis/spec/backend/error-handling.md`
  - `.trellis/spec/backend/quality-guidelines.md`
