# 执行计划

## 开始条件

用户已通过「开始实现」批准方案，task.py start已完成。已加载trellis-before-dev及相关frontend规范；项目要求的implement/check详细context显式注册。无implement/check子agent，主会话直接完成。

## 顺序与文件风险

1. 修复R6/R7：player-stage.css/index.css清除全屏margin与容器越界，统一全屏控制/退出层，验证不能靠隐藏溢出掩盖控件不可达。
2. 修复R8/R9：player-stage.tsx/css与player-driver.ts收敛控制；保持join gate、字幕/线路、音量/静音以及明确userPlayback。可能拆小型player-local控件文件，不能建立平行播放器或全局设置框架。
3. 补齐R10：room-contents.tsx注册稳定player通信target；chat-panel.tsx唯一composer迁移，保留草稿与dual send。danmaku-feature.tsx/css复用本地设置并接收controlsShown；避免portal remount导致状态/焦点/来源重置。
4. 在已有media-room/danmaku-room/room-controls浏览器用例中补最小缺失验收：全屏stage与控制边界、44px目标、没有重复主控制、全屏真实WS交流、草稿切换、API/system exit与焦点、锁定guest仍可本地调整显示。
5. 最后源码完整八维截图复核，修当前范围明显问题并复测；将稳定规则同步适用media/room/visual spec，只描述已实现并验证行为。

高风险面是隐藏ArtPlayer交互后是否丢失功能、portal切换是否丢焦点/草稿、自动隐藏是否留下可Tab访问的隐形控件、原生全屏top-layer中弹窗是否可见、权限撤销和断连是否仍stop commands。每个风险验证用户最终状态，不写CSS字符串镜像测试。

## 执行检查

- 先沿现有隔离内存预览，contract:drift在浏览器之前运行，生成过程与Vite验收不能并行。
- focused unit：`./dx bun test packages/kyoushitsu-react/test`，新增unit仅用于必要的控制状态/生命周期边界。
- browser：已有config，`media-desktop/phone`、`danmaku-desktop/phone`、`room-controls-desktop/phone`及`room-layout-ipad/short/tall`。运行时明确PLAYWRIGHT_BASE_URL与PLAYWRIGHT_HOUSOU_URL，按本轮经验优先使用既有带浏览器库镜像；不要重复宿主缺libatk安装。
- 收敛后：`./dx bun run lint`、`./dx bun run typecheck`、`./dx bun run test`、`./dx bun run contract:drift`、`./dx bun run --filter houkago-kyoushitsu-react build`；检查dist/module-graph.json未引入Vue/Pinia/Eden/Housou。
- 320/375/768/812/1280/1440、断点两侧、横屏、短高与200%：量控件/文字真实边界、模式进出与实际发消息；普通/剧场与两类全屏都查看最终视口图，不仅fullPage。
- 真实WS至少两客户端：play/pause权限及回声、全屏聊天与实时弹幕回显；本地XML/时间轴overlay在全屏子树保持，锁定/断连和超长弹幕仍受约束。
- 各项真实结果写任务validation；未执行不写pass。human-required只针对最后残余主观视觉验收或必要的未验证设备，不要求用户替代已可运行自动检查。

## 2026-10-12实现检查点

步骤1–5已执行；新增player-local面板/SVG图标/时间和字幕几何helper，沿用现有Driver及room runtime。
最后截图复核继续修正320px时间排列/面板层级、剧场16px间隔、字幕遮挡/视口高度刷新及焦点衬底。
459项单元、7包类型、286文件lint、React build、18项合约byte-stable通过；
全React浏览器76 pass/3既有设备适用skip，末轮9个受影响项目35 pass。
详尽证据及真实fixture/模拟边界见[validation](validation.md)。
用户随后以「不错；效果可以；先提交一版」接受视觉并授权本版提交；进入Phase 3.4，归档不在本轮范围。

## 完成边界

本版提交已授权；归档/推送/部署未授权。保持原预览/配置/数据，任务专用内存fixture已停止。回退只涉及此任务具体diff，保留用户其他修改。
