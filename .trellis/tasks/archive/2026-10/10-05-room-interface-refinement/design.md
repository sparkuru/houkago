# 部室界面整理设计

## Direction

共享 `visual-experience.md` 是唯一视觉方向；现有部室的播放器、队列与交流心智模型不变。目标是安静而精确的放映工作区：媒体舞台形成最强重心，部室名称提供定位，辅助状态紧凑清晰，来源与管理工具留在观看区下方。

## Presentation boundaries

- `RoomContents`：收敛顶部排版与辅助提示，保留 h1；连接文字复用字典，与信息弹窗的四态语义一致。空舞台在所有普通布局用 16:9、居中投影内容；活跃节目标题/元信息紧凑，播放器仍由 `PlayerStage` 拥有。
- `QueuePanel`：番组表标题/数量 → 节目列表与动作 → host 批量动作 → 视频来源。URL 与可选标题保留可访问 label，解析为源输入动作，确认预览后加入；不减少确认步骤或改 provider 行为。列表标题可换行，手机动作货架清晰分组，危险动作采用已有 danger 语义。
- dock：复用现有 attendance、DanmakuFeature、ChatPanel，调齐标题与间距，弱化重复外框，保留弹幕源 details 展开方式。保留聊天室消息标记、用户名、共享 composer 名称与两个发送动作；不以去重为由删除权限/错误说明。
- `RoomControls` / governance：沿用原生 dialog、现有控件与 speed dial；首轮不改菜单结构、信息/权限模型或拖动算法。用户后续 R7 明确取消整栏拖动禁区，按下方方案修订测量边界。
- CSS 优先限定 `.room-page` 和 room 专属 selectors，媒体/弹幕/provider 局部样式仅在受影响时修改。字体、颜色、间距、圆角与反馈使用现有 token，保持三层体系。公共 Button/Input/global card/theme 原则上不改；若必须变更，补首页回归并记录原因。

## State and command flow

Identity → RoomRuntime → RoomSessionController / WS → immutable RoomState → components。展示改动不建立第二套状态；HTTP 仅承认命令，队列通过 BANGUMI 更新。

`QueuePanel` 单项删除可见性从 host-only 对齐 `room.can("playlist")`；保留非当前节目保护与已有 native confirmation。`RoomRuntime.delete` 使用 `command("delete", "playlist", …)`，复用 admission、open connection、busy、abort 与错误保护。move/clear 保持 host gate。后端、DTO、SDK 和权限默认值不变；若执行发现后端契约异常，停止该部分并报告，不扩展成后端任务。

连接状态复用 `RoomControls` 已有映射和 i18n 词汇；选择最小复用方式，避免为简单标签引入全新状态服务。门禁保留现有 reconnect/return 入口与保护读取边界。

## Responsive and interaction decisions

- normal ≥1200px / cinema ≥851px 固定 dock；保留 clamp(280px, 24vw, 400px)、16px workspace-to-dock gap、满高聊天和内部滚动。
- 中等宽度保持既有 sidebar 流式布局；手机 main → side → queue。长标题、名字、消息与 URL 可换行，禁止用 overflow clip 隐藏文本问题。
- closed launcher 当前按截图澄清后的 R7 自由放置：仅按视口/safe-area边界约束，文字、播放器、输入区均可作为用户落点；保留storage、pointer/keyboard与open菜单viewport/focus/inert。此前内容避让是历史checkpoint，不再作为验收。
- 保持 44px 目标、3px focus ring/2px offset、semantic role/name、Escape/backdrop/焦点返回；hover 不是动作的唯一入口。
- 独立视觉复核发现现有弹幕滑块与时间补正输入的命中高度不足、占位文字继承半透明颜色。部室范围内把输入及标签补到 44px，并将 placeholder 设为全不透明 muted token；输入、来源按钮边界使用既有木色 token 混合以满足 3:1，对首页主题与共享组件无改动。
- 常规动效复用既有节奏，仅表达状态/操作反馈；不加循环装饰。reduce 去掉装饰位移/弹跳，必要状态反馈仍可见。

## Follow-up R7/R8 decisions

- 用户此次两点反馈已授权继续实现，保留首轮已验证的变更。拖动只指 `+` 按钮；聊天室是新增可放置区域，页面/聊天面板本身不移动。
- R7 先取消整栏边界，后按截图澄清取消全部内容障碍测量与最近净空寻找。当前位置直接由归一化偏好和视口safe-area转换；菜单按实际宽高在整个视口内展开，open backdrop继续锁住底层交互。
- 下部来源区抽为房间局部呈现组件。用小型 typed source-description list 驱动 label/value 的原生 select，不新增依赖、插件注册/动态加载机制。当前是两种实际流程：视频链接（自动识别 Bilibili/公开视频）与百度网盘；以后增加一项描述和对应流程即可，队列不堆叠所有来源表单。
- 默认链接面板；一次只显示选中流程。保留非活动流程的本地状态并通过 hidden 保证不参与布局/焦点，不能切换一次就丢草稿、解析预览或百度浏览路径。无 playlist 时有效流程为百度个人连接；URL 表单按原 gate 隐藏，来源选择器仍可用于个人连接，不能因全局禁用封住它。room command pending 时禁用切换，provider 异步/原生 dialog 继续由 BaiduPanel 原所有者管理。
- 原生 select 复用 Warm Club 语义颜色、44px 高度、16px 文字和既有焦点；无横向 tab strip/大图库/营销卡片。短解释提供视频链接可接受类型，不要求用户先把 Bilibili 与直接视频分开。所有新增词汇进入 core 字典。
- 独立复核补齐浏览状态的实际用户路径：百度文件弹窗关闭后，切换来源并重新打开，应重新加载最后访问目录而非无条件 `/`。这复用原 loader/请求与 stale 保护，不增加缓存或跨会话路径存储；playlist 撤权及成功撤销连接沿既有清理重置路径和文件选择。支持类型只在持久 hint 列出，链接 placeholder 收敛为“粘贴视频链接”。
- 来源select及所有有效控件仍保留44px目标、文字换行和键盘可达；launcher可按用户选择覆盖页面，移开后原控件能正常操作。继续复核窄屏/断点/200%/短高/cinema/fullscreen，勿恢复旧的内容no-overlap禁区。
- UUPM follow-up 原始输出 `/tmp/houkago-room-interface-refinement/source-picker-{uupm,ux}.txt`；采纳渐进展开、状态保留、原生语义控件、gesture conflicts 与 z-index 检查，排除粉色暗色、远程字体和 funnel landing 建议。原视觉契约继续为唯一设计来源。

## State coverage

恢复/错误、等待/关闭/拒绝、host/guest、四态连接、空舞台/有媒体/provider 不可用、空/满队列、消息空/长文、details 折叠/展开、禁用/pending/失败/成功、普通/cinema/fullscreen 均按受影响边界检查。功能状态来自原 runtime，不能为截图伪造成功。

## Research and tradeoffs

见 `research/room-review.md`。本地 UUPM 提供研究建议，采用内容优先、间距层级、触控、明确空态/反馈与 motion/a11y 检查；排除无关 landing 构图、粉色暗色主题、远程字体和无来源统计。保留当前原创投影 SVG，优先以对齐、构图与控件细节改善完整体验，不引入新媒体资产。

## Rollback and limits

呈现与权限修复保持可辨识 diff，出问题只撤回任务自己的具体改动，不覆盖用户文件。截图/文字几何与行为证据分开；真实上游、Safari、实体软键盘不属于此次交付证明。生产部署和提交/归档等待后续授权。

## Screenshot follow-up — free placement supersedes avoidance

用户标出的出席顶部和composer底部正是上一轮h2/whole-composer障碍，先前“保留具体避让”的解释仍不满足整个页面可拖。当前R7覆盖并替代本文旧的avoidance决策：只按当前视口16px/safe-area和按钮实际尺寸约束，取消内容障碍测量/最近净空寻找；用户可以把按钮放在标题、播放器、输入和按钮区域，存储位置决定落点。保留pointer threshold/capture、键盘、归一化storage、resize/cinema/fullscreen与原菜单focus/inert/viewportclamp。删除该流程不再调用的障碍helper/observer/type，按新要求替换旧自动避让测试，坐标转换/存储/safe-area测试保留。来源呈现/权限/媒体流程继续沿用上轮实现。

验收使用截图相近2048宽及1280桌面、375手机真实touch，分别拖到出席标题和composer输入/发送区，释放后严格测目标；scroll/内容变化不推开，reload与keyboard能恢复/调整，移开后真实聊天输入/发送仍可操作。无存储偏好的首次初始位置设为右侧中段（归一化x=1,y=0.65），以免默认盖住发送按钮；已有version1存储位置仍按用户选择恢复。此默认值不测量内容、不产生禁区，底部同样可主动放置。
