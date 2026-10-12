# 房间播放器与全屏交流设计（已批准实现）

## 方向与边界

沿用 Warm Club，纸色房间内承托一个安静的媒体舞台。普通布局保留队列和 dock；剧场保留交流及 `+`；网页/原生全屏只显示完整播放器子树。不增加模式，不把半屏简称转成新产品概念。问题与证据统一见 `research/player-review.md`，验收由 PRD 管理。

## 一套播放器控制

保持 PlayerStage 为 React 控件拥有者，PlayerDriver 为唯一 ArtPlayer/HLS/DASH 引擎。收敛 ArtPlayer 自带 bottom/交互遮罩，避免与 React 控件重复和绕过明确的 userPlayback 入口；保留加载、媒体失败、字幕及 guest 的参加放映 gate。播放器内部只出现一条主要进度和一组播放操作。

底部进度铺满可用宽度，视觉 track 可以细，命中区至少44px高；下方左组是播放、本地静音/音量、mm:ss时间，右组是设置、剧场、网页全屏、原生全屏。使用项目已有 SVG 语言和可访问名称，按钮44×44px起。倍速、线路、字幕放入按需展开的播放器设置面板，保留原可选值、权限及本地性。不能只隐藏原条而丢失音量功能；音量/静音仍是本地媒体状态，不进入房间同步协议。

普通与剧场下采用统一紧凑底栏，窄屏不以无组织 flex-wrap 排成三层文字。全屏下底栏位于 stage 内，用媒体语义 token 提供暗面/渐变保护文本。网页全屏覆盖inset=0，清除普通stage margin，控件与面板按dvh/safe-area限定；原生全屏应用相同内层布局。视频 object-fit contain，保留原比例和正常黑边。

## 全屏中的同一交流输入

普通/剧场继续在 ChatPanel 显示唯一共享 composer，动作顺序「弹幕」「发送」不变。全屏时把同一个表单 portal 到 PlayerStage 内专用交流容器，ChatPanel仍拥有草稿/错误状态；退出后移回 dock。不生成第二个输入、草稿或发送服务；同一时刻只渲染一次表单，保留输入ID和可访问名称，不丢草稿。

全屏底栏提供明确的交流展开入口，打开后显示暗面输入条和双动作，桌面沿底部对齐，窄屏允许有目的的两行排列；输入焦点/中文输入法组合期间禁止自动隐藏或热键抢占。入口默认收起以优先观看，但一键可达。发送沿原 room.danmaku/room.chat、can(chat)、busy gate；弹幕仅在WS回显后显示、500字仅约束弹幕。无聊天许可时说明状态，不用播放许可替代聊天许可。

DanmakuFeature继续拥有时间轴/实时显示偏好和overlay生命周期。普通dock保留来源/设置入口；全屏将原本的本地显示设置呈现到播放器内面板，复用同一状态，不再在右上角与退出按钮竞争。来源选择/房间默认权威不重做。详细面板如需portal，注册稳定target并在item/room/离室时清理；只移动呈现，不建立第二个DanmakuFeature。

## 交互与状态

- 播放时桌面指针闲置可隐藏overlay工具；移动/点击/键盘焦点使其出现。触控以点击显示/隐藏，不依赖hover。暂停、展开设置/交流、focused控件、媒体错误和join gate时保留必要工具。自动隐藏的工具同时退出焦点顺序，不能只opacity=0。
- 网页全屏Escape退出；原生依据fullscreenchange处理系统退出。设置Escape先关闭面板，退出后焦点回到对应入口；原生浏览器退出不可被面板键盘逻辑拦截。若Fullscreen API不可用，保持明确失败和网页模式可达。
- 模式切换维持当前视频/时间、线路、字幕和交流草稿；仍沿用现有进入实际全屏会取消cinema的行为。item切换按原生命周期复位并清理，不能为了模式重建引擎。
- overlay仍在.player-screen中，控制层不遮必要字幕/弹幕；controlsShown从真实可见状态传给DanmakuFeature，使通知避让正确。全屏里不出现外部launcher，普通/剧场保留用户位置。
- normal/reduced-motion均保持立即可操作；复用160/180/220ms token，reduce停装饰位移，不增加循环动画。媒体错误在stage内用可读暗面提示，不被overflow裁掉。

## 数据与兼容契约

RoomRuntime/唯一socket/服务端权限 → M1同步controller → PlayerDriver；明确播放/暂停/seek/rate仍走room.userPlayback，普通事件仍走room.localPlayback。不触碰200ms回声抑制算法、provider grant、HTTP生成接口和GENJOU/SHINKOU/DANMAKU_DEFAULT权威。新增通信容器和控件可见性只属于本地呈现状态。

共享品牌值来自core theme，已有color-media-surface/color-on-media优先；只有缺少可复用角色才添加media控件语义token。布局放React CSS，避免全局Button/Input改变引发首页回退。来源/字幕能力、锁定态和服务器回显不因工具条收敛消失。

## 实现中的具体收敛

- stage宽度小于640px时，倍速/音量/线路/字幕与剧场/网页切换在设置中展开；当前全屏退出始终留在底栏。时间采用两行或在极窄全屏省略总时长，保留当前时刻；200%文字允许有目的地换行，不挤出退出按钮。
- 面板作为stage内的fixed区域按实际visualViewport、窗口resize/scroll和自身尺寸重新限位，最大高度允许内滚动。关闭返回真实可见入口；紧凑布局退出网页模式返回设置按钮。
- 面板在工具栏之上，避免320px短屏重叠时模式动作被底栏拦截。窄屏堆叠时间不显示冗余斜杠，保持普通96px控制区；焦点用媒体衬底保护青绿轮廓。剧场移除过时launcher52px及额外12px预留，按既有spec恢复16px dock间隔，不限制launcher自由位置。
- 交流仍由唯一ChatPanel保留草稿/错误，portal只迁移表单呈现，中文composition Enter不发出消息；输入迁移重置失效的composition标志。
- 控件闲置时间为2500ms，鼠标点击唤出，触控/键盘屏幕动作切换；唤出后重新计时，焦点落在工具或打开面板时不隐藏。
- 通知/底部弹幕使用实测全屏工具高度+8px避让。原生VTT自动定位按video元素完整盒子计算，不能按16:9画面内容高度计算；指定定位不改，退出/隐藏恢复原始cue属性。验证截图发现并修正了原生字幕被控制栏压暗的问题。
- 当前Docker Bun为1.4.2。全量检查暴露两处既有CORS测试将undefined赋值为字符串；复用已有Reflect.deleteProperty清理环境并保留原安全断言，后端生产逻辑不变。

## 覆盖与回退

mobile-required：所有模式/设置/交流操作。实现后覆盖320/375、768/812、1280/1440、851和1200断点两侧、横屏和短/高屏；200%文本、长标题、触控、键盘、安全区、错误/disabled/pending和normal/reduce。Chromium模拟不代表Safari、实体软键盘或真实上游验收。

仅撤回任务自己的player/danmaku/chat呈现diff即可回退；不引入migration、开关或备用引擎。若实际修改需要超出既有业务规约，先更新任务设计并提交具体差异审阅。
