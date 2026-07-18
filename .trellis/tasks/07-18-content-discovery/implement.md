# 实施计划：公开 URL 预览与房间入队

## 交付顺序

1. **解析与公网入口边界（`packages/eisha`）**
   - 建立可复用的公开 URL 字面量校验与预览受限 fetch 边界。
   - 用于 HLS/DASH/直链验证；redirect 由预览拒绝，不自动跟随。
   - 为不支持、私网、可明确识别的 session-required、上游不可用定义可映射错误。
   - 保留 legacy `headers` 接口兼容，但新公开 composer 无法传入或看到它。

2. **预览 REST 合约（`packages/housou`）**
   - 新增 `POST /bushitsu/:id/enmoku/preview` 的 TypeBox schema、只读编排函数和安全摘要。
   - 让 composer 只在 `ready` 预览后调用既有 `sourceUrl` 入队，再持久化、广播既有
     `BANGUMI`；legacy REST 调用保持兼容，不假装它已成为安全边界。
   - 扩展统一 error status 映射；不要在路由中复制 parser/proxy 判断。
   - 明确保留开发期 REST 身份缺口，不伪造授权机制。

3. **番组表 composer（`packages/kyoushitsu`）**
   - 新增 `useEnmokuPreview` composable 与 `EnmokuComposer` 组件，保留 state machine 的局部
     UI 状态，不写 Pinia 队列。
   - 从 `BushitsuView` 删除 `dev-manual` / `playManual`，在番组表 header 下接入展开入口，
     由父视图继续发送 `JOUEI`。
   - 新增完整 i18n 文案、响应式 CSS、焦点/加载/错误/禁用状态；使用现有 semantic tokens。
   - “加入并切换到房间播放”只选择当前节目；不得引入伪可靠 autoplay。

4. **验证与回归**
   - 为 eisha、housou、kyoushitsu 分别补单元/API 测试；补 Browser E2E 覆盖桌面、375px 和
     768px 竖屏。
   - 运行 lint、全量 typecheck、各包测试、生产构建和 Playwright；手工核对 warm theme、
     reduced motion、键盘及触屏操作。
   - 覆盖矮桌面窗口的左侧滚动可达性、高桌面窗口的工作区自然高度，以及首次创建时的房间视图
     预取不影响正常入室。

## 测试矩阵

| 层 | 必测案例 |
| --- | --- |
| eisha | 公网 direct/HLS/DASH/Bilibili 成功；HTML 页面拒绝；localhost/IPv4/IPv6 私网/链路本地字面量拒绝；预览不泄漏 headers |
| housou REST | preview 不写 `Enmoku` / 不发 `BANGUMI`；ready 摘要不含 URL/headers；确认入队重解析并广播；可选标题覆盖；source/session/unavailable 错误映射；旧 source URL/Bilibili 回归 |
| kyoushitsu unit | composer state machine、标题草稿保留、错误/加载、按钮权限、成功 emit；i18n keys 完整 |
| browser E2E | 展开→解析→入队；展开→解析→入队并切换；失败保持输入并可重试；无片源权限不可见；375/768 竖屏没有横向溢出且播放器、队列、聊天可达 |

## 验证命令

```bash
bun run lint
bun run typecheck
bun run --filter houkago-eisha test
bun run --filter houkago-housou test
bun run --filter houkago-kyoushitsu test
bun run --filter houkago-kyoushitsu build
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts
```

Playwright requires a running frontend/control-plane stack and the host Chrome executable in this
environment; the existing container browser image lacks the necessary system libraries.

## 受影响文件与回滚点

| 区域 | 预期文件 | 风险 / 回滚 |
| --- | --- | --- |
| URL policy | `packages/eisha/src/proxy.ts`, `resolver.ts`, parser tests | 误拦截来源；保留纯新增 preview API，修正规则后重试，不恢复私网访问 |
| REST | `packages/housou/src/routes/bushitsu.ts`, `lib/errors.ts`, `test/rest.test.ts` | Eden 合约变化；新增端点优先，legacy POST 保持兼容 |
| 前端 | `BushitsuView.vue`, `components/bangumi/EnmokuComposer.vue`, `composables/useEnmokuPreview.ts`, i18n/tests | mobile layout/focus；组件可独立移除回退至旧表单，但不应绕过预览契约 |
| E2E | `packages/kyoushitsu/e2e/mobile-room.spec.ts` 或同目录新 spec | 防止已修复的竖屏聊天室/播放器回归 |

## 不在本计划中

- 用户登录、个人中心、第三方 session 的加密存储、过期、撤销与审计。
- 每人自用 session、可信共享 session、发起者设备媒体代理及其带宽/连通性处理。
- 内容搜索、推荐、平台聚合、爬虫、排序、自动连播、主题功能。
- DNS 解析、逐跳 redirect 与 proxy 运行时的一体化 SSRF hardening；这需要连同部署 egress
  规则作为单独安全任务处理。
