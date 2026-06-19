# 修复文件弹幕暂停与开发播放入口

## Goal

修复本地文件弹幕在视频暂停后仍继续 CSS 动画的问题，消除手填播放链接后番组表临时出现重复项的现象，并把开发期手填播放链接入口固定放到番组表下方，方便当前已有视频时继续添加测试片源。

## What I Already Know

- 人工 smoke test 通过了文件弹幕默认关闭、选择 XML、开关记忆、切换演目隔离、实时弹幕共存、全屏覆盖等 1-6 项。
- 新发现问题：文件弹幕开启时暂停视频，弹幕动画不会暂停。
- 新发现问题：填写播放链接后，下方会短暂出现两项同样内容且都为选中状态；刷新后恢复为一项。
- 用户希望在下面再加一个填链接窗口，用作 dev 测试。
- `BushitsuView.vue` 当前只有 `current` 为空时才显示手填直链 placeholder。
- `playManual()` 当前在 REST 创建后执行 `bushitsu.setBangumi([...bushitsu.bangumi, enmoku])`，而后端创建/删除接口会广播 `BANGUMI` 快照。
- `EnmokuPlayer.vue` 当前向父组件 emit `time`，但没有 emit 播放/暂停状态给文件弹幕 overlay。
- `FileDanmakuOverlay.vue` 当前使用 CSS animation，未根据播放状态设置 `animation-play-state`。

## Assumptions

- dev 填链接入口只对有 `playlist` 权限的人显示，继续沿用现有 `bushitsu.canPlaylist` gate。
- 手填链接仍然注册为房间番组表演目并立即 `JOUEI` 播放；本任务不改变后端 API。
- 文件弹幕暂停时应冻结当前屏幕上的文件弹幕动画；恢复播放后继续动画。
- 实时 `DANMAKU` overlay 不跟随文件弹幕开关，本任务不改变实时弹幕行为。

## Open Questions

- None.

## Requirements

- 文件弹幕 overlay 接收播放器播放状态；视频暂停时暂停文件弹幕 CSS 动画，恢复播放时继续。
- 演目切换时文件弹幕播放状态重置为未播放/暂停，等待播放器事件更新。
- 手填链接后不再产生本地重复番组表项；番组表应以后端 `BANGUMI` 快照为准。
- 开发期手填直链入口从“无当前演目 placeholder”扩展为番组表下方常驻 dev 表单。
- dev 表单在已有当前演目时也可继续添加/播放新链接；无 playlist 权限则不显示输入。
- 新增或更新纯逻辑测试覆盖弹幕暂停状态和番组表去重/不乐观追加的关键行为。

## Acceptance Criteria

- [ ] 文件弹幕开启并播放视频时，弹幕正常移动。
- [ ] 暂停视频后，文件弹幕当前动画冻结，不继续横移/淡出；继续播放后恢复动画。
- [ ] 输入播放链接后，番组表不会短暂显示两条同一新演目。
- [ ] 刷新前后番组表条目数量一致，不依赖刷新去重。
- [ ] 当前正在播放时，番组表下方仍有 dev 直链输入框可添加测试片源。
- [ ] 无 playlist 权限的用户看不到 dev 直链输入框。
- [ ] `bun run typecheck`、`bun run lint` 通过；相关前端测试通过。

## Definition of Done

- Tests added/updated where behavior changes.
- Lint / typecheck green.
- Manual smoke path can be repeated with `/tmp/houkago-test-danmaku.xml`.
- No backend upload/list/delete/download API added.

## Technical Approach

- `EnmokuPlayer` 增加 `playing` emit，在 ArtPlayer `play` / `pause` / `ready` 等事件上向父组件同步 `art.playing`。
- `BushitsuView` 增加 `playbackPlaying` view ref，传给 `FileDanmakuOverlay`。
- `FileDanmakuOverlay` 增加 `playing` prop，并把 CSS animation 的 `animation-play-state` 绑定为 `running` / `paused`。
- 抽出或添加小型纯函数，确保 dev link 创建成功后不再本地追加重复番组表项；依赖服务端 `BANGUMI` 快照，或仅在当前快照缺失且无广播时安全合并。
- 将 dev 直链输入区域移到番组表下方，placeholder 保持只负责“当前无演目”的播放等待/提示。

## Decision (ADR-lite)

**Context**: 前端番组表是服务端权威实时状态，`BANGUMI` 是完整快照；本地乐观 append 会与 REST 后端广播快照竞争，造成 UI 短暂重复。文件弹幕当前是 CSS P1 验证层，动画时钟必须跟随播放器状态。

**Decision**: 番组表新增项以服务端快照为准，不在 `playManual()` 里本地 append；文件弹幕动画通过播放器 `playing` 状态控制 CSS `animation-play-state`。

**Consequences**: 新片源出现在番组表会依赖服务端广播或后续刷新，但避免重复和状态竞争；文件弹幕仍是轻量 CSS 实现，暂停语义足以覆盖当前 P1 smoke test。

## Out of Scope

- 后端弹幕上传/管理 API。
- 重构整套番组表同步协议。
- 最终密集 canvas 弹幕引擎。
- 将 dev 直链入口做成正式产品化添加片源表单。

## Technical Notes

- Inspected `packages/kyoushitsu/src/views/BushitsuView.vue`.
- Inspected `packages/kyoushitsu/src/components/player/EnmokuPlayer.vue`.
- Inspected `packages/kyoushitsu/src/components/danmaku/FileDanmakuOverlay.vue`.
- Inspected `packages/kyoushitsu/src/i18n/messages.ts`.
- `packages/housou/src/routes/bushitsu.ts` and tests indicate create/delete enmoku broadcasts `BANGUMI`.
