# 全屏 UI 调优：气泡相对进度条 + 折叠按钮收纳

## Goal

两项前端 UI 打磨（原始需求 #3、#4），改善全屏/普通下的观感。

## Requirements

### #3 气泡相对进度条上移
- 现状：`DanmakuOverlay` `.danmaku-track { bottom: 56px }` 写死，气泡偏下、且不随播放器控制条显隐变化。
- 目标：气泡位置跟随 ArtPlayer 控制条显隐——控制条收起（自动隐藏）时气泡贴近底部留小间距；控制条出现（hover）时气泡上移让出控制条空间。平滑过渡，普通与全屏一致。
- 做法：EnmokuPlayer 监听 ArtPlayer 控制条显隐（`art.on('control', show)` 或等价），把"控制条是否可见"暴露给 DanmakuOverlay（prop），track 的 bottom 据此切换（带 transition）。控制条可见状态为本地 view 态。

### #4 折叠按钮收纳（展开态收进聊天栏头部）
- 现状：stage 与聊天栏之间一根 20px 竖条 ›/‹（`.chat-toggle`），常驻、偏大。
- 目标：
  - **展开态**：折叠按钮做成聊天栏 header（「出席 N」那行）右侧的小 › 图标，去掉中间那根粗竖条。点击折叠。
  - **折叠态**：聊天栏隐藏；折叠按钮**默认不显示**，鼠标移到右缘时才浮现一个小 ‹ 提示（hover 才现），点击展开。
- 折叠/展开为本地 view 态（`chatHiraku` 已有）。ChatPanel 头部加折叠按钮并 emit 事件给父级；父级管 `chatHiraku` 与折叠态的 hover-reveal 手柄。

## Acceptance Criteria

- [ ] 气泡随控制条显隐上移/下移，平滑过渡；普通与网页/原生全屏下均正确、不被控制条遮挡。
- [ ] 展开态：聊天栏 header 右侧有小 › 折叠按钮，中间粗竖条移除。
- [ ] 折叠态：默认看不到展开按钮，鼠标移到右缘才浮现 ‹ 提示，点击展开。
- [ ] 不破坏聊天/弹幕/同步/昵称/gate；普通与全屏布局不回归。
- [ ] 容器内(./dx) typecheck/lint/build 全绿；kyoushitsu test 不回归。

## Out of Scope

- canvas 飞屏弹幕、弹幕样式化、聊天栏宽度可调、主题。
- guest/权限 epic。

## Technical Notes

- DanmakuOverlay 已 Teleport 进 ArtPlayer `$player`，控制条显隐由 EnmokuPlayer 经 ArtPlayer 事件感知后以 prop 下传最稳（scoped 样式跨 teleport 匹配祖先 class 不可靠）。
- ArtPlayer control 事件需实测确认 API（`art.on('control', (state:boolean)=>...)`）。
- ChatPanel 加 header 折叠按钮 → emit `toggle`（或 `collapse`）；BushitsuView 监听改 `chatHiraku`。折叠态 hover 手柄在 BushitsuView（ChatPanel 此时 v-show 隐藏）。
- 验证用 ./dx（强约束，禁裸 docker）。视觉由用户最终确认。
