# 全屏二修：原生全屏气泡跟随 + 网页全屏折叠聊天布局

## Goal

上一轮全屏 UI 调优后实跑暴露两个全屏边界 bug，修复之。

## Bug 1：原生（浏览器）全屏下气泡不跟随控制条

- 现象：浏览器原生全屏（非网页全屏）时，弹幕气泡不随播放器底部控制条显隐相对上移/下移（#3 在普通模式生效，但原生全屏下不跟随）。
- 怀疑根因：
  - **reactivity 脆弱**：`controlsShown` 经 EnmokuPlayer `defineExpose(ref)` → BushitsuView `computed(() => playerRef.value?.controlsShown)` → prop 下传。「暴露 ref 经父 computed」链可能在某些时序/全屏下不可靠。更稳：EnmokuPlayer 直接 `emit('control', state)`，BushitsuView 存自有 ref 传 prop（保证响应式）。
  - **偏移过小**：bottom 56/16px 为绝对值，在 4K 原生全屏下相对控制条太小，移动不明显甚至仍被遮挡。可考虑更贴合控制条高度的偏移（或相对控制条定位）。
- 期望：普通 / 网页全屏 / **原生全屏** 三态下，气泡都随控制条显隐平滑上移/下移、不被遮挡。

## Bug 2：网页全屏 + 折叠聊天 布局错乱

- 现象：折叠聊天室后再进入网页全屏（或反序），网页全屏布局不再按预期（播放器/letterbox 不对，见用户截图，video 满铺无正确 contain/居中）。
- 怀疑根因：`.bushitsu.web-zenmen` 为 fixed inset:0 flex；折叠态下 `.hiraku-handle`(12px) 进入 flex 行、ChatPanel `display:none`，`.player-wrap{flex:1;min-height:0;aspect-ratio:auto}` 与 ArtPlayer 内部 contain 在该组合下未给出预期 letterbox/尺寸。需实机查 web-zenmen×折叠 的盒模型。
- 期望：网页全屏下无论聊天展开或折叠，播放器都正确填满可用区并 contain 居中（上下/左右黑边），折叠手柄不破坏布局；展开/折叠切换、与网页全屏任意先后顺序都正确。

## Requirements

1. 气泡跟随控制条在普通/网页全屏/原生全屏三态均生效；reactivity 改用 emit（或确证现链可靠）；偏移在大屏/原生全屏下也有效不被遮挡。
2. 网页全屏 × 折叠聊天 布局正确：播放器填满可用区、contain 居中，折叠手柄不挤坏布局。
3. 不破坏既有：普通模式布局、网页全屏×展开聊天、聊天/弹幕/同步/昵称/join-gate/nameGate、DanmakuOverlay Teleport。

## Acceptance Criteria

- [ ] 原生全屏下气泡随控制条显隐上移/下移、不被遮挡；普通与网页全屏不回归。
- [ ] 网页全屏 + 折叠聊天：播放器正确填满并 contain 居中，无错位；展开聊天网页全屏仍正确。
- [ ] 折叠/展开与网页全屏任意先后顺序，布局都正确。
- [ ] 容器内(./dx) typecheck/lint/build 全绿；kyoushitsu test 不回归。

## Out of Scope

- NTP-lite 时钟偏移（B 端加速/超前问题，另独立任务）。
- canvas 弹幕、聊天栏宽度可调、guest 权限 epic。

## Technical Notes

- 实机排查可用本机 google-chrome-stable headless dump-dom / 计算样式；原生全屏行为难 headless，逻辑层确认 + 用户最终实机确认。
- 涉及文件：`components/player/EnmokuPlayer.vue`(control 事件/暴露)、`components/danmaku/DanmakuOverlay.vue`(气泡 bottom)、`views/BushitsuView.vue`(web-zenmen CSS、hiraku-handle、controlsShown 传递)。
- 验证用 ./dx（强约束，禁裸 docker）。视觉由用户最终确认。
