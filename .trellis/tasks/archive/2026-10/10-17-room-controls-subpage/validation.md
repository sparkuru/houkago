# 房间控制子页面视觉优化验证记录

日期：2026-10-17

状态：实现与质量门已完成；子 task 仍为 `in_progress`，本次未提交、未推送、未归档。

## 交付范围

- 重做房间控制原生 dialog 的视觉壳层：Warm Club 纸张层、紧凑页眉身份与连接状态、42/58 双栏桌面布局、移动端单栏底部 sheet。
- 将房间信息、成员在线/历史、权限摘要、入室治理、权限预设、待审批和成员名册组织成现代 SaaS 控制台，减少嵌套卡片、厚重边框和无效留白。
- 根据 `packages/kyoushitsu-core/src/theme/theme.css`、`HEAD` 基线、通用 Card/Button 配方和未改动房间页面恢复 Warm Club 语义层：纸色 canvas/surface、木色边框与主操作、墨色文字、青绿色状态/焦点/选中；未引入新的 raw palette。
- 主理人左侧收敛为一行只读“当前来宾权限”摘要，右侧以唯一的“来宾权限”编辑分组承载互斥方案和三个具体权限；guest 弹窗按单栏内容收窄，成员总数只在成员分组显示一次。
- 保留既有 `RoomRuntime`、权限判断、入室/审批回调、原生 dialog 语义、关闭与焦点回归行为；未改动服务器契约或房间运行时权威来源。
- 为成员表增加手机端标签化重排，为控制项保留至少 44px 命中区，补齐状态文字、`aria-pressed`、fieldset/legend 和 reduced-motion 行为。
- 更新组件规范，记录 dialog 动画不得缩放交互容器，以及共享 `.room-form`/`.room-check` 样式的覆盖顺序约束。
- 根据中文截图进行多轮收敛：压缩页眉无效空白、移除房间名在页眉与信息卡片中的重复表达，将重复的“状态”标签拆为连接状态与入室状态，并在手机端保留两列紧凑摘要网格以避免无效纵向留白。

## 本轮局部重构：来宾权限

- `GovernancePanel` 的来宾权限改为三层结构：模块标题与当前方案标签、单一分段方案选择器、权限明细行；保留三种方案、三个 Checkbox 和原有 `room.setPermissions` 回调。
- 方案选项共享一个 Warm Club 纸色容器，只有选中态使用青绿色强调；权限明细改为无独立卡片的横向配置行，行内同时显示权限名称与“允许/禁止”，只有命令 pending 的真实 `disabled` 状态降低可用性。
- 将重复的权限分组标题改为“权限明细”，并保留方案自定义提示、服务端状态同步、焦点与 44px 控件约束；入室设置、待审和成员名册未改变业务逻辑。
- 截图复核发现并修正了分组标题重复问题；最终桌面/手机截图显示方案与权限明细的视觉形态已明显区分，区域高度减少且上下模块衔接连续。

## 自动化验证

| 检查 | 结果 |
| --- | --- |
| `./dx bun run contract:drift` | 通过；59 个 HTTP operation，18 个生成文件 byte-stable |
| `./dx bun run lint` | 通过；Biome checked 286 files |
| `./dx bun run typecheck` | 通过；7 个 workspace package 全部通过 |
| `./dx bun test packages/kyoushitsu-react/test` | 通过；54 pass / 0 fail |
| `./dx bun run test` | 通过；459 pass / 0 fail |
| `./dx bun run --filter houkago-kyoushitsu-react build` | 通过；保留既有 dash.js CommonJS 与 chunk-size warning |
| `git diff --check` | 通过；无空白错误 |
| `python3 ./.trellis/scripts/task.py validate 10-17-room-controls-subpage` | 通过；implement/check 各 13 项上下文 |

本轮局部重构后的最终受影响检查：Lint、7 workspace TypeScript、React 单测 54/54，以及
Playwright `room-controls-desktop` / `room-controls-phone` 14/14 均通过；浏览器用例新增覆盖
分段方案选中态、当前方案回显和“播放控制” Checkbox 的服务端状态同步。

## 浏览器与截图验证

使用现有预览服务（`127.0.0.1:9999` / `127.0.0.1:9998`）和项目 Playwright 镜像运行；最终截图额外挂载临时 Noto Sans CJK SC 字体，以按真实中文字宽复核排版：

```text
docker run --rm --network host --user "$(id -u):$(id -g)" \
  -e HOME=/app/.devhome \
  -e PLAYWRIGHT_BASE_URL=http://127.0.0.1:9999 \
  -e PLAYWRIGHT_HOUSOU_URL=http://127.0.0.1:9998 \
  -v "/home/wkyuu/cargo/repo/07-houkago:/app" \
  -v "/tmp/houkago-room-controls-subpage:/output-root" \
  -v "/tmp/houkago-room-player-fonts:/app/.devhome/.fonts:ro" \
  -w /app houkago-dev:playwright \
  ./node_modules/.bin/playwright test \
  --config packages/kyoushitsu-react/playwright.config.ts \
  --project=room-controls-desktop --project=room-controls-phone \
  --output=/output-root/second-v2
```

结果：14 passed（桌面/手机双 project），47.6s；同时覆盖 host/guest 权限结构、guest 自适应宽度和表单状态。

覆盖了：

- 房间控制 dialog 的桌面 1280px 与手机 375px 视口；
- 320x740 极窄移动 dialog 的纵向滚动与表格重排；
- 768/850/851/1199/1200/1280/1440/2048 的房间布局回归，以及短视口和横屏；
- native dialog 入口动画完成后测量控件，全部按钮/select >=44px；
- dialog body 与 phone dialog 无水平溢出；
- reduced motion 下 dialog/backdrop 动画时长为即时；
- 关闭/焦点回归、权限预设、成员治理与既有房间播放/队列/聊天行为。

最终截图：

- `/tmp/houkago-room-controls-subpage/second-v2/room-controls-speed-dial-d-10b53--settings-and-copy-feedback-room-controls-desktop/room-controls-dialog.png`
- `/tmp/houkago-room-controls-subpage/second-v2/room-controls-speed-dial-d-10b53--settings-and-copy-feedback-room-controls-phone/room-controls-dialog.png`
- `/tmp/houkago-room-controls-subpage/permission-v4/room-controls-speed-dial-d-10b53--settings-and-copy-feedback-room-controls-desktop/room-controls-dialog.png`
- `/tmp/houkago-room-controls-subpage/permission-v4/room-controls-speed-dial-d-10b53--settings-and-copy-feedback-room-controls-phone/room-controls-dialog.png`

已人工查看带临时中文字体的第二轮桌面与手机截图：Warm Club 纸色/木色/青绿色关系与其他页面一致；桌面 42/58 比例、紧凑摘要、右侧连续治理流程和权限互斥选中态清晰；手机摘要保持 2×2 网格、整体切单栏，长成员名可换行且正文继续滚动。未把自动化截图当作 Awwwards/Webby/FWA 认证，仅作为实现质量与项目人审前的证据。

## 八维度自检

| 维度 | 自检结论 |
| --- | --- |
| 排版 | Warm Club display serif 用于 dialog/section 标题，14px body 与 12/13px helper 保持紧凑层级；移动表格转为行内标签阅读模式，中文截图复核无重复房间名。 |
| 留白 | header 采用紧凑上下内距；指标用无卡片分隔线网格，成员/治理按 16/20px 节奏分组，手机摘要保留 2×2 以避免无效长页。 |
| 视觉层级 | 房间身份与连接状态是入口层，房间信息/成员/一行权限摘要是信息层，右侧入室/权限/名册是操作层；左侧只读摘要与右侧编辑方案不再重复同一标题/卡片。 |
| 色彩 | scoped semantic token 直接复用 Warm Club 纸色、木色、墨色与 teal focus/status：木色用于保存主操作，teal 用于状态、选中和允许态，保留危险/警告语义。 |
| 动效 | dialog/backdrop 使用轻量 opacity + translateY，控件使用短过渡；移除会把 44px 控件压缩到命中区以下的 scale 动画，并验证 reduced motion。 |
| 微交互 | close/保存/预设/复选框具备 hover、focus-visible、pressed/disabled 状态；原生 Escape、外部点击和焦点回归契约保持不变。 |
| 响应式 | 900px 以下切单栏，560px 以下切安全区 sheet；320px 仍保持 2×2 摘要、header 控件同排且无水平溢出，成员表可读，safe-area 与短视口均有覆盖。 |
| 原创性 | 以现有 Warm Club 纸张、剧场控制台语义和房间运行数据形成“社团控制台”视觉，而不是套用通用粉黑/霓虹 dashboard 模板。 |

本轮权限模块复核：方案选择器使用一体式控件表达互斥关系，权限明细使用平面状态行表达从属关系；在 1280px 桌面与 375px/320px 移动宽度下均无新增水平溢出或无意义大空白。

## 未覆盖项

未在真实 Safari、真实移动设备、屏幕阅读器和用户本地中文字库上做人工验收；当前自动化已覆盖 Chromium 的键盘/焦点/语义和尺寸契约。新子 task 未执行 commit，等待用户确认后再进入提交流程。
