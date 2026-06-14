# 共享播放控制 + 控播放锁真正生效

## Goal

修正"控播放"权限的语义与锁定行为：

1. **共享控制（语义修正）**：开启 guest 控播放权后，guest 的暂停/播放/seek 应**驱动房主和所有人**（共享控制、后写者胜），而非只控自己。当前实现 guest SHINKOU 服务端虽接受+广播给 peers，但**房主 handleRemote 对 isBuchou 早退、不跟随 guest** → guest 操作影响不到房主。
2. **锁真正生效**：未授权 guest 仍能按 ArtPlayer 控制条播放键（pointer-events:none 被控件自身覆盖）；上轮只挡住了点画面。

## Root Cause

- 语义：`useShinkou.ts` `onLocalShinkou` 仅 `isBuchou` 才广播；`handleRemote` 开头 `if (bushitsu.isBuchou) return` 让房主不跟随任何远端 → 单一房主权威。
- 锁：ArtPlayer 控制条（`.art-bottom`/`.art-control` 等）可点击性独立，`.art-video-player{pointer-events:none}` 被其覆盖，故控制条播放键仍可按。

## Decision (ADR-lite)

**Context**: 用户要共享控制（design §5 原为单一房主权威）。**Decision**:
- 广播门槛 `isBuchou` → `canControl`(= host || kengen.playback)：有控播放权者(含被授权 guest)的本地操作才广播 SHINKOU。
- 跟随：**所有人(含房主)跟随他人的 SHINKOU**(去掉 handleRemote 的 isBuchou 早退,仅对 SHINKOU)。后写者胜(各端 apply 最新 SHINKOU)。服务端 ws.publish 不回发自身、tsuijuuChuu 抑制回声 → 无环。
- GENJOU 心跳：**房主仍不追自身心跳**(保留 isBuchou 跳过 GENJOU,维持原房主稳定性);非房主照常 GENJOU 追平。授权 guest 驱动时房主经其 SHINKOU 即时跟随,迟到者经 GENJOU(服务端记录最后 SHINKOU 为权威)对上。
- 锁：未授权(controlLocked)时**隐藏 ArtPlayer 控制条**(`:deep(.art-bottom)` 或实测确认的控制条容器 `display:none`,display:none 不被 pointer-events 翻盘) + 禁视频点击(`.art-video` pointer-events:none)。保留弹幕开关/join-gate/气泡。

**Consequences**: 偏离 design §5 单一权威→"有权者共享、后写者胜",§5 回填。锁定 guest 一并失去音量/全屏控件(可接受 MVP;细分留后续)。offset 估计仍只用 senderId==='server' 样本(保留)。

## Requirements

1. onLocalShinkou 广播门槛 isBuchou→canControl。
2. handleRemote:SHINKOU 不再被 isBuchou 早退,房主与所有人都 apply 他人 SHINKOU;GENJOU 保留 isBuchou 跳过(仅房主)。offset 取样(senderId==='server')保留在早退之前。
3. 锁:controlLocked 时隐藏控制条 + 禁视频点击,弹幕/join-gate/气泡不受影响;授权或房主时控件恢复。
4. 不破坏:JOUEI 源同步、NTP-lite offset、catchUp/seek、autoplay join-gate、nameGate、昵称、全屏、DanmakuOverlay Teleport、服务端 enforcement(最终保险)。

## Acceptance Criteria

- [ ] 房主开 guest 控播放后:guest 暂停/播放/seek，**房主与其他用户都同步跟随**。
- [ ] 房主操作仍驱动所有人(不回归)。
- [ ] 关闭 guest 控播放后:guest **按不动**控制条播放键、点画面也无效;服务端仍拒越权(双保险)。
- [ ] guest 锁定时仍能 join-gate 参加、点弹幕开关、看气泡。
- [ ] 迟到者进房对上当前进度(GENJOU 权威=最后 SHINKOU)不回归。
- [ ] 容器内(./dx) typecheck/lint/build 全绿;housou+kyoushitsu test 不回归并补/改用例(onLocalShinkou canControl、handleRemote 房主跟随 SHINKOU)。

## Out of Scope

- 锁定时细分保留音量/全屏控件;driverId 入 GENJOU 精确判定自身驱动;入房控制(epic 阶段2)。

## Technical Notes

- 实测确认 ArtPlayer 控制条容器 class(headless dump-dom 看 .art-video-player 子结构;常见 .art-bottom)。display:none 隐藏之。
- useShinkou:canControl 经 store(bushitsu.canControl)读;onLocalShinkou/handleRemote 改判定。注意 tsuijuuChuu 抑制、suppressed 包裹不变。
- 验证 ./dx(禁裸 docker);pointer/display 交互 headless 难全验,逻辑+计算样式+用户实机确认。
