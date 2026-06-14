# 部員「点击加入观看」遮罩 + 一次点击干净追平播放（方案二）

## Goal

解决部員(B)首次进房不自动播放的浏览器 autoplay 限制。上一版采「静音自动播+解除遮罩」(commit cceb693)，实测 B 解除静音后**画面糊、同步不丝滑**（静音起播低码率 + 解除瞬间与 zure 校正打架），已 `git revert`(ba733e1)。改用方案二：保留声音，部員进房显「▶ 点击加入观看」遮罩，点一次（产生用户手势）→ 干净追平到房主当前位置并带声播放，之后正常同步。

## Root Cause（背景）

浏览器 autoplay 策略：无用户手势时程序化 `art.play()` 被拒(NotAllowedError)。房主点击有手势故正常；部員从未交互故被拦。方案二用一次显式「加入」点击提供手势，而非静音绕过。

## Decision (ADR-lite)

**Context**: 真正免点击只能静音，但静音方案实测画质/同步劣化。用户改选方案二（保留声音、一次点击）。
**Decision**: 部員(非 isBuchou)进房，播放器上叠「▶ 点击加入观看」遮罩，初始保持暂停；点击 → 遮罩消失、在该 click 同步调用栈内 `art.play()`（手势有效、带声）并立即 catchUp 到房主权威位置（seek 到投影时间）。房主无遮罩、行为零变化。播放器不静音。
**Consequences**: B 需一次点击才入场（可接受，本就是首次交互），换取带声、清晰、即时丝滑追平。加入前心跳/SHINKOU 触发的 play() 须被静默 catch（不抛 Unhandled、不黑屏报错），B 加入前停在暂停+遮罩态。

## Requirements

1. 部員播放器进房初始**不自动播**、显「▶ 点击加入观看」遮罩（仅 follower 且未加入时）。房主无遮罩。
2. 点击遮罩：在 click 事件同步栈内调用 `art.play()`（带声、手势有效），遮罩消失，并触发 catchUp（seek 到房主投影位置 + 跟随播放），实现一次点击即丝滑对齐。
3. `art.play()` 全部调用点经统一 helper `.catch()` 静默处理 rejection（加入前的 heartbeat/SHINKOU play 被拒不抛 Unhandled、不黑屏）。
4. 不静音（删除上一版 muted 逻辑残留——已 revert，确认无残留）。
5. 不破坏房主播放/广播、不破坏加入后 useShinkou 追従(tsuijuuChuu)/zure 校正/JOUEI 跟随、不破坏 DanmakuOverlay Teleport(playerEl)。
6. 加入/遮罩为本地 view 态，不进 store。

## Acceptance Criteria

- [ ] 部員进房显「▶ 点击加入观看」遮罩，画面不报错（暂停态）。
- [ ] 点一次遮罩后：带声播放、立即追平到房主当前进度，之后 A 播放/暂停/seek B 持续丝滑同步（无糊、无持续抖动）。
- [ ] 房主无遮罩、行为不回归。
- [ ] 控制台无 autoplay Unhandled rejection。
- [ ] 重进房同样显遮罩、点击后正常。
- [ ] 容器内(./dx) typecheck/lint/build 全绿；kyoushitsu test 不回归并补关键用例。

## Out of Scope

- 免点击自动播（已确认浏览器策略下只能静音，舍弃）。
- 音量持久化、原生全屏交互差异、断线重连。

## Technical Notes

- 遮罩 UI 与 art 命令式调用归 EnmokuPlayer（component-guidelines）；catchUp 触发在 BushitsuView/useShinkou（已有 `shinkou.catchUp`）。EnmokuPlayer emit `join`，BushitsuView `@join` 置 joined=true 并 `shinkou.catchUp()`——注意保持在 click 同步栈内以保留手势有效性（Vue 事件处理器同步执行）。
- 加入前 follower 的 play() 被拒属预期，safePlay 静默 catch 即可（不需静音重试）。
- 验证用 ./dx（强约束，禁裸 docker）。视觉/双端实跑由用户确认。
