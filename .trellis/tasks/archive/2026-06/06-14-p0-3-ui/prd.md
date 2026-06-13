# P0 纵切3：聊天气泡 overlay + 网页全屏侧栏

## Goal

两个聊天可见性 UI（B 站直播风），都围绕「边看边聊」：
A. **聊天气泡 overlay**（弹幕姬 lite）：聊天室消息在播放器一角用**很淡的气泡**显示「谁·说什么」，可开关。非飞屏 canvas 弹幕。
B. **网页全屏保留聊天**：点网页全屏时右侧仍显示聊天室（像 B 站直播间），带箭头折叠/展开（synctv-web 缺此能力）。

## What I already know（现状）

- 聊天侧栏已通：`ChatPanel.vue` 读 `store.chat`、emit `oshaberi`；`BushitsuView` 接 `@oshaberi`→`client.send(OSHABERI)`；`store.apply` OSHABERI push 进 `chat`。SHUSSEKI 出席数已显示。
- `EnmokuPlayer` 独占 ArtPlayer 实例（component-guidelines）。BushitsuView 布局：`.bushitsu` flex（stage + ChatPanel）。
- DANMAKU 协议类型存在但本片不发样式弹幕（留后）。

## Requirements

### A. 聊天气泡 overlay（components/danmaku/DanmakuOverlay.vue）
- 叠在播放器画面之上（player 容器内定位），读 `store.chat` 最近 N 条（默认 ~5），每条淡色气泡「senderId · content」。
- 新消息浮现，旧的自动淡出/移除（CSS 过渡 + 定时移除，几秒）。
- 一个开关按钮（播放器角落或控制条）切换 overlay 显隐；关闭状态不渲染气泡。状态为本地 UI ref（state-management：纯视图状态不进 store）。
- 不挡播放器交互（pointer-events: none 容器，按钮除外）；淡到不喧宾夺主。

### B. 网页全屏保留聊天侧栏
- 网页全屏切换按钮：开启 → `.bushitsu` 容器 fixed 占满视口，player 占主区、ChatPanel 仍 docked 右侧；关闭 → 复原 inline 布局。状态 `webZenmen` 本地 ref。
- 布局级实现（非 ArtPlayer 内置 fullscreenWeb——后者不预留聊天列）；ArtPlayer 随容器尺寸自适应。
- ChatPanel 折叠箭头：可把侧栏收成细条/隐藏，留一个箭头按钮重新展开；普通与网页全屏布局下都可用。折叠状态本地 ref。

## Decision（ADR-lite）

**Context**: design §7/§8 原设想 weizhenye/Danmaku canvas 飞屏渲染聊天弹幕。用户细化 P0 UX 为「弹幕姬」式淡气泡 overlay + 网页全屏侧栏（B 站直播间体验），而非飞屏弹幕。
**Decision**: P0 聊天弹幕 = 自有 Vue/CSS 淡气泡 overlay 组件（DanmakuOverlay），可开关；**不引入 canvas 弹幕引擎**。网页全屏走布局级实现保留右侧聊天 + 折叠箭头。
**Consequences**: P0 无新依赖、实现轻；飞屏 canvas 弹幕引擎（weizhenye/Danmaku）推迟到样式化 DANMAKU / 文件弹幕切片（密集弹幕才需 canvas 性能）。design §7/§8 回填此偏离。

## Acceptance Criteria

- [ ] overlay 显示最近 N 条 chat 淡气泡、新增浮现旧的淡出、开关可隐藏；不拦截播放器点击。
- [ ] 网页全屏：player + 右侧 ChatPanel 同屏；折叠箭头可收起/展开聊天；退出复原。
- [ ] 容器内 typecheck/lint/build 全绿；组件卸载无残留定时器/监听。

## Definition of Done

- 纯展示组件，逻辑（气泡生命周期/折叠/全屏态）在 composable 或组件本地，不污染 store（state-management）。
- design §7/§8 回填（P0 弹幕为淡气泡 overlay，canvas 引擎后置）。

## Out of Scope

- 飞屏 canvas 弹幕引擎 / weizhenye/Danmaku（后续切片）、样式化 DANMAKU 发送（color/mode）、文件弹幕(P1)、抓取弹幕(P2)、弹幕源优先级/屏蔽/速度设置、原生全屏下的聊天叠层。

## Technical Notes

- 参考（只读，禁拷）：`synctv-web/src/components/cinema/`（播放器+聊天布局），但本片要补它没有的「网页全屏保留聊天」。
- 弹幕引擎 `weizhenye/Danmaku` 本片不引入；DanmakuOverlay 是 Vue/CSS 自有实现。
- 气泡 overlay 定时移除需在 onUnmounted 清理 timer；ResizeObserver/全屏态切换勿泄漏监听。
- 验证一律容器内 `./dx`（design §16）；前端纯 UI，浏览器内人工核验留作后续（容器无浏览器自动化栈）。
