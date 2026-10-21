# 实现与验收记录

## 状态与范围

本 task 是 `10-12-room-player-experience` 的子 task，范围仅限当前房间的
`RoomSpeedDial`。用户已确认不抽取跨页面 FAB，并以「开始实现」授权实现。
当前 task 保持 `in_progress`；本次实现已获提交授权，仍未推送、未归档。

未改动后端、HTTP/WS 契约、权限模型、播放器生命周期或房间权威状态；没有新增
依赖、socket、optimistic state 或第二个全局悬浮按钮。

## 实现结果

- `room-speed-dial.tsx`
  - 使用 `visualViewport`、`ResizeObserver` 和条件更新重新测量菜单，保持水平限位、
    上下展开、safe-area、portal、normalized position/storage 契约。
  - 菜单展开时开始拖动会先收起菜单；拖动后的合成 click、键盘 Enter/Space 和下一次
    正常点击不会互相吞掉；继续保留 pointer capture、方向键移动、Escape/focus return。
  - action 支持原生 `disabled`/`title` 语义，保留现有 callback/dialog/navigation 行为，
    补充可拖动与 Enter/Space 提示。
- `index.css`
  - 补齐 launcher/action 的 expanded、pressed、dragging、disabled、hover、focus-visible
    层级；below 菜单使用向下进入方向；label 使用内容宽度 + 最大宽度换行，避免窄屏中文
    逐字压缩后把动作项推出视口。
  - 复用 Warm Club semantic token、52px icon/launcher、44px label 命中区、8px 间距，保留 reduced-motion 和 safe-area 规则。最终移除菜单标签与图标圆钮的独立阴影，仅保留主 launcher 的浮层阴影，避免阴影叠加形成菜单右侧和底部的矩形灰边。
- `room-controls.spec.ts`
  - 增加 Space 打开、展开中拖动收敛、四角/边缘上下方向和最终 action viewport 几何断言。

## 工程检查

| 检查 | 结果 |
| --- | --- |
| `./dx bun run contract:drift` | 通过；18 个生成文件 byte-stable，浏览器验证前完成 |
| `./dx bun run lint` | 通过；Biome 检查 286 个文件，无修复 |
| `./dx bun run typecheck` | 通过；所有 workspace package exit 0 |
| `./dx bun run test` | 459 pass / 0 fail，89 个文件，2360 个断言 |
| `./dx bun test packages/kyoushitsu-react/test` | 54 pass / 0 fail，11 个文件，250 个断言 |
| `./dx bun run --filter houkago-kyoushitsu-react build` | 通过；保留既有 chunk size warning，无新增错误 |
| `git diff --check` | 通过 |
| 临时诊断日志扫描 | changed product/e2e files 无 `console.log` 或诊断残留 |
| 房间运行时规范同步 | 记录 action label 的内容宽度约束与拖动后合成 click 抑制清理规则 |

## 浏览器与预览证据

复用已有健康的项目预览：前端 `http://127.0.0.1:9999`，API
`http://127.0.0.1:9998`；使用项目本地 `houkago-dev:playwright` 镜像及 fixture
房间。最终矩阵命令为：

```sh
docker run --rm --network host \
  --user "$(id -u):$(id -g)" \
  -e HOME=/app/.devhome \
  -e PLAYWRIGHT_BASE_URL=http://127.0.0.1:9999 \
  -e PLAYWRIGHT_HOUSOU_URL=http://127.0.0.1:9998 \
  -v /home/wkyuu/cargo/repo/07-houkago:/app \
  -w /app houkago-dev:playwright \
  ./node_modules/.bin/playwright test \
  --config packages/kyoushitsu-react/playwright.config.ts \
  --project=room-controls-desktop --project=room-controls-phone
```

结果：14 pass / 0 fail（桌面 7、手机 7，46.2s）。另在最终源码上重跑关键截图用例：
4 pass / 0 fail（桌面/手机各覆盖 speed dial 与自由放置）。截图临时证据位于
`/tmp/houkago-floating-action-button/final-screens/`，包括 normal/cinema、边缘放置、
短/高视口、phone 375×812、desktop 1280×900/2048×1196；测试还覆盖 320、768、812、
1199/1200/1440、短高 1280×640、横向 812×375、cinema、reduced-motion 和注入的
safe-area padding。

覆盖的最终状态包括：

- 鼠标/触控拖动、点击/快速连续点击、键盘 Enter/Space/方向键/Escape、焦点进入/返回；
- `aria-expanded`、`aria-controls`、关闭态 `aria-hidden`/`inert`、backdrop dismissal；
- 菜单上/下展开、action 全部在视口内、16px/safe-area 限位、位置刷新后恢复；
- room/player/queue/attendance/composer/cinema 仍可达，现有 callback/dialog/copy feedback
  流程通过。

宿主机直接启动 Chromium 曾因缺少 `/usr/bin/google-chrome` 和 `libatk-1.0.so.0`
失败；按项目规范改用上述已有镜像后验证通过，没有安装宿主机系统包。

## 最终八维复核

| 维度 | 最终观察与修正 |
| --- | --- |
| 排版 | label 不再被 flex 压缩成逐字换行；短/长文案使用可读换行和完整 `title`，按钮盒体保持稳定。 |
| 留白 | 继续使用 4/8px 节奏，action 与 launcher 保持 12px 菜单间隔，8px action gap；未改变房间布局流。 |
| 视觉层级 | launcher 使用 accent，expanded/dragging 提升层级；菜单标签与图标使用纸色 surface + 边框直接浮于内容之上，仅 launcher 保留 floating elevation，避免形成组阴影矩形边界。 |
| 色彩 | 沿用 Warm Club 的 paper/wood/teal semantic token；hover/pressed/focus/disabled 不只依赖颜色，focus ring 保留。 |
| 动效 | transform/opacity 入场 260/180ms、退出 180/140ms；above/below 方向一致，reduced-motion 仍移除装饰性位移与 stagger。 |
| 微交互 | 修复拖动后误吞下一次 click/Enter；展开中拖动先收菜单；触控、键盘、backdrop、Escape 和 focus return 均有最终状态断言。 |
| 响应式 | 375 手机、320 窄屏、横屏、短高、768/812 中间尺寸及 1280/1440/2048 桌面通过；边缘菜单和 safe-area 不越界。 |
| 原创性 | 保持既有 Warm Club 教室/共同观看心智模型，仅打磨当前房间入口；未引入通用 neon/dark gaming 模板或第二套设计系统。 |

剩余仅为实体设备 Safari、真实软键盘和辅助技术阅读器的人工差异，Chromium
mobile emulation 不宣称覆盖这些环境；相关自动化已通过。现阶段 human review 为
`human-optional`，不阻塞当前实现交付；提交、归档、推送和部署仍需另行授权。
