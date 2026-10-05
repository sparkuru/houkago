# 执行与验证计划

## Phase gate

用户已在最终方案摘要后批准 `开始实现`；规划与双 manifest 已校验，允许 task.py start 后实现。实现与独立检查使用 Trellis agents；dispatch 首行带实际 Active task 路径，优先 native injection，缺失/截断时读取 manifest 及全部文件。主会话拥有范围、spec、提交与归档决策。

## Ordered work

1. 读取最终审批、mainline、policy 及 manifests，检查 git dirty。保留用户原 preview/config；按 development profile 检查现有 runtime，使用 task-owned free ports、memory DB 与无 provider 凭据的隔离验证服务。
2. 在改动前运行现有 room-controls desktop/phone，记录普通/空舞台/有节目/长标题/设置展开/cinema 基线截图、真实连接显示和删除权限偏差，不把源码假设宣称为已复现 UI 故障。
3. 按设计实现 R1–R4：room 范围样式、舞台/标题/队列源顺序、dock 和 gate/copy；复用 i18n。按八维逐项观察，避免变更媒体生命周期和共享组件。
4. 实现 R5 的 UI 与 runtime permission gate，更新旧的 host-only 单测为真实契约正/负测试；增加最小双客户端可见 UI 删除验收，并保留 move/clear host-only 证明。
5. 先跑 focused unit / lint / types；完成 contract drift 后再启动浏览器验收，验收期间不改 watched artifacts。运行下面的受影响项目，缺失状态在现有有效 runner 上扩充，禁止纯 CSS 字符串断言。
6. 对最终截图及动态行为执行八维整体复核并持续修正；每次修正重跑受影响 desktop/phone 流程，最后一次改动后做完整复核。记录观察 → 修改 → 复测与残余主观判断。
7. Trellis check agent 独立复核 PRD、设计、权限流、diff 与证据，主会话核实所有发现。跑正常工程 gates，填写 validation.md；未通过项不能报告完成。
8. 提供可打开的 preview 与具体视觉验收场景、自动化结果及局限。保留原 preview；关闭任务临时服务，除非为用户验收需保留。提交/归档需用户后续授权，届时读取 commit-policy 并更新 mainline。

## Follow-up R7/R8 execution

用户两点反馈作为继续实现授权，不重复创建 task 或要求开始审批。首轮结果是历史 checkpoint，本轮只改变全视口 launcher 边界与来源呈现。

1. 实现代理直接读取已更新 PRD/design 和双 manifests，核对现有 dirty diff 属于同一 task。使用已停临时 fixture 的自由 loopback 端口重建 memory 服务，原 9998/9999 preview/config 保留。
2. 复现首轮 launcher 无法进入固定 dock、来源全量并列展示；保存改前诊断。不用旧截图冒充新缺陷复现。
3. 移除整栏 drag clamp，保留障碍/存储/安全区；验证在 dock 内打开菜单仍在视口内。抽出来源呈现、typed 选择描述和原生 select；保留两种已有流程/草稿/权限/异步生命周期。
4. 扩充现有 browser runner：真实 drag/touch+键盘进入 dock、reload/resize/菜单；来源切换/隐藏焦点/草稿预览/guest个人连接/撤权；更新 Baidu 测试为先选对应来源后执行其原成功/失败/移动限制，并在返回链接时显式切回。保持最终状态与真实 authority 断言。
5. focused unit、root lint/types/test/drift/build 和实际 graph 检查；drift 在 browser 前。受影响 room-controls/layout、real-cookie、danmaku、media、Baidu 各配对按原项目复测；状态变更覆盖不得删除成截图测试。最终八维复核与截图在新增 follow-up 子目录，历史日志保留。
6. source freeze 后独立 trellis-check 复核 R7/R8 和旧行为，追加 check-review.md / validation.md；主会话再更新 shared spec/mainline 和验收状态。最后只清理新 task-owned fixture，保留原预览。commit/archive 仍未授权。

## Engineering gates

```sh
./dx bun test packages/kyoushitsu-react/test
./dx bun run lint
./dx bun run typecheck
./dx bun run test
./dx bun run contract:drift
./dx bun run --filter houkago-kyoushitsu-react build
```

检查实际 dist/module-graph.json 和已有 boundary tests。只有运行环境/preview 代码变更才扩展 preview shell/config tests；此次不计划变更这些文件。

## Browser gates

从实际 task-owned runtime 解析 PLAYWRIGHT_BASE_URL / PLAYWRIGHT_HOUSOU_URL，不盲用默认端口。复用项目本地 Chromium；缺少 runtime/browser/permission 记录 playwright-unavailable，不能替换为静态验证。

```sh
node_modules/.bin/playwright test --config packages/kyoushitsu-react/playwright.config.ts --project=room-controls-desktop --project=room-controls-phone --project=room-layout-ipad --project=room-layout-short --project=room-layout-tall
node_modules/.bin/playwright test --config packages/kyoushitsu-react/playwright.config.ts --project=real-cookie --project=real-cookie-phone --project=media-desktop --project=media-phone --project=danmaku-desktop --project=danmaku-phone --project=baidu-desktop --project=baidu-phone
```

静态截图存 `/tmp/houkago-room-interface-refinement/`，禁用截图动画并等几何稳定；normal/reduced-motion 动态断言单独执行。补 320/375/768/812/1280/1440、850/851、1199/1200、横屏、短高视口、200% 文字、长名字/标题/无空格字符串。DOM Range/元素文字边界与 viewport 一起判断，无横向 scroll 不是文字未溢出证明。

权限 browser 使用真实 Housou cookie/WS：host 创建节目，guest 无权限无删除操作；host 授权并等 server echo；guest 从 visible UI 确认删除，双方队列收到 BANGUMI；撤权/断连后禁止命令。API 403/200 及 guest move/clear 403 利用既有真实测试夹具补最小断言。媒体/provider 使用受控 fixture，明确不证明真实 upstream。

共享 theme/组件若有改动，增加 entry-desktop/phone 回归。human-required 仅用于最终主观视觉/产品判断，先完成可运行自动化。

## Screenshot follow-up execution

最新截图反馈授权取消内容自动避让，不再执行旧的no-overlap要求。实现代理先复现出席/composer被推开的真实落点；简化launcher为viewport/safe-only位置，清理仅服务障碍流程的未使用production代码。将旧避让单测/浏览器条件替换为用户明确要求的目标保持/viewport边界/位置存储/菜单与keyboard/touch检查，保留所有其它功能验收。跑focused位置/React单测、lint/types/root aggregate/build、room-controls桌面/手机和layout项目，媒体/danmaku/browser fullscreen等受影响launcher项目按风险复用当前有效runner。契约/SDK未变可复用上轮byte-stable结果，不在browser时regenerate。sourcefreeze后独立check实测截图两区，主会话同步sharedspec/evidence并只清理任务memoryfixture；原preview保留，仍无commit/archive授权。
