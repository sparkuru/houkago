# 共享 URL 播放与第三方会话路线

- 对象：Houkago 的房间 URL 入队、共同播放与未来第三方账户会话能力。
- 范围与边界：记录已确认的产品边界、现有实现事实、后续依赖与安全决策；不记录平台搜索、推荐或内容采集方案。
- 最近更新：2026-07-18
- 状态摘要：公开来源的 URL 预览与确认入队已实现并待人工体验验收；账户绑定 session、可信共享、设备代理及完整 SSRF hardening 均为后续独立能力。

## 目标 / 资产清单

| 项 | 值 / 描述 | 状态 | 证据来源 |
| --- | --- | --- | --- |
| 当前任务 | 公开 / 无私密 session 的 URL 预览、确认入队与共同播放 | 已实现，待人工验收 | `.trellis/tasks/07-18-content-discovery/prd.md`; `packages/kyoushitsu/src/components/bangumi/EnmokuComposer.vue` |
| URL 解析器 | 通用直链/HLS/DASH 与公开 Bilibili URL 解析为 `Enmoku` | 确认 | `packages/eisha/src/resolver.ts`; `packages/eisha/src/parsers/bilibili.ts` |
| 房间队列 | `POST /bushitsu/:id/enmoku` 解析后持久化并广播 `BANGUMI` | 确认 | `packages/housou/src/routes/bushitsu.ts` 的 `createEnmoku` 与 `broadcastBangumi` |
| 房间同步 | `JOUEI` 选择当前片源；`SHINKOU` 负责播放、暂停、进度与速率 | 确认 | `packages/housou/src/ws/handler.ts`; `packages/housou/src/ws/shinkou.ts` |
| 账户身份 | 平台账户、个人中心、登录和第三方 session 绑定 | 待验证 | 当前任务 PRD 的 Product Decisions；当前仓库未实现账户系统 |
| 可信 session 共享 | 所有者主动把绑定会话提供给可信房间成员 | 待验证 | 当前任务 PRD 的 Product Decisions；用户产品决策（2026-07-18） |
| 发起者设备媒体代理 | 提交者使用自己的会话，从自己的设备向房间中继媒体 | 待验证 | 当前任务 PRD 的 Product Decisions；用户产品决策（2026-07-18） |

## 关键事实与发现

- **产品是 URL-first 的共同观看工具，不主动检索、推荐、采集或聚合第三方内容。** — 状态：确认
  - 证据：`.trellis/tasks/07-18-content-discovery/prd.md` 的 Product Decisions、Likely Out of Scope；用户产品纠正（2026-07-18）。

- **当前正式化目标只覆盖公开或无需私密 session 的来源。** — 状态：确认
  - 证据：`.trellis/tasks/07-18-content-discovery/prd.md` 的 Product Decisions、Requirements。

- **私密会话不能继续放在 `Enmoku.headers`。** — 状态：确认
  - 证据：`packages/housou/src/domain/bushitsu.ts` 会将 `input.headers` 写入 `Enmoku`；`packages/housou/src/db/queries/enmoku.ts` 将其序列化为 `headers_json`；房间节目通过 `BANGUMI` 同步。
  - 备注：未来 session 必须采用账户绑定、服务端私密存储、可撤销且有有效期的独立数据边界。

- **公开 URL 现在先只读预览，再由显式确认写入队列；旧 REST 入队端点仍保留给 legacy 调用。** — 状态：确认
  - 证据：`packages/housou/src/routes/bushitsu.ts` 的 `previewEnmoku` 与 `createEnmoku`；`packages/kyoushitsu/src/components/bangumi/EnmokuComposer.vue`。

- **REST 队列写入尚无服务端身份授权。** — 状态：确认
  - 证据：`packages/housou/src/routes/bushitsu.ts` 的 `ResolveEnmokuBody` 只接收调用方提供的 `addedBy`，创建路由未读取已认证主体或调用 `canDo`；`packages/housou/src/ws/handler.ts` 才对 `JOUEI` 与 `SHINKOU` 执行 WebSocket 权限门控。
  - 备注：当前任务只延续 `canPlaylist` 前端可见性和 WS 上映/进度门控；账户基础任务必须补足 REST 队列授权。

- **通用解析器会把非 HLS/DASH 的 HTTP(S) URL 暂视作直链，无法可靠区分普通网页。** — 状态：确认
  - 证据：`packages/eisha/src/resolver.ts` 的 `inferEnmokuType` 与 `resolveUrl`。

- **第一版需要只接受可验证直链媒体、HLS、DASH 和已支持的公开 Bilibili 视频链接；未知平台页面在预览阶段拒绝。** — 状态：确认
  - 证据：`.trellis/tasks/07-18-content-discovery/prd.md` 的 Product Decisions、Acceptance Criteria；用户产品决策（2026-07-18）。

- **第一版只允许公网来源，拒绝 loopback、私有网段和链路本地地址。** — 状态：确认（首版字面量拦截已实现）
  - 证据：用户产品决策（2026-07-18）；`packages/eisha/src/proxy.ts` 的 `assertPublicHttpUrl`；`packages/eisha/test/resolver.test.ts`。
  - 限制：当前不做 DNS A/AAAA 校验、不跟随 redirect，也未将校验覆盖到 legacy proxy token/HLS 子资源运行时路径；这不能视为完整 SSRF 防护。

- **默认 URL 提交只入队；“加入并切换到房间播放”是明确的二级操作。** — 状态：确认
  - 证据：`.trellis/tasks/07-18-content-discovery/prd.md` 的 Product Decisions；用户产品决策（2026-07-18）。

- **`JOUEI` 与 `SHINKOU` 的权限和行为必须分开理解。** — 状态：确认
  - 证据：`packages/housou/src/ws/handler.ts` 分别按 `playlist` 与 `playback` 门控；`packages/housou/src/ws/shinkou.ts` 表明切源会重置为暂停。
  - 备注：二级操作定为“加入并切换到房间播放”，只执行来源切换；实际播放仍由播放控制权和浏览器参加手势决定。

- **预览应是只读步骤，确认后才创建队列项。** — 状态：确认
  - 证据：`.trellis/tasks/07-18-content-discovery/prd.md` 的 Product Decisions、Acceptance Criteria；用户产品决策（2026-07-18）。

- **桌面房间必须在左侧工作区内保留可达的纵向滚动，且不能把空闲视口高度强加给番组表。** — 状态：确认
  - 证据：用户提供的桌面高度回归截图（2026-07-18）；`BushitsuView.vue` 既有 fixed-viewport 与 `room-workbench` flex 布局。
  - 决定：聊天列继续固定，左侧 `stage` 承担必要的纵向滚动；播放器保持 16:9，工作区按内容高度。

- **首次入房慢主要来自懒加载房间视图及播放器依赖的冷缓存；入室后的两项 REST 读取也曾串行。** — 状态：确认
  - 证据：`router.ts` 对 `BushitsuView` 使用动态 import；生产构建的房间视图 chunk 包含 ArtPlayer/HLS/Dash 依赖；`BushitsuView.vue` 原先依次读取房间与番组表。
  - 决定：主页在用户入房意图时预取同一视图模块，`enterRoom` 并行开始两项读取，同时仍先处理房主身份后再决定是否发送 `OIKAKE`。

- **显示标题应允许房间局部覆盖。** — 状态：确认
  - 证据：`.trellis/tasks/07-18-content-discovery/prd.md` 的 Product Decisions、Acceptance Criteria；`packages/eisha/src/resolver.ts` 的 URL 回退标题逻辑。

## 假设台账

- **未来账户会话需要专门的加密私密存储、有效期、撤销与审计能力。** — 状态：待验证
  - 证实判据：账户/session 任务完成安全模型与数据模型设计，并通过秘密不出现在 REST/WS/浏览器数据中的测试。
  - 证伪判据：明确采用不在服务端存储的会话架构，且能满足个人会话与可信共享需求。
  - 当前倾向：需要服务端私密存储；可信共享和设备代理都无法安全地复用现有 `Enmoku` 元数据。

- **发起者设备代理需要单独的传输和连通性方案。** — 状态：待验证
  - 证实判据：选定 WebRTC/隧道/中继架构，定义 NAT、带宽、在线状态、断线与授权语义。
  - 证伪判据：产品明确不再支持由提交者设备转发媒体。
  - 当前倾向：独立实现；它受提交者上行带宽和设备存活直接约束。

- **源站 401/403 不一定只表示缺少登录会话。** — 状态：待验证
  - 证实判据：解析器为各支持平台提供可区分的授权、地域、下架、速率限制和临时故障状态。
  - 证伪判据：所有首批支持来源均能可靠地以该状态代表需要账户会话。
  - 当前倾向：预览文案必须保守地表达“需要账户会话或来源当前不可访问”，不能把所有拒绝都说成可通过登录解决。

## 决策与权衡

- **发现模式**：选 URL-first；否决平台关键词搜索、推荐、索引与爬虫。
  - 原因：用户主动带来内容；核心价值是同一视频的共同观看、分享和聊天。
  - 性质：偏好驱动。

- **当前交付顺序**：先做无私密会话 URL 流程；账户和 session 能力拆为后续任务。
  - 原因：现有解析、队列与同步可形成可交付闭环，而当前没有身份或安全秘密边界。
  - 性质：事实与风险驱动。

- **会话模式路线**：保留个人会话、可信共享会话、发起者设备代理三种模式。
  - 原因：覆盖“每人自己的会话”、高信任共享与带宽受限的个人中继三种用户意图。
  - 性质：偏好驱动。

- **来源网络边界**：首版只接受公网来源；否决私网/本机 URL。
  - 原因：服务端代理任意网络 URL 会带来内网访问风险；局域网共享改由未来设备代理承担。
  - 性质：风险驱动。

## 踩坑 / 反直觉点

- **现象**：把 `headers` 当作“可先用的 session 存储”看似省事。
  - 根因：节目元数据会被持久化并同步给房间，私密会话与节目元数据的生命周期和可见范围不同。
  - 规避：未来 session 任务先定义私密数据通道和泄漏测试，再接入解析器和代理。

- **现象**：把任意 HTTP 页面都当作直链，会让无效内容进入番组表。
  - 根因：当前通用类型推断只靠 URL 路径扩展名，普通网页会落入 `direct`。
  - 规避：预览阶段验证来源类型，未识别的平台页面拒绝入队。

- **现象**：把“切换片源”理解成“所有客户端立即有声播放”。
  - 根因：`JOUEI` 切换后重置暂停，`SHINKOU` 才驱动播放；浏览器还要求部分参与者以手势加入音频播放。
  - 规避：操作与文案区分“入队”“切换到房间播放”“开始播放”“点击参加”，并在浏览器流测试中覆盖该路径。

## 当前焦点

- 完成公开 URL 的解析预览、确认入队、可选房间标题和“加入并切换到房间播放”实现，并进行人工体验验收。
- 将媒体有效性验证和字面量公网来源限制落入预览边界；完整 SSRF hardening 另行设计。
- 为后续账户会话能力保留明确接口边界，但不在本任务中存储或传输任何私密 session。

## 下一步行动

- **完成人工体验验收并决定是否提交当前任务。**
  - 触发条件：人工用真实公开媒体 URL 检查预览、入队和切换的文案与视觉体验。
  - 预期影响：确认温暖主题、媒体提供方兼容性和播放权限体验，再进入提交/归档。

- **创建“账户身份与第三方 session”后续任务。**
  - 触发条件：公开 URL 流程已交付，或产品需要支持任一登录态来源。
  - 预期影响：定义个人会话绑定、私密存储、过期/撤销以及“每人自用”播放模式。

- **创建“可信 session 共享”后续任务。**
  - 触发条件：账户 session 基础已完成，且明确共享者、受邀者、撤销和审计规则。
  - 预期影响：在高信任房间内安全地选择共享会话，而不泄漏原始凭据。

- **创建“发起者设备媒体代理”后续任务。**
  - 触发条件：产品确认需要局域网/私有媒体或由发起者上行中继，且已选定连通性方案。
  - 预期影响：支持设备代理，同时暴露带宽、在线和断线状态给房间。

- **创建“SSRF hardening / deployment”后续任务。**
  - 触发条件：公开 URL 流程进入生产或 proxy token/HLS 子资源将对不受信任的来源开放。
  - 预期影响：对 DNS A/AAAA、每一跳 redirect、proxy runtime 实施一致的地址校验，并以部署 egress 规则拒绝私网与 metadata 地址。

## 证据索引

- `.trellis/tasks/07-18-content-discovery/prd.md` → 支撑：当前交付范围、产品决策、验收标准。
- `.trellis/spec/backend/url-preview-contract.md` → 支撑：可执行 REST 合约、验证/错误矩阵、测试与 legacy/SSRF 边界。
- `packages/eisha/src/resolver.ts` → 支撑：通用 URL 类型推断与回退标题事实。
- `packages/eisha/src/parsers/bilibili.ts` → 支撑：公开 Bilibili URL 解析能力。
- `packages/eisha/src/proxy.ts` → 支撑：公开预览的字面量私网地址拒绝与完整 SSRF hardening 的边界。
- `packages/housou/src/routes/bushitsu.ts` → 支撑：新增只读 preview 与保留的 legacy 解析/入队 REST 流程。
- `packages/housou/src/domain/bushitsu.ts` 和 `packages/housou/src/db/queries/enmoku.ts` → 支撑：`Enmoku.headers` 持久化事实。
- `packages/housou/src/ws/handler.ts` 和 `packages/housou/src/ws/shinkou.ts` → 支撑：`JOUEI`/`SHINKOU` 权限和暂停重置语义。
- `packages/kyoushitsu/src/components/bangumi/EnmokuComposer.vue` → 支撑：番组表中的两步链接 composer 与显式入队/切换操作。
