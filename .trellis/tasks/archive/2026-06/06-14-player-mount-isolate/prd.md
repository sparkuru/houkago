# 修 Vue patch 崩溃：ArtPlayer 与 Vue v-if 浮层共用同一容器

## Goal

权限变更时控制台报 `TypeError: can't access property "insertBefore", parent is null`（Vue patchBlockChildren→processCommentNode），DOM 更新被中止 → 控播放 gating/控件显隐不活更，需刷新才反映（先前共享控制/重显修复因此显得无效）。修掉崩溃，恢复一切权限相关的实时更新。

## Root Cause（已坐实）

- EnmokuPlayer 模板 `<div ref="container" class="enmoku-player">` **既是 ArtPlayer 挂载容器**（`new Artplayer({ container: container.value })`），**又直接包含 Vue 的 v-if 浮层**（`control-lock`、`join-gate`）。
- ArtPlayer 注入/改动该容器子节点，Vue 同时在其中管理 v-if 节点。v-if 切换(controlLocked/showJoinGate 变)时 Vue 的 block patch 对 comment 锚点 insertBefore，但 ArtPlayer 已重排该容器 → 锚点 parent 为 null → 抛错，整次组件更新中止 → 后续响应式(canControl→class、KengenPanel 等)不落 DOM。

## Decision

把 ArtPlayer 挂载点与 Vue 管理的浮层**结构隔离**：ArtPlayer 挂进一个**专属子 div**（Vue 永不 patch 其内部）；`control-lock`/`join-gate` 作为该子 div 的**兄弟**、同为外层 `.enmoku-player` 的直接子节点（Vue 完全掌控）。这样 Vue 的 v-if 切换只发生在稳定的兄弟节点间，不与 ArtPlayer 外部 DOM 交错。

## Requirements

1. 重构 EnmokuPlayer 模板：
   - 外层 `<div class="enmoku-player" :class="{'control-locked':controlLocked}">`（Vue 掌控）。
   - 内含 `<div ref="container" class="art-host">`（ArtPlayer 唯一挂载点，Vue 不在其内放任何节点）。
   - `control-lock`(v-if)、`join-gate`(v-if) 作为 `.enmoku-player` 直接子、`art-host` 的兄弟。
2. `container` ref 移到 art-host；ArtPlayer `container: container.value` 指向 art-host。playerEl=art.template.$player（在 art-host 内）逻辑不变。
3. CSS 调整：`.art-host{width:100%;height:100%}`，`.enmoku-player` 保持定位/尺寸；既有 `:deep(.art-bottom/.art-mask/.art-video/.art-video-player)`、`object-fit:contain`、control-locked 隐藏规则作为后代选择器仍生效。
4. DanmakuOverlay teleport 到 $player 不变（次要嫌疑：若崩溃仍存,排查 teleport 与 v-if 交互）。

## Acceptance Criteria

- [ ] 权限变更（A 允许/禁止 B 控播放）时控制台**无** insertBefore/patch 崩溃；BushitsuView 更新不抛。
- [ ] A 禁止→B 控件即时消失且点不动；A 允许→B 控件即时出现可控——**均无需刷新**（崩溃修复后先前 gating/reshow 逻辑生效）。
- [ ] 普通/web-zenmen/原生全屏布局、letterbox、弹幕 Teleport、join-gate、同步/共享控制不回归。
- [ ] 容器内(./dx) typecheck/lint/build 全绿；kyoushitsu test 不回归。

## Out of Scope

- 入房控制(epic 阶段2)；锁定时保留音量/全屏细分。

## Technical Notes

- 这是"第三方库与 Vue 抢管同一 DOM 容器"的经典坑；隔离挂载点是标准解。
- 验证 ./dx（禁裸 docker）；本机 headless dump-dom 可自证页面渲染不空白、art-host/.art-video-player 结构正确；权限切换交互由用户实机确认无崩溃+实时生效。
