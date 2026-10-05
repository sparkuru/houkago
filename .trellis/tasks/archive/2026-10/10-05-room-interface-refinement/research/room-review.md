# 房间界面规划证据

## Confirmed source facts

| Evidence | Observation / proposed response |
| --- | --- |
| `packages/kyoushitsu-react/src/features/room/room-contents.tsx:63` | 顶部有 overline、名称与连接文字；所有非 open 均显示连接中。信息弹窗已区分 closed/error，需统一。门禁输出原始 connection 枚举。 |
| `packages/kyoushitsu-react/src/styles/index.css:486` | room h1 为 clamp(26px,4vw,40px)，另有辅助 overline/状态；本轮收敛紧凑工作区层级。具体视觉效果在实现前 browser baseline 确认。 |
| `packages/kyoushitsu-react/src/styles/index.css:590` | 普通空舞台的 16:9 仅在 ≥851px 设置；共享契约要求空屏保持投影舞台语义与比例，手机补对齐。 |
| `packages/kyoushitsu-react/src/features/room/queue-panel.tsx:23` | 统一来源 section 目前排在节目列表之前；调整为列表在前、来源在下，对齐 room contract 下部来源入口。 |
| `packages/kyoushitsu-react/src/features/room/queue-panel.tsx:122` | delete 仅 host 显示；最新 spec 为 playlist-enabled guest 也可删除，保留非当前节目呈现保护。 |
| `packages/kyoushitsu-react/src/features/room/room-runtime.ts:428` | delete 命令仍走 host gate，需与 UI 同步改 playlist gate；command 已有 admission/open/busy/abort/error 保护。 |
| `packages/kyoushitsu-react/test/room-runtime.test.ts:128` | 旧单测明确禁止 playlist-enabled guest delete，是过时规则；新测试需验证允许与拒绝，不能只删断言。 |
| `packages/kyoushitsu-react/src/features/room/chat-panel.tsx:29` | 已有共享 composer、弹幕/发送与 WS 权限保护；整理密度与空/长文字呈现，保持发送语义。 |
| `packages/kyoushitsu-react/src/features/danmaku/danmaku-feature.tsx:330` | 已有原生 details 控制设置展开，保留渐进呈现；不新增并行设置入口。 |
| `packages/kyoushitsu-react/src/features/room/room-controls.tsx:145` | 连接状态四态映射存在可复用证据；不需新 connection 状态服务。 |
| `packages/kyoushitsu-react/e2e/room-controls.spec.ts:595`、`:779` | 现有 viewport/cinema/queue/composer 与 layout-parity 行为/几何 runner，优先扩充而非重复测试。 |

锚点来自规划时源文件，执行前需按真实代码核对。以上是静态事实与设计建议，不代表本任务已运行浏览器或完成视觉验收。

## Local design research

2026-10-05 已运行项目内 CLI：

```sh
python3 .codex/skills/ui-ux-pro-max/scripts/search.py 'shared video watch room Warm Club content-first responsive editorial compact workspace' --design-system --stack react -p 'Houkago room' -f markdown
python3 .codex/skills/ui-ux-pro-max/scripts/search.py 'animation accessibility z-index loading touch empty states responsive' --domain ux -n 6
```

原始 design 输出仅在 `/tmp/houkago-room-uupm-design.txt`；仓库只保存此原创决策摘要，因为 third_party/index.md 记录 UUPM exact notice/provenance 未解决。不复制源代码/CSV 或原始生成研究。

采用：媒体内容优先、辅助工具收敛、关系明确的间距、触控尺寸/间距、空态有效引导、异步反馈、键盘焦点和 reduced motion。
拒绝：landing marketing 模板、背景视频自动播放、夸大字号、粉色暗色替代 Warm Club、远程字体、无来源的转化统计、额外图标依赖和 GSAP。当地 skill 的 React Native 示例服从实际 React/Vite 与共享 spec。

## Validation classification

所有受影响房间交互 mobile-required / playwright-required；已有有效 runner 部分采用 playwright-existing-equivalent。桌面、模拟手机、iPad、short/tall、断点与文字放大验收分别记录。最终完整视觉 human-required，fixture 不能证明 upstream/实体设备/Safari；此次不扩展这些已排除范围。

## Follow-up source/drag findings (2026-10-05)

用户反馈加入 R7/R8。首轮源码 `room-speed-dial.tsx` 的 `measureViewport` 用 `viewportWidth - dockRect.left + 32` 扩大右 inset，明确排除整个固定 dock；具体控件已经另有 obstacle selector，因此移除整栏 inset 能开放聊天室空白区域并复用既有避让。菜单 dock offset 是另一测量路径，需独立核对新位置下的边界。原位置 helper 的 safeArea 入参是通用契约，可保留真实设备 inset 验证，不能以测试存在推回旧的整栏禁区。

`QueuePanel` 把 URL form 与 BaiduPanel 连续挂在 source section，来源增长会线性增加整页高度。Bilibili/直接视频共用 room.preview/add，不需要为两种 URL 复制表单；百度是独立个人连接/授权/浏览流程。采用原生 source picker + 当前操作面板，保留已挂载面板状态而隐藏非活动部分，避免切换丢草稿或重新授权。可添加 typed source 描述与对应实际流程，暂不构建插件体系或新增 provider。

项目内 UUPM follow-up 研究已运行，原始输出仅保留 `/tmp/houkago-room-interface-refinement/source-picker-uupm.txt` 和 `source-picker-ux.txt`。采纳渐进展示、系统控件、清晰选中状态、gesture conflict 与层级管理；排除其 funnel marketing、粉色暗色主题、外部字体建议。以上判断来自项目代码与共享 Warm Club 契约，未复制第三方代码/CSV/资产。
