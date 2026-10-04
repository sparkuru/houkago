# 执行与验证

后续精简（2026-10-05）：按最新 PRD/design 补充删除可见 room-id label、创建 kicker 和重复提示；保留 aria-label、业务行为及配置化 figure caption。本轮复用现有 entry 桌面/手机案例，scoped lint/React types 与诊断截图验证即可；此前 broad unit/build/contract 证据保留为历史检查点，不为机械删除重复运行无关套件。

1. 复核当前首页截图、代码、历史获认可的 Warm Club 决策和本任务五项文字约束，记录追加授权。等待 focused research 并结合主设计。
2. Trellis implement agent 负责首页呈现代码与必要的现有 entry 测试更新；main 负责 task/mainline、预览、截图与迭代要求。CSS 严格限于 home，保留房间/global 组件契约。
3. 先做一次完整构图与交互实现，再运行 lint/类型检查；稳定源码后 main 检查桌面与手机的匿名、注册、登录后状态截图，对八维度逐项发现并修正缺陷。
4. 使用现有 `dx` isolated memory preview（3100/5174）；保留已有 9998/9999 预览。契约生成必须在浏览器验收前完成，禁止与验收并行写 watched 源码。
5. 检查命令：`./dx bun run lint`、`./dx bun run typecheck`、`./dx bun run test`、`./dx bun run contract:drift`、`./dx bun run --filter houkago-kyoushitsu-react build`；日志放 `/tmp`，不打印无边界构建依赖警告正文。
6. Playwright 跑 entry-desktop/entry-phone 和 real-cookie/real-cookie-phone；扩展现有布局/交互验证覆盖页面可见变化、对比、44px/focus、移动端与 reduced-motion。保持当前五项文字断言和最终导航/表单行为断言。
7. Trellis check 独立检查全部当前 task diff；main 实际查看最终桌面/手机截图，记录八维度、轮次与剩余主观问题。修复后仅复测受影响检查，必要时最终完整 scoped rerun。
8. 更新相关可执行前端呈现规范、validation 和 mainline；停止自建 fixture，保留用户原有预览。未授权提交/归档；完成后交付截图和状态供用户视觉评审。

回退仅针对本轮精确 hunks；不 reset/checkout 用户文件，不回退先前五项文字要求或历史用户修改。现有 task 内第一轮验证仍作为历史记录，本轮结果单独追加。
