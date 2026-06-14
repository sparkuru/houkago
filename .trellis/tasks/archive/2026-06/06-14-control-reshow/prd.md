# 放权后 guest 控件实时重显（无需刷新）

## Goal

房主在 guest 进房后才放开"控播放"时，guest 端控件不实时出现、需刷新。修到放权即时显控件。

## Root Cause（已勘定）

- 反应性链正常：SETTEI→服务端广播 KENGEN→B store.apply 设 kengen→canControl 计算→BushitsuView `:control-locked="!bushitsu.canControl"`→EnmokuPlayer `:class="{'control-locked':controlLocked}"`→CSS `.control-locked :deep(.art-bottom/.art-mask){display:none}`。数据确实活到 B。
- 症状非对称：**加锁**(display:none 加上) CSS 即时生效→"禁止→控件即时消失"正常；**解锁**(display:none 去掉)后元素回默认 display，但 **ArtPlayer 自身的控件显隐状态机仍停在"隐藏"**，需 hover/事件才重显；刷新重建 ArtPlayer 则初始显控件→故"刷新才有"。

## Requirements

1. EnmokuPlayer 监听 `controlLocked` 由 true→false（解锁）时，主动调 ArtPlayer API 重显控制条（让 `.art-bottom`/控件回到可见态），无需用户 hover 或刷新。
2. 加锁(false→true)仍即时隐藏（现 CSS 已可，保留）。
3. 不破坏 ArtPlayer 自身的 hover 自动显隐、控制条 control emit（controlsShown 气泡跟随）、同步/共享控制、弹幕/join-gate/全屏。

## Acceptance Criteria

- [ ] B 进房时被禁控播放(无控件)，A 放权后 B **立即**出现控件，无需刷新或 hover。
- [ ] A 再禁，B 控件即时消失（不回归）。
- [ ] 房主自身控件正常；普通模式/全屏不回归。
- [ ] 容器内(./dx) typecheck/lint/build 全绿；kyoushitsu test 不回归。

## Out of Scope

- 锁定时保留音量/全屏控件的细分；入房控制(epic 阶段2)。

## Technical Notes

- 核实 artplayer@5.4 重显控件 API（types 里 `art.controls`：可能是 `art.controls.show`(boolean 属性/方法) 或 `art.emit("control", true)`，或 ArtPlayer 的 mask/control show）。在 EnmokuPlayer `watch(() => props.controlLocked)` 中，解锁时调之。注意 art 可能为 null（mount 前）需 guard。
- 也可考虑解锁时同步 controlsShown 逻辑一致（控制条重显→control emit）。
- 验证 ./dx（禁裸 docker）；交互 headless 难全验，逻辑+用户实机确认。
