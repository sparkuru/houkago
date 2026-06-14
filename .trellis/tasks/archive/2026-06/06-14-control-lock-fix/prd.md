# 控播放遮罩真正拦住 guest 操作（pointer-events 而非 z-index）

## Goal

阶段1 的 `control-lock` 遮罩不生效：无控播放权的 guest 仍能点 ArtPlayer 播放/暂停（只是 ~4s 后被心跳强制同步）。修到 guest 在无权限时**无法操作播放器控件**。

## Root Cause（已勘定）

- `EnmokuPlayer.vue` `.control-lock { z-index:5 }`。ArtPlayer 的 `$player`(`.art-video-player`) 未建立隔离 stacking context，其内部控件 z-index 是数十量级（弹幕 overlay 用 z-index:60 才压住），故控件浮在 z-index:5 遮罩之上 → 点击穿透到控件 → guest 仍能驱动本地播放，4s 后心跳才拉回。

## Decision

不靠抬 z-index 与 ArtPlayer 内部层级打架，改用 **pointer-events**：control-locked 时给 ArtPlayer 根 `.art-video-player` 设 `pointer-events:none`（经 :deep + 锁定 class），彻底屏蔽所有播放器控件/视频点击输入。
- 弹幕开关（teleport 进 $player、已 pointer-events:auto 的子元素）仍可点。
- join-gate（$player 的兄弟，在 .enmoku-player 内）不受影响，guest 仍可点击参加/起播。
- 程序化 `art.play()/seek`（同步跟随、catchUp）是 JS 调用，不受 pointer-events 影响 → follower 仍正常同步。
- `.control-lock` 降为纯视觉提示（pointer-events:none），保留"部長が再生を操作中"文案。

## Requirements

1. control-locked（guest 无 playback 权）时：guest 点击播放器任何控件/视频区域都无法改变播放（play/pause/seek/进度条/中央按钮全失效）。
2. join-gate（未参加时）仍可点击起播；弹幕开关仍可点；弹幕气泡仍可见。
3. 解锁（房主放权或自身为房主）后，播放器控件恢复可用。
4. 不影响同步跟随（程序化 play/seek 照常）、不破坏 host 正常操作、autoplay join-gate、全屏、DanmakuOverlay Teleport。
5. 服务端 enforcement 仍是最终保险（已在阶段1，不回归）。

## Acceptance Criteria

- [ ] 房主禁止"控播放"后，guest 点播放器任何位置都无法播放/暂停/seek；4s 强制同步的现象消失（因根本点不动）。
- [ ] guest 仍能点 join-gate 参加、点弹幕开关、看到气泡。
- [ ] 房主放开"控播放"后 guest 可正常操作；房主自身始终可操作。
- [ ] host 与普通模式/全屏不回归。
- [ ] 容器内(./dx) typecheck/lint/build 全绿；kyoushitsu test 不回归。

## Out of Scope

- 仅放开部分控件（如允许全屏但禁播放控制）——本任务锁定即全屏控件一并禁用，可接受；细分留后续。
- 入房控制（epic 阶段2）。

## Technical Notes

- `.enmoku-player` 加 `:class="{ 'control-locked': controlLocked }"`；CSS `.enmoku-player.control-locked :deep(.art-video-player){ pointer-events:none }`。`.control-lock` 提示设 `pointer-events:none`。
- 确认 ArtPlayer 根 class（`art.template.$player` 即 `.art-video-player`）。弹幕 toggle 的 pointer-events:auto 在 pointer-events:none 父下仍可点（CSS 允许子级重启）。
- 验证用 ./dx（禁裸 docker）；本机 headless 难验 pointer-events 交互，逻辑+计算样式确认 + 用户实机最终确认。
