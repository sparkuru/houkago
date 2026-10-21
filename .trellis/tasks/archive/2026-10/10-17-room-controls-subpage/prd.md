# 房间控制子页面视觉优化

## Goal

把当前房间的“房间信息 / 房间控制”原生 dialog 从一张连续、难扫描的长表单，
整理成具有 Warm Club 气质的控制工作台：先让用户看懂房间身份与当前状态，再
按成员、权限和房主治理分区操作；桌面充分利用横向空间，手机保持清晰的单列
阅读与滚动。目标品质对齐用户指定的 Awwwards、Webby Awards、FWA 获奖级网站，
但不复制通用 neon、dark gaming 或外部字体方案。

## Confirmed facts

- 这是 `10-17-floating-action-button` 之下的子 task，范围只覆盖当前 React 房间
  的控制子页面，不扩展为全局设置页或跨页面组件。
- 入口仍由 `RoomControls` 的 speed dial 打开；必须保留原生 `<dialog>`、Escape、
  backdrop dismissal、关闭后焦点回到 launcher、guest 只读视图和 host-only 治理。
- 信息真实来源仍是 `RoomRuntime` 的 `RoomState`：房间名、连接/入室状态、入室
  方式、在线/历史成员、权限、待审请求和成员名册；不新增 socket、HTTP/WS 命令、
  权限判断或 optimistic state。
- 当前 JSX 的主要视觉问题已由源码与最终截图确认：header 只剩标题/关闭按钮，
  信息行和成员表缺少分组层级，治理卡片重复“房间信息”标题；桌面留白失衡，
  手机治理内容被长内容推到视口底部；表格在窄屏没有明确的移动阅读模式。
- 项目视觉契约要求沿用 Warm Club 纸色、木色、青绿色焦点语义、既有字体与
  semantic tokens；UI/UX 检查要求至少 44px 触控目标、可见焦点、150–300ms
  克制动效、reduced-motion 和 320/375/768/1024/1440 响应式检查。

## Requirements

- R1（结构层级）：dialog header 清楚表达“房间控制/房间信息”、房间身份和连接
  状态；正文把房间摘要、成员与权限、入室治理、权限方案、待审请求、成员名册
  分成有标题和边界的 section，不重复使用同一层级标题。
- R2（信息扫描）：房间基本信息使用可扫描的状态/摘要块；成员数据保持表格语义
  与完整文本，在窄屏转换为不横向溢出的可读行；权限同时展示名称和“允许/禁止”，
  不仅依靠颜色表达状态。
- R3（治理可用）：host 的 select、password、保存、权限方案、checkbox、审批和
  移除操作继续调用现有 `RoomRuntime` 回调；pending 时保持禁用反馈；guest 不渲染
  治理表单。每个输入仍有可访问 label，交互目标至少 44px。
- R4（视觉系统）：只使用现有 Warm Club tokens；采用纸张层叠、细分隔线、克制
  elevation 和单一 accent 建立层级，避免重阴影、渐变堆叠、emoji 图标和新字体。
- R5（动效与微交互）：dialog 入场、状态/按钮 hover/pressed/focus 与 selected
  preset 有明确但可中断的反馈，优先 transform/opacity/color，单次动效保持在
  150–300ms；`prefers-reduced-motion` 下仍可读、可操作且不依赖动画。
- R6（响应式）：桌面 dialog 采用双列控制台布局并限制阅读宽度；平板过渡为紧凑
  单列；手机采用安全区内的近底部 sheet/单列滚动，header 和关闭按钮可见，正文
  不产生水平滚动，长 room id/昵称/错误文本可换行。
- R7（契约与焦点）：保留 dialog accessible name、close button、native Escape、
  backdrop 判定、信息时钟 active 生命周期、现有测试选择器所依赖的语义与 id；
  不修改房间运行时或 speed dial 位置/权限契约。
- R8（证据）：补充 host/guest、窄屏/宽屏、治理操作、焦点/关闭、无障碍和截图
  断言；完成 lint、typecheck、affected tests、browser screenshot 和八维自检，
  直到没有可由代码/截图直接指出的明显问题。

## Acceptance Criteria

- A1：host 打开“房间控制”后，dialog 在桌面呈现清晰双列信息/治理层级；guest 打开
  “房间信息”后只见信息摘要、成员和只读权限，不出现治理表单。
- A2：房间名称、连接状态、入室状态、成员数、待审数、在线/历史成员和权限文本
  均可见且无裁切；移动端 320/375px 下无水平溢出，成员表可读并保留表头语义。
- A3：现有入室方式保存、password 条件显示、权限方案/checkbox、审批、移除成员
  和错误反馈行为保持通过；命令 pending 时相关控件仍禁用并呈现稳定状态。
- A4：Tab 顺序符合视觉顺序；关闭按钮至少 44px 且有 accessible name；Escape、
  真实 backdrop click、dialog 内部 click 和关闭后 launcher focus return 均通过。
- A5：在 375/768/1024/1440 等宽度与短/高视口下，header、滚动正文、safe-area、
  section spacing、按钮命中区和错误内容都可用；reduced-motion 不产生装饰性抖动。
- A6：截图按排版、留白、视觉层级、色彩、动效、微交互、响应式、原创性八维复核；
  只保留项目 Warm Club 语言，不引入 UUPM 搜索返回的通用粉色/黑白模板。
- A7：质量检查通过，task validation 记录实际命令、截图路径、环境限制与未覆盖的
  人工设备差异；不在本 task 内提交、归档、推送或部署，除非后续另行授权。

## Out of scope

- 后端、HTTP/WS 协议、RoomRuntime、权限策略、播放器、聊天、弹幕和 speed dial
  几何/拖动行为重构。
- 新增业务状态、i18n 大规模重写、外部字体/图标库、全局 design-system 改造或
  其他页面的设置面板。
- 通过截图修改测试基线而不验证真实交互；Safari、实体设备软键盘和辅助技术的
  差异只记录为 human review 边界，不伪称 Chromium 已覆盖。

## Planning decision

采用“editorial control desk”方向：Warm Club 纸面层叠 + 单一 accent 状态标记 +
双列信息/治理网格 + 移动 sheet；保留 native dialog 的平台行为，不引入自定义路由
或新的交互模型。该方向来自 UI/UX Pro Max 的层级、可读性、触控、响应式和动效
检查项；其通用设计系统搜索返回的粉色黑白/外部字体建议与本项目身份冲突，因此
明确不采用。
