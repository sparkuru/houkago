# Validation — 首页文案与视觉优化

以下第一组记录是五项文案调整的历史检查点。用户后续授权的首页视觉优化及最终结果单独记录在文末。

## Delivered scope

The five approved edits are implemented in Home/EntryPanel and scoped CSS/copy: caption arrow removed; public site name moved to the masthead as the sole h1; visible create-name label removed with its accessible name retained; join heading removed; join instructions rendered once in the join kicker. Other kicker surfaces and business actions remain intact.

Pre-existing edits at session start were `.trellis/spec/frontend/site-configuration.md`, `config/config.toml`, `packages/kousoku/src/site-config.ts` and dictionary `entryClosing`; all preserved. This task adds only the masthead display contract to the already-edited spec and changes dictionary `knownClassroomHint`.

## Static and unit checks

- Implementer: `./dx bun run lint` passed, 276 files, no fixes.
- Implementer: `./dx bun run typecheck` passed for all seven workspaces.
- Parent: `./dx bun run test` passed, 459 tests / 0 failures (before final presentation edits; behavioral unit suite unchanged).
- Parent: `./dx bun run contract:drift` passed, 18 generated files byte-stable, completed before browser acceptance.
- Parent: `./dx bun run --filter houkago-kyoushitsu-react build` passed. Existing upstream dashjs CommonJS/ESM warnings remain; no new dependency change.
- `git diff --check` passed.

## Browser scope and first results

Classification: `mobile-required`, `playwright-required`.

Isolated memory-backed backend/frontend started with:

```sh
DX_EXTRA_PORTS=3100,5174 ./dx bash scripts/dev-react-preview.sh --backend-port 3100 --frontend-port 5174
```

Readiness probes: `http://127.0.0.1:3100/health` and `http://127.0.0.1:5174/` passed. Existing owner preview on 9998/9999 was preserved. Fixture has no private provider credentials; identity and config are mocked for entry acceptance, not real upstream/device testing.

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174 PLAYWRIGHT_HOUSOU_URL=http://127.0.0.1:3100 node_modules/.bin/playwright test --config packages/kyoushitsu-react/playwright.config.ts --project=entry-desktop --project=entry-phone
```

First run: 19 passed / 7 failed. Six failed because the old partial `getByLabel("部室 id")` matched both the newly named join region and its textbox. Narrow the test locator to the textbox's exact semantic name, preserving product semantics and all final-state assertions. One configured-create phone case reached the expected URL but its room main was not found; unchanged isolated rerun passed (1/1). Its initial cause is unconfirmed. First-run artifacts preserved at `/tmp/houkago-entry-copy-first-browser-run`.

Final full rerun passed: **26/26** (13 desktop + 13 phone), 11.4s. The existing
configured-name case now asserts single masthead h1/configured name, absence
of removed elements/visible create-name label, retained accessible textbox,
single exact kicker instruction and successful creation/navigation. Original
join/invalid-input/logout/pending/focus/layout/reduced-motion checks passed.
Long-name layout checks cover 320/375px phone and 768/812/1280/1440px desktop,
landscape and 200% text scaling. Final reporter log:
`/tmp/houkago-entry-copy-final-browser.log`.

Independent Trellis check passed with no remaining product findings. Reviewer
edited only `e2e/entry.spec.ts`; post-edit lint (276 files), React typecheck and
diff whitespace check passed. No generators ran during the final browser run.

## Review and lifecycle

Parent inspected the configured-create phone screenshot: compact masthead name, single join instruction, no join heading/visible create-name label/caption arrow, input and button layout retained. Screenshot is diagnostic, not an approved visual baseline.

Spec review uses trellis-update-spec: no new runtime/API contract; only public-name placement is captured in the existing site-configuration spec. Task-specific copy stays in task evidence.

`human-optional`: relevant automation passed; the small mechanical text edits
leave optional visual preference review. No commit, archive, deployment or
push authorized by this request; keep task active for normal subsequent
submission. Task-owned isolated fixture stopped after validation; owner
preview remains running.

## 首页视觉优化 — 最终检查点（2026-10-05）

用户明确追加首页优化与八维度自主迭代要求，沿用当前 task。实现保持全部五项文字约束、既有 Warm Club 语义配色、用户预先修改的配置及文案。呈现变化仅影响首页；房间样式、身份恢复、创建/加入、导航和服务契约没有改动。详细范围见 PRD/design/implement。

### 迭代与独立复核

第一轮将邀请语与原创教室 SVG 合成左侧完整构图，右侧突出主要加入/登录操作、减轻创建卡片视觉重量；手机将可操作表单置于插画之前。随后实际截图与独立 Trellis check 发现并修正：

- 1024px 下短句拆词：按原文逗号分句，保留完整文字与自然断行。
- 左右 safe-area 被共用：分别处理四边安全边距。
- 合法 256 字符无空格隐私说明被 `overflow-x: clip` 隐藏：增加可换行/最小宽度约束和 DOM Range 边界检查。
- 输入占位文字约 3:1 对比度偏低：首页采用不透明 muted token；在既有匿名案例补充实际颜色、opacity 与 ≥4.5 对比度断言。

静态全页截图可能重新触发已结束的进入动画；修正截图工具为 `animations: "disabled"`，确保有限动画处于最终帧。正常及 reduced-motion 行为仍独立实测，截图设置不代表产品禁用动画。

最终独立 reviewer 与 main 均未发现当前授权范围内其他明显缺陷。此判断不等于实际获奖认证，审美接受仍由用户决定。

| 维度 | 最终实现与证据 |
| --- | --- |
| 排版 | 唯一 masthead 站名 h1；邀请语宋体显示层级、完整短句断行；1024px/812px 实际截图清晰。 |
| 留白 | 邀请语与插画作为整体对齐右侧操作区；更统一的网格、卡片间距及页脚边界，短桌面允许正常纵向滚动。 |
| 视觉层级 | 邀请语 → 登录/加入主要操作 → 较轻的创建卡片；手机先表单后插画，单条加入说明保留。 |
| 色彩 | 现有暖纸色与棕色语义 token；主要按钮正常/悬停文字对比度 5.56:1 / 8.29:1，占位文字补测 ≥4.5。 |
| 动效 | 220ms 有限进入；reduced motion 无进入/按压位移动画。正常运行最终 opacity 为 1。 |
| 微交互 | 3px 焦点圈、44px 控件；悬停颜色/阴影变化而尺寸稳定；按压去阴影、正常模式仅 1px 位移，减弱动效模式不位移；禁用状态无阴影。 |
| 响应式 | 960px 断点；320/375/768/812/1024/1280/1440px、横屏、短桌面及 200% CSS 字号检查；长站名、用户名及 256 字符说明保持可读。 |
| 原创性 | 保留本项目教室线稿，原创窗光与屏幕渐变使用 useId 防止重复 ID；未引入外部字体、位图或依赖。 |

### 最终验证

- Lint：276 文件通过；全部七个工作区类型检查通过。最后占位文字修正后 reviewer 再跑 lint 与 React 类型检查通过。
- 根行为测试：459 passed / 0 failed（8.43s）。在视觉迭代期间执行，随后仅首页换行/占位文字 CSS 与相关浏览器断言发生变更。
- `contract:drift`：18 个生成文件 byte-stable；生成工作在浏览器验收前完成。
- 完整入口/真实 cookie 桌面手机回归：38/38 passed（26.9s），包含 28 个 entry 和 10 个 real-cookie 案例。日志：`/tmp/houkago-home-polish-browser-final.log`。
- 最后占位文字修正后的受影响匿名桌面/手机案例：2/2 passed（2.1s）。日志：`/tmp/houkago-home-polish-placeholder-browser.log`。该 CSS 改动无需重复完整行为套件。
- 最终源码生产构建通过：`./dx bun run --filter houkago-kyoushitsu-react build`；日志 `/tmp/houkago-home-polish-build-final.log`。现有上游 dashjs 模块警告仍在，没有依赖改动。
- 独立交互探针通过，记录正常/悬停/按压/禁用及 reduced-motion：`/tmp/houkago-home-polish-feedback.json`。
- task implement/check context 各 19 条均 validate 通过；`git diff --check` 通过。构建 module graph 无 legacy Vue/Pinia 或 backend/eden 边界泄漏。

### 最终截图与交付边界

占位文字修正后的 10 张最终截图与布局测量位于 `/tmp/houkago-home-polish-final/`；测量无页面错误、无横向溢出。main 实际查看最终匿名/登录后桌面、匿名/登录后手机、1024px 及横屏截图；其他宽度也经过独立截图复查。截图是诊断证据，尚非用户批准的视觉基线。

入口测试使用 isolated memory fixture 的身份/config mock；real-cookie 案例使用该本地后端验证身份衔接。未声称本轮测试了真实移动设备、原生字号放大或私有媒体服务。用户原有 9998/9999 预览保持运行，本 task 的 3100/5174 fixture 在检查后停止。

本轮视觉改动按 validation policy 归为 `human-required`：实现与自动验收已经完成，用户仍需在提交/完成归档前接受主观视觉结果。只剩最终审美确认；没有未完成的已授权实现或已知产品缺陷。task 保持 active/uncommitted，未执行提交、归档、发布或 push。

## 后续精简 — 标签与文案去重（2026-10-05）

按用户最新要求，移除 `label[for="room-id"]`、创建卡片“新教室” kicker、floor-hint 和 home-closing。ID 输入保留同名 aria-label；邀请句只在插画说明呈现，来源为 `config.entry.hint`，保留可配置文案功能。创建标题、操作及原有导航/身份行为保持不变。清理被移除节点专属的无用 CSS。共享字典及配置未在本轮改写。

既有配置站名/创建 POST 案例使用一条不同于默认值的 hint，验证自定义文字仅渲染一次、caption 来源、被移除节点与创建 kicker 缺失、ID 可访问名称及最终创建/进入路径。没有新增机械删除的独立测试用例。

- 实现和独立复核各自运行四个受影响文件的 scoped Biome，以及 React typecheck，均通过。实现日志：`/tmp/houkago-entry-simplify-lint.log`、`/tmp/houkago-entry-simplify-types.log`。
- 隔离内存 fixture 3100/5174 的 health 与前端探针通过；保留现有用户 9998/9999 预览，不使用私有 provider 凭据。
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174 PLAYWRIGHT_HOUSOU_URL=http://127.0.0.1:3100 node_modules/.bin/playwright test --config packages/kyoushitsu-react/playwright.config.ts --project=entry-desktop --project=entry-phone`：**28/28 passed（13.2s）**，14 桌面 + 14 手机；日志 `/tmp/houkago-entry-simplify-browser.log`。覆盖创建/加入、身份恢复、焦点、禁用/错误、公开配置、320–1440px、横屏及 200% CSS 字号。
- 10 张最终截图及布局测量：`/tmp/houkago-entry-simplify-final/`，无页面错误、无横向溢出。main 实际查看匿名桌面、登录后桌面/手机及 1024px；reviewer 独立查看登录后桌面/手机，留白、单句提示与焦点正常。
- Reviewer 发现并删除最后一条已无匹配元素的 `.entry-create-card .card-kicker` 专属规则；无行为/画面影响，28-pass 与截图检查点保持适用。最终 scoped lint/types 和 diff check 均通过，无未解决的发现。
- Public site configuration spec 同步 `entry.hint` 的单处 caption 位置。implement/check manifests 各 19 条有效。

本轮仅机械呈现精简，未重复不受影响的根行为、生成契约或构建检查；上节结果保留为此前视觉版本的历史检查点，不冒称在本轮重跑。本轮机械删改为 `human-optional`，不需额外确认即可实现与验证；整个视觉优化 task 的主观最终接受仍待用户判断。未提交、归档或发布。检查后停止本轮 task-owned fixture，用户已有预览保持运行。

## 用户接受与提交前检查 — 2026-10-05

用户回复“不错；可以提交”，接受最终呈现并授权提交和正常闭环；随后明确“脏文件一起提交”。此前的 human-required 主观视觉等待已解决；全部当前可追踪脏文件纳入已授权提交，包括用户此前的公开提示配置、默认值和字典修改。不包含 push 或部署授权。

最终源码在提交前完成项目检查：`./dx bun run lint` 通过（276 files）、`./dx bun run typecheck` 七工作区全部通过、`./dx bun run test` **459 pass / 0 fail**（10.37s）、React 生产构建通过。日志分别为 `/tmp/houkago-entry-copy-submit-{lint,types,unit,build}.log`。构建仍仅有既有 dashjs 模块警告。最终 28 项 entry 桌面/手机检查点、此前 real-cookie/对比度和 byte-stable contract 检查适用，不为仅有文档/提交动作重复运行浏览器或生成契约。独立 review 没有未解决的产品发现。

具体文件与正常闭环顺序见 [commit-plan.md](commit-plan.md)。

## 完成与归档

工作提交：`353ff18`（`feat(ui): refine homepage layout and simplify entry copy`），包含所有已授权可追踪脏文件。任务通过 `archive --no-commit` 移至 `.trellis/tasks/archive/2026-10/10-05-entry-copy-cleanup/`，status/completedAt 已确认；活跃 task 指针已清除。归档 context 路径已同步并验证。

主观视觉接受及提交等待已解决，没有未完成的已授权工作、已知产品缺陷或提交范围外残留。保留用户预览；未进行 push、生产部署或新产品任务。
