# 播放器体验复现与规约对照

本文保留实现前的诊断证据；用户已批准实现，最终结果与44张AFTER截图见[validation](../validation.md)，本文末尾的planning描述是当时状态。

## 环境与证据边界

2026-10-12，源码基线 `47f2969`，开始时工作区干净。真实 React、Housou 内存数据库、cookie 注册和房间 WebSocket；桌面 1440×900、手机 Chromium 375×812（isMobile/hasTouch）。通过 UI 注册 → 创建部室 → 解析 → 加入队列 → 设为当前 → 播放/暂停 → 剧场/网页/原生全屏 → 退出。

使用已有 MP4 12 秒测试图 fixture（160×90），readyState=4，播放时间确认增长后暂停以比较相同画面。外部视频 Range 响应由 fixture 替代，preview 由 route fixture 返回，创建视频请求转为既有 direct DTO 后交由真实后端及 BANGUMI 更新。没有使用真实上游、私人账号或 provider 凭据，也不证明真实站点视频解析成功。

宿主 Chromium 缺少 libatk；改用已有 `houkago-dev:playwright` 运行浏览器，只读挂载源码，连接 `dx` 启动的任务专用内存预览。容器缺少中文字体，最终截图额外挂载临时下载的 [Noto 官方中文字体](https://github.com/notofonts/noto-cjk/blob/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf)。产品字体/依赖未改变，未作真实系统字体或中文衬线精确验收。最终 12 张截图均已实际查看；缺字的中间截图已由可读的同名最终图替换，不用于结论。

截图目录 `/tmp/houkago-room-player-before/`，脚本 `/tmp/houkago-room-player-capture.mjs`，测量 `metrics.json`。普通/剧场为 fullPage 诊断图，全屏为原始视口图；fullPage 可能重排固定 dock，因此不把添加后的整页图中 dock 位置当作产品缺陷。截图 `animations: disabled` 不证明真实动效通过。

| 状态 | 桌面截图 | 手机截图 |
| --- | --- | --- |
| 入室、队列为空 | `desktop-01-empty.png` | `phone-01-empty.png` |
| 添加后、尚未指定当前 | `desktop-02-added.png` | `phone-02-added.png` |
| 普通观看 | `desktop-03-normal.png` | `phone-03-normal.png` |
| 剧场/半屏检查 | `desktop-04-cinema.png` | `phone-04-cinema.png` |
| 网页全屏 | `desktop-05-web-fullscreen.png` | `phone-05-web-fullscreen.png` |
| 原生全屏 | `desktop-06-native-fullscreen.png` | `phone-06-native-fullscreen.png` |

## 结论

当前播放器未满足完整的共享视觉/交互要求。R6/R7/R9 是可复现布局或触控缺陷；R8 是清楚的层级/密度问题。R10 是本次体验补齐，不能声称原 spec 已要求全屏发送。空舞台、队列下置、交流侧栏和剧场下保留 `+` 的既有方向应保留。

| PRD 要求 | 实测 / 原因 | 对照规约 |
| --- | --- | --- |
| R6 | 桌面网页全屏 screen y=16，controls y=872/h=44，bottom=916>900；手机 y=732/h=96，bottom=828>812。原生全屏的控件 bottom 恰好在视口底。继承 stage margin 是可追踪的原因。 | visual-experience：响应式无控件遮挡，固定区域 safe-area；微交互必须可达。 |
| R7 | 最终两张网页全屏图均可见右上退出文字与实时弹幕开关重叠。两者都以播放器右上角绝对定位。 | visual-experience：无裁切/重叠；层级清楚，不误触。 |
| R8 | 同时显示 ArtPlayer 进度/播放/时间和外部「播放 进度 0s/12s 倍速…」。外部进度宽129px，不随972px/1440px观看区扩展；手机普通控件高148px，几乎等于178.3px画面高度。 | visual-experience：内容优先、关系分组、观看/管理主次；UUPM 渐进展开。 |
| R9 | 外部播放32.016×44px，seek129×16px。CSS 只给 button/select 最小高度，没有最小宽度/seek命中高度。 | visual-experience：至少44×44px、统一焦点 token。 |
| R10 | 已真实发送弹幕，房间消息列表收到回显；两类全屏中 overlay 仍在 stage 内，但 composer 不在 stage，原生 fullscreenElement 不包含 composer。图片未捕获飞行弹幕正文，因此本轮不额外声称实时弹幕视觉验收通过。 | room-runtime：一个共享输入、双发送动作；media-provider-danmaku：overlay 位于 fullscreen 子树。本任务增加全屏内交流能力。 |

## 八维观察

| 维度 | 观察与后续验收 |
| --- | --- |
| 排版 | 控件像连续文字，双重时间格式不一致。改为统一 mm:ss（长视频支持小时）；200%与长标题待实现后验证。 |
| 留白 | 普通手机控件过度换行；网页全屏错误外边距。修控制层，不重做空舞台或调整许可的 launcher 自由位置。 |
| 层级 | 两套播放/进度竞争；倍速和三种模式等权堆在一起。主要播放与模式保留直接入口，次级参数折叠。 |
| 色彩 | 黑色舞台/纸色 dock 符合方向。未发现依据足够的正文低对比问题，不虚构比值；新 media 控件应复用 token 并实测对比。 |
| 动效 | 本轮仅静态诊断；后续必须验证显示/隐藏、正常与 reduced-motion，不标通过。 |
| 微交互 | 全屏进入/退出和 launcher 恢复已跑通；重叠及32px/16px目标需修；全屏输入与焦点恢复需补。 |
| 响应式 | 已复现1440/375；320、768/812、1280、断点两侧、短高与横屏属于实现后的验收。手机竖屏的16:9视频上下黑边是正常 contain，不当作缺陷或强制裁剪。 |
| 原创性 | 保留教室投影、Warm Club和共同观看语义。参考操作组织，不复制品牌配色、素材或整页构图。 |

## 参考依据和采纳范围

- [YouTube 官方：播放器大小与剧场模式](https://support.google.com/youtube/answer/6052392?hl=en)：剧场可扩大观看区而不进入全屏；参考模式区分与角落直接入口，不复制其页面。
- [bilibili 官方 web 播放页说明](https://www.bilibili.com/blackboard/activity-webplayer_.html)：说明全屏可以发送弹幕及调整屏蔽设置；该页属于版本说明，并非当前完整UI像素基线。
- 项目本地 UUPM：已运行 `search.py 'shared video watch room Warm Club content-first responsive fullscreen player danmaku' --design-system --stack react -p 'Houkago room player' -f markdown` 及 ux 搜索 `animation accessibility z-index loading touch controls`。采纳内容优先、渐进展开、44px触控、焦点、状态反馈及 stacking-context 检查；排除建议中的粉色暗主题、远程字体、背景视频/营销段落、无依据参与度数字，不形成第二套视觉系统。

## 已运行验证

- `./dx bun run contract:drift`：18个生成文件两次生成后 byte-stable，通过。
- 内存预览：`DX_BIND_HOST=127.0.0.1 DX_EXTRA_PORTS=3100,5174 ./dx bash scripts/dev-react-preview.sh --backend-port 3100 --frontend-port 5174`；API health及网页HTTP探测通过。
- 最终 capture：在已有镜像中以1000:1000运行，源码只读、临时中文字体只读，生成12张图，桌面/手机退出全屏断言通过、pageerror为空。匿名首次session恢复有预期401，初次加载/切源曾见一条被取消媒体请求；最终视频解码与播放增长通过，不将取消请求误判为播放失败。
- 中间运行修正：错误按钮名称、文本框与隐藏权限checkbox同名导致定位失败、初次测试DTO错误使视频未解码；修正仅限临时脚本，最终运行已覆盖，不改产品绕过失败。
- 这轮是诊断与规划，不是实现后完整回归；lint/typecheck/unit/build与更宽矩阵均未宣称通过。任务保留planning，未提交/归档。
