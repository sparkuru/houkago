# 部員自动跟随播放：绕过浏览器 autoplay 策略（首次免点击）

## Goal

JOUEI 源同步与 transport 同步均已通，但部員(B)首次进房后**不会自动开始播放**：A 播放，B 停在黑屏，需 B 手动点一次播放，之后才完全同步（重进房仍需再点一次）。目标：B 进房后自动跟随播放，无需首次点击。

## Root Cause（已勘定）

- 浏览器 **autoplay 策略**：无用户手势的页面上，程序化 `video.play()` 被拒（NotAllowedError）。B 从未与页面交互，`EnmokuPlayer.apply()`/`alignTransport()` 里的 `art.play()` 被浏览器拦截。A 点击播放有手势故正常。
- B 点一次播放后获得手势，后续程序化 `play()` 放行 → 完全同步。重进房=新页面=手势丢失，故又需点一次。
- 次因：`art.play()` 的 rejected Promise 未 catch（控制台 Unhandled error）。黑屏亦因未开始解码首帧。

## Decision (ADR-lite)

**Context**: 真正"免点击自动播"在浏览器策略下只有"静音自动播"一条路；保留声音则必须有一次用户手势。
**Decision**: 结合方案——部員静音自动播（浏览器允许，立即有画面并跟随同步），同时在播放器上叠一个「🔊 点击开启声音」遮罩；用户点击解除静音（该 click 即手势，之后程序化 play 正常）。仅部員(非 isBuchou)启用；房主不静音、无遮罩。
**Consequences**: 部員 0 点击即跟上画面同步，声音入口清晰。代价：需维护遮罩 view 态与静音状态、解除后遮罩消失。静音状态属本地 view 态不进 store。

## Requirements（部分待策略定）

1. `art.play()` 的 Promise rejection 被妥善处理（`.catch()`，不抛 Unhandled）；rejection 时回退到静音重试播放。
2. 部員(非 isBuchou)播放器初始 `muted: true`，使程序化 play() 被浏览器允许，B 进房即静音自动跟随播放。房主不静音。
3. 部員播放器上叠「🔊 点击开启声音」遮罩（仅在仍静音时显示）；点击 → `art.muted = false`、遮罩消失。静音/遮罩为本地 view 态，不进 store。
4. 不破坏 A(房主)既有播放/广播、不破坏已连通后的双向同步、不回归 useShinkou 追従/zure 校正。
5. 首帧渲染：B 进房在 A 已播放时应能看到画面（静音自动播即解决黑屏）。

## Acceptance Criteria

- [ ] B 首次进房、A 播放后，B **无需点击**即自动开始（静音）跟随播放，看得到画面。
- [ ] B 播放器显「点击开启声音」遮罩；点击后解除静音、遮罩消失、声音正常。
- [ ] 重进房同样自动（静音）跟随。
- [ ] 控制台无 autoplay 相关 Unhandled rejection。
- [ ] A 播放/暂停/seek，B 持续同步（既有行为不回归）。
- [ ] 容器内 typecheck/lint/build 全绿；kyoushitsu test 不回归并补关键用例。

## Out of Scope

- 音量/静音偏好持久化、每用户音量记忆。
- 原生全屏下的自动播交互差异。
- 断线重连。

## Open Questions

- autoplay 策略选型（静音自动播 vs 点击加入遮罩 vs 结合）？见提问，定后写入 Decision 与 Requirements。

## Technical Notes

- art.play() 返回 Promise，需 `.catch()`；静音自动播：ArtPlayer `muted: true` 选项或设 `art.muted = true` 后 play()，浏览器允许；解除静音的 click 本身即手势。
- 仅部員(非 isBuchou)需此处理；A 有手势不受影响。
- 验证：容器内 `./dx`（强约束，禁裸 docker）；视觉/双端实跑由用户确认。
