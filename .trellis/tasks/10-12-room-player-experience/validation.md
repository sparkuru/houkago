# 实现与验收记录

## 状态与授权

2026-10-12，基线`47f2969`，用户以「开始实现」批准当前方案。
主会话直接完成实现/检查，没有派发implement/check agent。task保持in_progress：
实现及自动检查已交付。用户随后以「不错；效果可以；先提交一版」接受视觉并授权本版提交；
人工视觉复核已解决，task暂不归档，推送和部署不在授权范围。
implement/check各23项显式context可解析。新的稳定呈现规则已同步React媒体/房间spec。

## 交付与需求映射

| 验收 | 实现及证据 |
| --- | --- |
| A1/A2 | 规划保留12张BEFORE图、实际解码/入室/加视频/模式入口和缺陷测量，见research。最终44张图包含相同状态、全屏交流以及宽度/断点/横屏矩阵。 |
| A3 | PlayerStage统一主控制、全宽进度、格式化时间、44px动作；倍速/线路/字幕/本地音量按需展开；紧凑布局当前全屏退出直接可达。原创SVG控制图标复用媒体token。 |
| A4 | 两类全屏完整覆盖视口，唯一composer进入player子树，双客户端真实WS聊天/弹幕回显，保留草稿/弹幕偏好；权限、同步、HLS/DASH、source/subtitle及本地XML回归通过。 |
| A5 | 最后源码八维复核见下表；修正全屏余白、重复控制、32/16px命中区、设置越界/层级、200%文字溢出、原生字幕遮挡、320px换行和剧场过量预留空间。用户已接受本版视觉。 |

一个PlayerDriver/ArtPlayer/HLS/DASH生命周期及RoomRuntime/socket继续拥有原有权威。
显式播放/暂停/seek/rate保留userPlayback，普通事件仍走localPlayback。
没有改HTTP/WS生成接口、权限模型、200ms抑制算法、provider grant或全局品牌/依赖。
volume/mute仅本地；自动VTT字幕避让保存并恢复原cue属性，显式定位不改。
当前节目移除后恢复composer、外部launcher、body滚动和背景可操作性。

## 工程检查

均通过`./dx`及既有`houkago-dev:playwright`运行，Bun为1.4.2。

| 命令/检查 | 结果与日志 |
| --- | --- |
| `./dx bun run lint` | 286个文件，通过；`/tmp/houkago-player-lint-final.log`。 |
| `./dx bun run typecheck` | 7个workspace通过；`/tmp/houkago-player-types-final.log`。 |
| `./dx bun run test` | 459 pass / 0 fail，89个文件，2360个断言；`/tmp/houkago-player-unit-final.log`。新增时间格式及字幕避让几何边界共4项。 |
| `./dx bun run --filter houkago-kyoushitsu-react build` | 通过；`/tmp/houkago-player-build-final.log`。保留已有媒体chunk体积警告，无新增依赖。 |
| `./dx bun run contract:drift` | 18个生成文件byte-stable；`/tmp/houkago-player-drift-final.log`。生成在浏览器前完成，未与验收并行写入watched source。 |
| `dist/module-graph.json` | 493个模块；无Vue、Pinia、Eden或`packages/housou/src`。core的`config/housou-url`属于客户端配置，并非服务端导入。 |
| `task.py validate` / `git diff --check` | 23+23项context解析通过，差异无空白错误。 |

全量测试发现两个既有CORS环境fixture在Bun 1.4.2下把undefined写为字符串。
复用仓库既有`Reflect.deleteProperty(process.env, key)`清理及恢复环境；
原安全断言保留，后端生产逻辑未改。最初455 pass / 2 fail的日志保留在
`/tmp/houkago-player-unit.log`。一次裸`bun test`未设置内存DB，被既有legacy UUID
数据保护拒绝（`/tmp/houkago-player-cors-final.log`）；没有重置/删除该数据，
最终按根test脚本的`HOUSOU_DB=:memory:`重跑459项通过。该失败不标为产品回归。

## 浏览器及截图环境

任务专用预览：`DX_BIND_HOST=127.0.0.1 DX_EXTRA_PORTS=3100,5174 ./dx bash
scripts/dev-react-preview.sh --backend-port 3100 --frontend-port 5174`。
浏览器位于既有Docker镜像，使用任务容器网络，BASE_URL为5174，HOUSOU_URL为3100；
PLAYWRIGHT_BROWSERS_PATH指向已有`.devhome/.cache/ms-playwright`。
只使用fixture账户及内存房间。预览原有服务、root配置和私人provider凭据保留。

命令：`bun node_modules/@playwright/test/cli.js test --config
packages/kyoushitsu-react/playwright.config.ts --workers=2 --output=...`，在既有
Docker容器中挂载源码运行；Noto字体只从/tmp只读挂载，未进入产品依赖/资产。

| 验收轮次 | 真实结果 |
| --- | --- |
| 全量React配置 | 76 pass / 3 applicability skips，2.5分钟；`/tmp/houkago-player-browser-final.log`及`/tmp/houkago-room-player-browser/final-all/`。入口、real-cookie、媒体、房间、弹幕及Baidu原有项目均覆盖。 |
| 最后窄屏/间距修改后9个受影响项目 | 35 pass；`/tmp/houkago-player-browser-layout-final.log`及`final-layout/`。 |
| 最终面板层级/焦点/名称后 | 35 pass，1.8分钟；`/tmp/houkago-player-browser-verified.log`及`final-verified/`。 |

3项既有skip分别为phone项目跳过桌面Baidu配对、桌面grant准备，以及desktop项目
跳过phone专用说明；它们不代表对应设备的真实provider成功。

新增媒体验收在desktop/phone均为mobile-required，覆盖：两类全屏viewport/44px边界；
两客户端chat/live echo；单一表单/草稿和弹幕偏好；无播放许可guest的本地音量；
320px实际设置→网页全屏→退出、812×375和1280×640面板边界；200%文字及长source名称；
normal/reduce的idle/inert、键盘/触控唤出和焦点保留；composition Enter不误发；
另客户端取消当前节目后的恢复。字幕用真实HLS/VTT fixture，有activeCues、两类全屏
实际渲染、自动位置恢复及显式10%定位保留断言。
最后增补video CSS尺寸观察及高度变化验收：网页模式真实resize，原生模式用Chromium
CDP viewport metrics（其Browser.setWindowBounds拒绝调整原生全屏窗口，初次失败日志
`/tmp/houkago-player-browser-resize-final.log`）；保留innerHeight及字幕线避让断言，
最终desktop/phone均通过（2 pass / 7.3秒），日志`/tmp/houkago-player-browser-resize-verified.log`。
观察器随driver销毁清理；这次生命周期修正后的React类型/build及root lint也通过。

媒体第五/第六轮保留了控件唤出/焦点失败：唤出必须重启闲置timer，
测试的程序focus也必须先断言真实可见且确实获得焦点；没有删减inert/idle断言或延长timeout。
较早手机设置越界与200%溢出分别通过viewport-clamped面板、紧凑时间排列修复。
最终截图重现320px面板选项被工具栏拦截，提升panel层级并补真实模式点击断言。
无效/中间截图与trace保留在`media-first…sixth`目录，用于追踪修复。

## 最终截图与八维复核

最终目录`/tmp/houkago-room-player-final/`，44张PNG及`metrics.json`；
脚本`/tmp/houkago-room-player-final-capture.mjs`。同一真实UI/内存cookie/WS路径，
MP4为160×90/12秒诊断图，readyState=4，播放时间增长后暂停。临时route仅替代
外部解析和媒体响应，创建后仍由真实后端/WS返回队列；不宣称真实上游/provider解析通过。
桌面1440×900，phone375×812；同名01/02/03/04/05/06对应入室、加视频、普通、剧场、
网页和原生全屏，05b/06b为交流展开。矩阵包含320、768、812、850/851/852、
1199/1200/1201、1280×640/1200和812×375，每个矩阵视口有普通/剧场，手机另含
网页全屏/交流。正常及剧场图统一回到页面顶部后取图；窄横屏剧场按原契约流式滚动，
不把模式按钮自动滚到下方时的视频负y位置误判为裁剪。

| 状态 | 桌面 | 手机 |
| --- | --- | --- |
| 入室 | [空房间](/tmp/houkago-room-player-final/desktop-01-empty.png) | [空房间](/tmp/houkago-room-player-final/phone-01-empty.png) |
| 添加视频 | [加视频](/tmp/houkago-room-player-final/desktop-02-added.png) | [加视频](/tmp/houkago-room-player-final/phone-02-added.png) |
| 普通 | [普通](/tmp/houkago-room-player-final/desktop-03-normal.png) | [普通](/tmp/houkago-room-player-final/phone-03-normal.png) |
| 剧场／半屏 | [剧场](/tmp/houkago-room-player-final/desktop-04-cinema.png) | [剧场](/tmp/houkago-room-player-final/phone-04-cinema.png) |
| 网页全屏 | [网页全屏](/tmp/houkago-room-player-final/desktop-05-web-fullscreen.png) | [网页全屏](/tmp/houkago-room-player-final/phone-05-web-fullscreen.png) |
| 原生全屏 | [原生全屏](/tmp/houkago-room-player-final/desktop-06-native-fullscreen.png) | [原生全屏](/tmp/houkago-room-player-final/phone-06-native-fullscreen.png) |
| 全屏交流 | [桌面交流](/tmp/houkago-room-player-final/desktop-05b-web-communication.png) | [手机交流](/tmp/houkago-room-player-final/phone-05b-web-communication.png) |

| 维度 | 最后源码的观察与修正 |
| --- | --- |
| 排版 | 中文可读，图标有名称，当前/总时长使用mm:ss或小时。320px去除堆叠时间的冗余斜杠后，普通控制由144px收回96px；200%允许必要换行，真实按钮边界不越375px；长线路名在select内保持。 |
| 留白 | 全屏stage从(0,0)覆盖视口，底栏96px和gradient/safe-area独立于video contain。剧场删除已过时的52px launcher预留及额外12px，恢复16px dock间隔；断点851/1200两侧保留原pin/flow。 |
| 层级 | 一组进度/播放操作，线路/字幕/音量和模式逐层展开；全屏交流默认收起。panel高于工具栏，在320px也能点模式；关闭与当前全屏退出各自明确，join/error仍可见。 |
| 色彩 | 复用media #111、white、muted #ccc及木色动作、青绿focus。white/media 18.88:1，muted/media 11.76:1；72%黑底叠在最亮白画面，white/底9.29:1、muted/底5.79:1；white/wood5.78:1。focus #2f7669配媒体底3.52:1，加暗色衬底避免亮视频吃掉焦点；不以颜色独自表达弹幕开关（图标划线+aria-pressed）。 |
| 动效 | 160ms显示反馈，2500ms闲置，焦点/面板/join/暂停/error不隐藏。normal及reduce均实际检查，reduce取消控件transition；截图关闭动画只作静态证据。 |
| 微交互 | 真实WS成功/权限检查保留；鼠标/键盘/触控可唤出，隐藏控件同时inert/aria-hidden。Escape优先收面板，web退出与native系统/API退出恢复可见焦点；IME Enter不误发，节目移除释放body/fullscreen状态。 |
| 响应式 | 上述宽度、短高、横屏及200%均有证据，44px按钮/seek、面板与当前全屏退出可达；全屏上下黑边是contain，无强制裁切。普通/剧场保留自由launcher与唯一dock，原生内表单/弹幕在fullscreen子树。 |
| 原创性 | 保留Warm Club纸色房间、暖墨、木色/青绿、投影舞台与共同观看语义；控制SVG由本任务原创。YouTube/bilibili仅参考模式/操作组织，不复制品牌素材或界面像素。 |

两个客户端/两类全屏及最终截图没有pageerror；匿名首次恢复401属于既有预期。
Chromium手机模拟和合成composition事件不证明实体软键盘、真实设备或Safari。
real-environment测试已适配折叠settings的定位，但本轮不运行私人环境验收。

## 残余复核与清理

此前human-required仅针对截图的主观视觉判断；用户以「不错；效果可以」接受本版效果，
该复核已解决，并以「先提交一版」授权提交。自动验收、实现及视觉判断均满足本轮提交条件；
不再重复请求确认。task保留in_progress，归档、推送和部署未授权。

任务专用内存预览已通过所属foreground session的Ctrl-C停止，容器
`80e8b1fe3288`确认不再运行；保留/tmp截图/log/trace供复核，不停止其它服务。
