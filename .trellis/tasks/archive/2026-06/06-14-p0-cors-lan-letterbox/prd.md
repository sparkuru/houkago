# P0 验证修复：CORS/LAN 使能 + 全屏 letterbox + 气泡层级 + 聊天可读

## Goal

浏览器实跑验证（两独立会话）暴露的一批缺陷与使能缺口的集中修复。同步核心(§5)已实测通过——之前"不同步"是同浏览器两 tab 共享同一 localStorage buinId（都成部長互不跟随）的测试设置问题，非代码 bug。

## What I already know（验证现场）

- 两独立会话：房主权威同步、迟到追平、聊天双向、气泡 overlay（普通模式）均实测 ✓。
- 已做的**使能改动**（本任务归拢提交）：
  - housou 加 `@elysiajs/cors` `.use(cors())`——SPA 跨源调用控制面所需（design §2 控制面/媒体面分离 → 不同 origin）。
  - 前端 `lib/housou-url.ts`：housou 地址按 `location.hostname:3000` 推导，localhost 与 LAN IP 访问都自动对（替代写死 localhost）。api/index.ts、BushitsuView 改用之。
  - vite `server.allowedHosts: true`——接受 LAN host 头。
- 临时**调试日志**：`housou/src/ws/handler.ts` 的 `console.error('[DBG]...')` 三处——**本任务必须移除**。

## Requirements（修复项）

1. **气泡全屏不可见**：`DanmakuOverlay` 的 `.danmaku-overlay` 无 z-index，网页全屏下被 ArtPlayer 内部元素遮挡。给 overlay（或 track + toggle）一个高于 ArtPlayer 控件的 `z-index`，保证普通与全屏下气泡都可见。气泡来源是 store.chat（与全屏无关，消息确实到达），纯渲染层级问题。
2. **网页全屏 letterbox**：当前 `EnmokuPlayer` 的 `.enmoku-player { width:100%; aspect-ratio:16/9 }` 导致全屏左列下方留黑占位。改为：宽高比移到 `.player-wrap`（普通=16/9），`.enmoku-player` 填满父容器（width/height:100%）；网页全屏下 `.player-wrap` 取消固定宽高比、填满左列高度，ArtPlayer 内部 object-fit contain 上下黑边把画面垂直居中（B 站直播间式：左整块播放器、内容居中、黑边填充）。普通模式仍 16:9 不回归。
3. **全屏聊天字不可见**：网页全屏 `.bushitsu` 黑底下 `ChatPanel` 无背景、字看不见。给 ChatPanel 实底色（白底深字，与全站浅色一致），全屏下成可读的右侧白栏。
4. **移除调试日志**：删 `handler.ts` 三处 `[DBG]` `console.error`。

## Acceptance Criteria

- [ ] 网页全屏：左侧播放器填满列高、画面上下黑边居中，无下方黑占位；普通模式仍 16:9。
- [ ] 气泡在普通与网页全屏下都可见（含对方会话消息）。
- [ ] 网页全屏下右侧聊天栏字清晰可读。
- [ ] handler.ts 无 [DBG] 残留。
- [ ] 容器内 typecheck/lint/build 全绿、housou+kyoushitsu test 不回归；headless 渲染首页/房间不空白。

## Out of Scope（单列后续）

- **昵称显示**：聊天/气泡显 senderId(uuid) 而非昵称——需 OSHABERI/DANMAKU 携 nickname 或 NYUUBU 维护 roster（协议+store 改动），独立任务。
- 原生全屏下的聊天叠层、弹幕样式发送、canvas 飞屏弹幕。

## Technical Notes

- BushitsuView scoped 样式触达子组件元素用 `:deep()`（如 `.web-zenmen .player-wrap :deep(.enmoku-player)`）。
- ArtPlayer autoSize:false + 容器定尺 → 默认 object-fit contain letterbox。
- 验证：容器内 `./dx`；本机有 google-chrome-stable 可 headless dump-dom 自证不空白；视觉正确性由用户最终确认。
- 提交前移除调试日志；CORS 默认放行仅 dev，注释注明上线前收紧 origin 白名单。
