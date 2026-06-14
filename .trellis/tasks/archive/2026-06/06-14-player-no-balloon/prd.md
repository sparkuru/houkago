# 普通模式下折叠聊天不应使播放器膨胀

## Goal

普通模式下折叠右侧聊天栏后，播放器铺满整个窗口宽度变得巨大。期望：折叠聊天只隐藏侧栏，**播放器保持合理大小**（不因释放空间而变巨），多出的空间留空即可。网页全屏(web-zenmen)下填满是期望行为，不动。

## Root Cause

- `.bushitsu{display:flex;height:100vh}` 行布局：`.stage{flex:1}` + ChatPanel(320px)。`.player-wrap{aspect-ratio:16/9}` 宽度驱动。
- 折叠聊天 → ChatPanel `display:none`(v-show) → stage 占满整宽 → player-wrap 16:9 按全宽撑开 → 播放器变巨（宽度随聊天显隐变化）。

## Requirements

1. 普通模式：播放器尺寸**与聊天折叠/展开无关**——折叠后播放器不膨胀，保持稳定的合理大小（按可用高度约束或加 max-width 上限），居中，多余空间留空。展开聊天时也不应被压缩到不合理。
2. 网页全屏(`.bushitsu.web-zenmen`)行为不变：播放器仍填满可用区并 contain 居中（上轮已修），折叠/展开都填满。
3. object-fit:contain（上轮）保持；普通与网页全屏 letterbox 不回归。
4. 不破坏：番组表/聊天/弹幕/同步/昵称/join-gate/nameGate/DanmakuOverlay Teleport、气泡随控制条。

## Acceptance Criteria

- [ ] 普通模式折叠聊天后，播放器不膨胀、保持与展开时相近的大小、居中，右侧空出区域不被播放器占据。
- [ ] 普通模式展开聊天，播放器大小合理、不被过度压缩。
- [ ] 网页全屏折叠/展开都正确填满 contain 居中（不回归）。
- [ ] 容器内(./dx) typecheck/lint/build 全绿；kyoushitsu test 不回归。

## Out of Scope

- NTP-lite 时钟偏移、guest 权限 epic、canvas 弹幕、聊天栏宽度可调。

## Technical Notes

- 思路：普通模式给播放器按**可用高度**约束（width 由 16:9 从 height 推导，则与 stage 宽度/聊天显隐无关），或给 `.player-wrap` 加 `max-width` + `margin-inline:auto` 居中封顶。需取舍：高度驱动最干净地"与聊天无关"。注意 stage 内还有 `.bar` 与 `.bangumi`。
- 约束仅作用普通模式；`.bushitsu.web-zenmen .player-wrap{flex:1;aspect-ratio:auto}` 填满逻辑保留。
- 本机 google-chrome-stable headless 可 dump-dom/算样式实证不同窗口尺寸×折叠组合下 player-wrap 计算尺寸。
- 文件：`views/BushitsuView.vue` CSS 为主。验证用 ./dx（禁裸 docker）。视觉由用户实机确认。
