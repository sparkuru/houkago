# 首页品质优化设计

## 授权与保留要求

当前 task 已在执行；用户的后续请求授权在刚完成的首页上继续设计、实现与迭代自检。保留五项文案删改、原有全部用户文案/配置修改、配置化站名和输入框无障碍名称。扩展为首页呈现优化，不改变身份、导航、加入/创建动作或房间页面。没有新的产品功能或外部发布决策。

## 设计方向

沿用 Warm Club：暖纸、墨色、木色和青绿焦点，以“放课后为同伴留一间放映室”为原创视觉主题。借鉴获奖作品的严谨排版与完整体验，把已有邀请语“留一点时间，给彼此。”提升为左侧视觉中心，站名仍是顶部唯一小尺度 h1。原有原创教室 SVG 作为邀请语的视觉续章；主要表单建立一个入口台的秩序，加入优先，创建更安静。保留全部已有文案，不添加营销内容、假统计、装饰标签或被删文字。

## 布局与视觉

- 桌面仍为清晰两栏：左侧邀请语/说明/插画，右侧入口；调整垂直对齐、栏宽、间距，避免删标题后留下无意义的大洞。masthead 与 footer 共用对齐线。
- 邀请语使用原有 display 字体、流体字号、舒展 CJK 行高和合适行长；站名与楼层标识维持克制尺寸。subtitle 可选，长配置内容能换行。
- 手机优先 masthead、短邀请、表单，插画后置；缩短装饰区域占用，但不压缩 44px 触控区域。保持独立状态和安全边距。
- 减少每张卡片重复的粗边界/分隔/阴影，以一个清晰的主操作区域、安静的次操作区域形成层次。说明字号/段距与真实信息重要性相符。
- 颜色全部引用现有语义 token 或在 `.home` 范围内派生；表单文字与焦点对比可测。背景光线和 SVG 线条形成统一的建筑视觉，不引入全局主题变更。
- 初轮曾保留 hint、caption、closing 的重复文案；该决定已被下方最新用户精简要求覆盖。现在 `entry.hint` 只作为插画 caption 呈现，配置与用户文本仍保留。

## 动效与微交互

只做一次短暂、轻微的进入展示和真实输入/按钮的反馈。表单立即可操作；不增加加载屏、连续飘动、光标替换或 scroll hijack。为 hover-capable 指针限定 hover 反馈；focus-visible 清晰可测，按下反馈不导致文档布局偏移。Reduced motion 下无位移动画/装饰动画；异步反馈保留现有 semantic status/alert。

## 边界与风险

优先修改 Home/EntryPanel/IdentityPanel/ClassroomScene 和首页范围 CSS。不要修改共享 Button/Input/global card styles 或任何房间样式；如果需要新 class，只作为呈现钩子，不增加业务状态。字体仍为现有系统字体；本地不同 CJK 字体会产生字形差异。截图是诊断，不是自动认可基线。加载、恢复、错误、pending 与 revoked 状态保留。公开配置可长至 256 字符，布局需可容纳异常长字符串。

## 研究与评审依据

已运行项目内 UUPM `--design-system`（warm intimate cinema club editorial architectural minimal typography original）及 UX motion/accessibility 检索。采用大/小字体对比、有效留白、清晰 CTA、焦点与 motion guidance；拒绝检索中的 pink/dark palette、外部字体与无关 landing 模板。

官方参考：

- Webby judging criteria: https://www.webbyawards.com/judging-criteria/ ，内容、结构/导航、视觉、功能、交互与整体体验共同评估。
- Awwwards 实例评审页: https://www.awwwards.com/sites/redsofa ，列明设计、可用性、创意和内容维度；只借鉴严谨的视觉与体验评审，不复制作品。
- FWA https://thefwa.com/about 为客户端呈现，当前工具未获取可引用正文；原创性和交互表现作为本任务的用户要求，未编造 FWA 的量化评分规则。

停止条件：八维度自检与独立审查无未解决的明显缺陷，最终稳定源码上的响应式/行为检查通过。视觉品质仍为评审判断，不能保证获奖或声称“绝对不可提升”。
# 后续精简补充（2026-10-05）

最新用户要求覆盖此前保留所有公共提示的呈现决定：只保留插画 caption 的邀请句，该处使用 `entry.hint` 保留配置化呈现；移除 floor-hint 和 home-closing，保留公共配置/schema。加入输入移除可见 label 但保持 aria-label；创建卡片移除“新教室” kicker，保留标题与创建动作。间距延续现有 grid/form 规则，专属孤立样式可删除。最新范围以 PRD 后续精简章节为准。
