# 技术设计：公开 URL 预览、入队与房间切换

## 范围

本任务把现有开发直链表单替换为房间 `Bangumi` 中的两步 URL composer：

```text
输入 URL + 可选显示标题
  → 只读预览（来源策略、解析、媒体验证）
  → 加入队列 / 加入并切换到房间播放
  → BANGUMI / JOUEI 既有同步
  → 播放控制者在播放器中开始播放；其他成员按浏览器要求点击参加
```

它只处理公开、无需私密账户会话的媒体。身份、账户 session、可信 session
共享和设备代理不进入本次数据模型、REST、WS 或浏览器状态。

## 边界与不变量

- `eisha` 继续拥有 URL 判断、上游请求、Bilibili/HLS/DASH 解析和代理细节。
- `housou` 只编排预览/入队、持久化与 `BANGUMI` 广播；不复制解析规则。
- `kyoushitsu` 不解析第三方页面，也不保存媒体或 session 真相；它只驱动局部 composer
  UI，并从 REST/WS 接收权威的 `Enmoku`。
- 预览绝不写数据库，也绝不广播 `BANGUMI`。确认入队会重新在服务端解析 URL，不能信任
  浏览器回传的预览元数据或代理地址。
- `JOUEI` 只选择房间当前节目并重置为暂停；`SHINKOU` 才是播放、暂停、进度和速率权威。
- session、cookie、authorization header 不得进入新的预览响应、`Enmoku`、REST 请求体、WS
  信封或前端状态。现有 legacy `headers` 路径不作为本功能的输入。

## 公开 URL 策略与上游安全

### 公共 URL 门

首版新增 `eisha` 的公开 URL 字面量校验，供新预览调用：

1. 仅允许 `http:` / `https:`。
2. 规范化主机名并拒绝 `localhost`、本机名、IPv4/IPv6 loopback、RFC1918 私网、
   link-local、carrier-grade NAT、unspecified、multicast 与 IPv4-mapped IPv6。
3. 预览请求禁止自动重定向；当前会拒绝重定向响应，而不是跟随未知下一跳。

这只是首版产品入口的限制，不能等同于完整 SSRF 防护：域名 A/AAAA 校验、每跳受限的
重定向跟随、proxy token 与 HLS 子资源的运行时校验、以及部署网络出口规则，必须在独立
的 SSRF hardening / deployment 任务中一起完成。legacy source URL REST 路径也仍保持兼容，
并不由本次 composer 暴露。

### 可播放来源识别

预览返回三类结果：

| 状态 | 条件 | 可否入队 |
| --- | --- | --- |
| `ready` | 公开 Bilibili URL 解析成功，或直链/HLS/DASH 通过类型验证 | 可以 |
| `session-required` | 支持的解析器能够明确识别为需要未来账户会话 | 不可以 |
| HTTP 错误响应 | URL 非法、私网、未知网页、媒体类型不符、上游不可用 | 不可以 |

- Bilibili 继续由现有 provider parser 处理。仅当 provider 的可识别响应明确表示未认证时，
  映射为 `session-required`；401/403 等不明确情况必须保守表述为“需要账户会话或来源当前
  不可访问”。
- HLS 读取并解析 manifest；DASH 读取 manifest 并验证 `application/dash+xml` 或等价安全
  MIME；直链使用带 `Range: bytes=0-0` 的有限探测，要求媒体 MIME。HTML 或普通页面即使 URL
  使用了媒体样式名称也不能通过。
- composer 在预览完成后锁定 URL 与标题，只有“重新编辑”才会清除预览；确认入队使用
  与该预览一致的 URL。
- 现有 legacy direct-`Enmoku` REST body 保持兼容；新 composer 经过预览后才会调用它。

## REST 合约

在 `bushitsu` 路由新增只读端点：

```text
POST /bushitsu/:id/enmoku/preview
body: { sourceUrl: string, title?: string }
```

成功响应只含可显示的摘要，不含代理 URL、原始请求头或任何会话数据：

```ts
type EnmokuPreview = {
  state: "ready" | "session-required"
  title: string
  type?: "direct" | "hls" | "dash"
  provider?: { kind: "bilibili"; ownerName?: string }
  sourceCount?: number
  subtitleCount?: number
  live?: boolean
}
```

- `ready` 才可确认；`session-required` 显示后续账户能力的说明，确认按钮不可用。
- 无效 URL、私网、未知网页和不可恢复上游失败使用现有统一错误 envelope；错误文案给出可恢复
  动作（编辑链接、稍后重试），不回显敏感请求细节。
- 现有 `POST /bushitsu/:id/enmoku` 保留 source URL body 以兼容 legacy 调用；正式 UI 只会在
  `ready` 预览后提交 `{ sourceUrl, title?, addedBy }`，不提交 `headers`。在 REST 尚无身份和
  完整 SSRF hardening 前，这不是绕过 legacy 调用者的安全边界。
- 当前 REST 没有非伪造身份，故端点无法提供真正的服务端 `canPlaylist` 授权；本任务只在 UI
  中沿用现有 gate。未来账户任务必须以认证主体替代 `addedBy` 并在服务端门控预览/创建。

## 前端设计

### 组件与状态

新增 `components/bangumi/EnmokuComposer.vue`，并用 `composables/useEnmokuPreview.ts`
封装请求、状态转换和错误归一化。`BushitsuView` 继续拥有 room ID、WebSocket client 与
`JOUEI` 发送；composer 只通过 typed emit 提交已创建的 `Enmoku` 和所选意图。

本地状态机：

```text
closed → editing → resolving → preview-ready
                         ├→ session-required
                         └→ error
preview-ready → queueing → closed
preview-ready → switching → closed
```

- 输入包含可见的 URL label、可选显示标题、简短的支持来源提示。
- “解析链接”是唯一主操作。解析时禁用输入和按钮并保留布局，超过短暂等待显示不遮挡页面的
  loading 文案。
- 预览显示标题、类型、已知 provider/可选源与状态；错误通过字段下方 `role="alert"` 告知，
  并保留输入内容方便修正。
- 当前没有能可靠返回 `session-required` 的 provider adapter；预览会将此类未支持/不可访问
  来源显示为失败，直到未来账户 session 任务补上明确的 provider 信号。
- `ready` 状态提供“加入队列”（主操作）和“加入并切换到房间播放”（次操作）。后者仅在
  `canPlaylist` 下展示，并只向父视图 emit 当前节目选择；不会承诺自动播放。
- 未获 `canPlaylist` 的成员看不到 composer，与现有番组表控制保持一致。
- 成功后 composer 收起、清空草稿，依赖 REST 后的 WS `BANGUMI` 快照更新队列；不手工写入
  Pinia 队列。切换意图由父视图发送 `JOUEI`。

### 视觉与可访问性

- 放在 `Bangumi` 标题下面、列表前方，使用现有 warm theme semantic tokens、面板边框和圆角，
  不引入新主题或原始色值。
- `Bangumi` header 的“添加链接”点击后以内联折叠/展开方式显示 composer；桌面保留队列扫描顺序，
  375/768 竖屏中每个操作独占足够的可点区域，不与紧凑队列行挤在一起。
- 交互目标至少 44px、相邻操作间距至少 8px；键盘焦点清晰，Enter 提交解析，Esc 收起时保留
  未解析草稿；显式关闭按钮则丢弃草稿（不使用 modal，因此不拦截页面焦点）。
- 只使用 i18n message key；状态不只靠颜色，包含文字与来源类型标记；motion 仅用现有
  150–300ms transform/opacity 过渡并尊重 reduced motion。
- 桌面房间保持聊天列固定，但左侧 `stage` 是唯一的纵向滚动容器：当播放器、房间控制或
  composer 超过视口时，所有下方内容仍可到达。播放器维持 16:9；`room-workbench` 按内容
  高度布局，不用 `flex-grow` 拉出空白面板。竖屏现有 document-scroll 模式保持不变。
- 首次进入房间前，主页在用户开始填写/创建时预取懒加载的房间视图；入室确认后，房间详情和
  番组表 REST 请求并行发出。该优化不改变 WebSocket 入室确认、`OIKAKE` 或 server truth 的顺序。

## 兼容性与回滚

- 已存 `Enmoku`、Bilibili provider 元数据、HLS 子资源代理和现有番组行保持不变。
- 新 preview endpoint 为纯新增；若前端回滚，legacy source URL POST 仍可工作。
- 一旦 URL 被正式入队，解析产物沿用既有 `Enmoku` 存储和 `BANGUMI` 广播，不需要迁移。
- 如果公共 URL 策略意外阻挡已有来源，可回滚前端入口/端点；不要通过恢复私网代理来绕过安全
  判断，必须先有明确的设备代理设计。

## 风险与后续

| 风险 | 缓解 | 后续归属 |
| --- | --- | --- |
| 上游的 401/403 含义不唯一 | 文案保守；仅 provider 明确信号映射 `session-required` | 账户 session/provider adapters |
| DNS rebinding / 云 metadata SSRF | 当前只拦截字面量私网地址并拒绝 redirect；不可视为完整 SSRF 防护 | SSRF hardening / deployment |
| 自动播放策略不同 | 文案和状态机区分切换与开始播放；沿用 join gate | 当前浏览器 E2E |
| REST 无真实身份 | 不把 UI gate 当安全边界；记录并拆出账户前置任务 | identity + REST authorization |
| 私网媒体需求 | 当前拒绝；未来采用发起者设备代理 | host media proxy |
