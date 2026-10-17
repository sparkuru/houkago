# 悬浮按钮与快捷菜单体验优化

## Goal

在现有 React 房间播放器中，把 `+` 悬浮按钮与 Speed Dial 快捷菜单打磨成
稳定、克制且具有产品完成度的多端交互入口：保留当前房间控制能力和自由放置
契约，补齐状态反馈、菜单空间连续性、触控/键盘可用性、响应式和视觉细节。
本 task 只优化当前房间的 `RoomSpeedDial`，不扩展为跨页面通用 FAB。

设计参考为用户提供的
`/home/wkyuu/cargo/repo/04-flyMe2theStar/03-genshin/code/vibecoding/01-major-frontend/01-floating-action-button.md`；
Warm Club 的项目 token、房间运行时规约和已验收的房间布局优先于其中的通用
颜色或品牌建议。

## Background and confirmed facts

- 本 task 是 `10-12-room-player-experience` 的子 task，只覆盖现有房间中的
  `RoomSpeedDial`/房间控制呈现，不重新设计播放器、弹幕业务或房间协议。
- 当前实现已经具备：数据驱动 action API（`room-speed-dial.tsx:15-22`）、
  52px launcher、Pointer Events 拖动与点击抑制（`:42-47`, `:242-298`）、
  normalized 位置持久化与 viewport/safe-area 重新限位（`:95-154` 及
  `room-floating-position.ts`）、上下/左右菜单限位（`room-speed-dial.tsx:159-199`）、
  Escape/backdrop/focus/inert 行为（`:208-231`, `:339-415`）。
- 当前 room contract 要求自由覆盖整个 viewport（包括 attendance、player、queue
  和 composer），位置 key 与默认位置保持兼容，只在实际 web/native fullscreen
  隐藏 launcher；不能恢复旧的内容避让或固定右下角限制。
- 当前样式已有 Warm Club semantic tokens、52px action/icon、基础 stagger 和
  reduced-motion 覆盖（`packages/kyoushitsu-react/src/styles/index.css:852-1012`），
  但主按钮没有完整的 hover/pressed/disabled 反馈；菜单入场方向对
  `data-menu-placement="below"` 没有单独的空间方向；展开状态开始拖动时也没有
  明确收起/衔接策略。这些是本 task 的候选修复点，需以实现后的真实交互证据确认。
- 已有 `room-controls.spec.ts` 覆盖拖动、存储、safe-area、菜单限位、焦点、
  reduced-motion 和房间内容不被 launcher 自动挪动；新测试只补当前缺口，不复制
  CSS 字符串或实现细节。
- 用户已确认本 task 只优化当前房间，不抽取跨页面公共组件；因此现有
  `packages/kyoushitsu-react` 边界、存储/API 和父 task 的行为契约保持不变。

## Requirements

- R1（契约保持）：保留现有 action callback、权限和 dialog 行为；不新增 socket、
  room command、optimistic state、后端接口或第二个全局 FAB。保留
  `houkago.kyoushitsu.room-floating-position.v1` 的 normalized 数据格式、现有
  默认位置与自由 viewport 放置。
- R2（状态反馈）：为 launcher、action item 和展开层提供清晰且一致的默认、
  hover（支持 hover 的设备）、pressed、expanded、dragging、focus-visible、
  disabled/不可用状态；状态反馈不能改变布局尺寸或只依赖颜色。
- R3（手势）：可靠区分点击与拖动；拖动实时跟手、松手后不误触发打开/关闭；
  在菜单已展开时开始移动 launcher 要有确定的状态收敛，不留下脱离 launcher 的
  action 菜单。键盘仍可用方向键移动、Enter/Space 打开或关闭，Escape 关闭并
  恢复焦点。
- R4（菜单空间）：菜单以 launcher 为视觉原点，根据按钮上下左右位置选择方向，
  action label/icon 保持 8px 以上间距、可读和可达；在 320/375px、短视口、长
  文案和不同 action 数量下不发生横向溢出、裁切或遮挡。展开/收起动效使用
  transform/opacity、150–300ms 的可中断节奏，并与上/下展开方向一致。
- R5（响应式与安全区）：支持桌面、手机、平板、横屏、短/高视口和 virtual
  keyboard/visualViewport resize；保持至少 44×44 CSS px 的交互命中区，尊重
  `env(safe-area-inset-*)`，位置变化/刷新/resize 后仍可见可操作。
- R6（可访问性）：保留可访问名称、`aria-expanded`/`aria-controls`、关闭菜单的
  `aria-hidden` 与 `inert`、可见 focus ring、焦点进入/返回和屏幕阅读器可理解的
  移动提示；不把拖动作为唯一入口；尊重 `prefers-reduced-motion`。
- R7（视觉一致性）：沿用 Warm Club 纸色/木色/青绿色焦点语义、既有字体和
  elevation/radius token；形成内容优先、克制的悬浮层级，不引入远程字体、通用
  模板配色、持续循环动画或第二套设计系统。
- R8（验证与证据）：在已有 room-controls desktop/phone 路径中补行为和几何断言，
  并记录 320/375/768/812/1280/1440、横屏/短高、正常/reduced-motion、键盘/
  触控与安全区的实际结果及最终截图；确认房间、播放器、队列、dock、composer
  的既有行为无回归。

## Acceptance Criteria

- A1（R1）：现有 room-controls 行为、action callback、dialog/权限、位置存储 key、
  默认位置和实际 fullscreen 隐藏契约保持通过；无后端/协议/第二 socket 变更。
- A2（R2/R3）：在桌面鼠标、手机触控和键盘下，launcher 的点击、按压、拖动、
  展开/收起、快速连续操作均有稳定最终状态；展开菜单后拖动不会留下残留菜单，
  拖动释放不会误触发 action。
- A3（R4）：launcher 位于四角、上下边缘及左右边缘时，菜单完整落在可用视口内，
  展开方向与动画方向一致；长 label、action 数量变化和短视口通过最终几何断言，
  无水平溢出或不可达按钮。
- A4（R5/R6）：所有可操作目标至少 44×44px；Tab/Enter/Space/方向键/Escape、
  focus return、外部点击、`aria-hidden`/`inert`、reduced-motion 和 safe-area
  行为均有语义交互或最终状态断言。
- A5（R7）：最终桌面/手机截图按 typography、spacing、hierarchy、color、motion、
  micro-interaction、responsive、originality 八维复核；修复当前范围内每个可
  具体指出的明显问题，且不破坏既有房间视觉心智模型。
- A6（R8）：相关 unit/browser/lint/typecheck/build/contract 检查记录真实结果；
  未运行或环境不可用的项目明确标为未验证，不以静态截图或 CSS 字符串替代行为
  验收。

## Out of scope

- 后端、HTTP/WS 协议、权限模型、播放器引擎、弹幕/聊天业务和 fullscreen 子树
  业务重构。
- legacy Vue、其他页面的 FAB、全局 design-system 重构、远程字体/第三方图标库或
  持续循环装饰动画。
- 恢复旧的 dock/内容避让算法、强制吸附到边缘、固定右下角或把 launcher 变成
  会改变房间布局的 in-flow 控件。
