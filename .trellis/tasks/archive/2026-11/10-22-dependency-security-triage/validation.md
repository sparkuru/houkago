# 调查与修复验收

日期：2026-10-22。以下调查阶段记录保留历史状态；用户后续「帮我修复」授权的升级验收另列于后文。

## 调查阶段（修复授权前）

| 标准 | 证据与结果 |
| --- | --- |
| A1：完整盘点 | 已读八个清单，221 条外部锁记录 / 212 个唯一包版本 / 205 个包名；请求包含嵌套和可选平台包。基线 SHA256 保存在 evidence.json |
| A2：漏洞与实际影响 | npm 与 OSV 对全部版本的返回一致，6 包 / 14 公告；官方 Elysia 仓库补 2 条，共 16 条版本命中。research.md 分条记录受影响范围、修复版本、触发前提、源码边界及未验证条件 |
| A3：升级路径 | 候选版本已在 npm 实际发布，peers/engines/父依赖范围已核对；8 个候选版本 OSV 返回空命中；Elysia 两个官方归档均通过 sha512，候选三类静态修复已核对；js-yaml exact pin 阻碍及 override 方案已注明 |
| A4：差异与验证边界 | 清单、锁文件、业务代码和配置的基线校验值保持；仅新增 task 及主线调查记录。无升级、提交、部署和既有服务重启 |

已执行隔离实验：无网络、无配置/数据库、只读依赖挂载、资源限制容器中，独立 Elysia 1.4.28 应用接受一个 multipart 字段，返回 200；已证明默认解析路径可达，未执行 DoS/RCE 利用。开发镜像 Bun 实测 1.4.2。

常规网络 sandbox 首次 npm 请求因本地代理不可达而失败；经现有自动审核的窄范围网络授权后 npm 查询成功。Docker 初次受 socket sandbox 限制；只读镜像检查与无网络限额容器在自动审核授权后成功。没有遗留审批阻碍，也没有将失败请求记为通过。

本轮没有产品实现变更，因此按项目 validation policy 使用数据/链接/context/差异核对；未运行 lint/typecheck/产品全套测试或浏览器回归。升级后的必跑检查列于 implement.md，均保持待执行。

最终文档检查通过：`task.py validate` 确认 implement/check 各 9 个真实 context 条目可解析；全部 task JSON/JSONL 解析通过，本地文档链接均存在且无 TBD；原八份清单和锁文件 SHA256 未变，完整扫描 212 条结果及候选扫描 8 条结果数已断言；`git diff --check` 通过。新增文档也单独检查行尾空白和终止换行。

人审分类：本轮文档调查 `human-not-needed`，证据可直接复核；实际升级尚未授权，安全相关变更及部署决策不能引用本轮调查代替。当前未证明线上被利用或线上不存在风险；如后续要实施，按明确候选与回归门槛推进。

## 修复阶段（用户「帮我修复」授权后）

用户已批准按调查建议修复，task 经 `task.py start` 进入 in_progress。实际更改是四份清单、锁文件、三个新增安全回归及一处既有测试同步修正；产品源码与 API/权限模型未改变。完整机器证据和 SHA256 见 [remediation.json](remediation.json)。

| 依赖 | 修复前 | 最终锁定且已安装 |
| --- | --- | --- |
| Elysia | 1.4.28 | 1.4.30 |
| Vite | 8.0.16 | 8.1.6 |
| PostCSS | 8.5.15 | 8.5.31 |
| Nano ID | 3.3.12 | 3.3.20 |
| source-map-js | 1.2.1 | 1.2.2 |
| js-yaml | 4.2.0 | 4.3.2（根 override） |

Elysia 两份清单安全下界提高到 `^1.4.30`；Vite 固定 `8.1.6`。CSS 工具链使用原范围允许的安全补丁；Vite 必需的 Rolldown 1.1.5、OXC 类型、picomatch 和相关 native/Wasm 支撑包随父包更新。解析阶段意外刷新的 Bun 类型版本已恢复到原基线，保留 React/TanStack/Tailwind/Hey API 等原版本；冻结锁文件安装成功。移除了已不需要的 yaml 可选 peer，未添加无关直接依赖。

扫描完整新锁文件，220 条外部记录 / 213 个唯一版本 / 204 个包名；npm bulk 返回 `{}`，OSV 的全部 213 条结果无漏洞。请求中的版本集合与最终锁文件逐项比较一致。Elysia 上游两条未聚合公告的静态修复证据与小样例回归一并保留，未把聚合库零命中当作唯一依据。

### 已执行验证

先在 `/tmp/houkago-security-fix.dT7DxQcn` 隔离副本解析/安装，使用既有 `dx`/Bun 1.4.2 镜像，安装均指定 `--ignore-scripts`；检查复制字节一致后同步到主工作区。只读检查确认没有运行中的开发容器使用主工作区，再按冻结锁文件刷新主工作区 `node_modules`。未重启用户服务。

| 检查 | 实际结果 |
| --- | --- |
| `./dx bun --no-env-file install --frozen-lockfile --ignore-scripts` | 隔离副本及主工作区均通过；主工作区实际 Elysia/Vite/js-yaml 解析版本复核通过 |
| `./dx bun --no-env-file run lint` | 最终 290 文件通过，无自动修正 |
| `./dx bun --no-env-file run typecheck` | 主工作区七个 workspace 全部通过 |
| `./dx env HOUSOU_DB=:memory: bun --no-env-file run test` | 最终 480 pass / 0 fail，2409 断言 |
| `./dx bun --no-env-file run contract:drift` | 主工作区及隔离副本均通过，18 份生成文件双次逐字节稳定 |
| `./dx bun --no-env-file run --filter houkago-kyoushitsu-react build` | 隔离副本生产构建通过；最终产品源/清单/锁文件与测试副本一致 |
| `python3 scripts/test-preview.py` | 36 个配置/生命周期/回环探针 fixture 通过；Docker stub，不是生产部署 |
| `bash scripts/test-react-preview.sh` | 93 项 shell 行为检查通过 |
| 项目完整 React Playwright 套件，`--workers=2` | 78 pass / 3 skip / 0 fail；桌面、手机、iPad/短/高布局，包含真实 cookie、WS、权限、Range/MP4/HLS/DASH、播放器、来源和弹幕 |
| 已安装 Chromium 适配器构建和浏览器套件 | 构建及 1 项真实 content-script/worker/DNR 测试通过 |
| Hey API 实际父 parser + 正常 YAML fixture | js-yaml 4.3.2 override 兼容通过；OpenAPI JSON 路线另由契约漂移证明 |

浏览器通过项目本地 Playwright CLI 在现有开发镜像内运行，复用只读缓存；仅访问隔离站点 `http://127.0.0.1:41733`，后端内存数据库。站点 `/` 与 `/api/health` 实测就绪。三个跳过均为既有桌面/手机条件不适用项。结束后按精确容器 ID 与挂载路径核对，只停止本任务内存 fixture；无遗留运行测试服务。浏览器测试后仅调整测试同步与文档，没有改变已验证的产品源码/依赖。

### 安全回归与失败处理

新增 `packages/housou/test/dependency-security.test.ts` 三项：普通 JSON/multipart 字段保持兼容；80 个无效标量的验证错误列表不超过 64 项；带引号/换行的 schema 名称及默认值按数据处理。旧依赖上兼容项通过，错误枚举得到 80 项而失败，带引号 schema 触发编译语法错误；升级后 3/3 通过。无大载荷、无命令执行、无监听/凭据/数据库。

首次主工作区聚合复跑为 479 pass / 1 fail：Baidu 授权测试在客户端 close 事件后立即读 grant，偶发先于服务端离线处理而得到 200。源码证据显示服务器在 close handler 中撤销授权后才广播 `SHUSSEKI`；测试现在在关闭前监听另一客户端的离线快照，再执行原 HTTP403 断言。没有轮询直至通过、扩大超时、放宽断言或改动授权逻辑；单项和最终 480 项均通过。

一次单项复跑漏设 `HOUSOU_DB=:memory:`，打开了根目录已有 `houkago.db`；legacy ownership 启动保护在测试体运行前中止。未重置、删除数据库或执行测试账户操作。该打开过程触及 SQLite 的 WAL/SHM 元数据，不能描述为从未访问持久库；后续明确使用内存库。已向用户说明，并把单项测试命令与 WebSocket 权威完成条件写入 development-principles。

一次 YAML 探针误把 parser 返回的 `{schema}` 包装层和 schema 直接比较；按真实 API 解构后通过，未改产品代码。工具路径复核中也纠正了 Bun 虚拟存储带 peer 后缀、以及 Hey API 仅 ESM 导出的解析方式；最终以实际链接位置核对版本。

保留非失败警告：特殊带引号 schema 触发 exact-mirror 优化器回退但请求断言通过；生产构建保留 dashjs 的 CommonJS-in-ESM 和大 chunk 警告，实际媒体浏览器回归通过。没有隐藏日志或放宽检查。

### 完成边界

A1–A5 已由盘点、扫描、修复及上述回归满足。任务保留 in_progress；2026-11-07 用户要求「提交」，本地工作提交已获授权，归档、推送和部署仍不在范围内。当前依赖修复不代表线上实例已更新；也没有完成实机 Safari/Android、真实外部 Baidu、Debian/浏览器/宿主全量 CVE 或入侵取证。此次变更无视觉设计或权限策略调整，无新增人类专属验收项；部署决策与提交授权分开处理。

## 提交前复核（2026-11-07）

全部七份实现文件的 SHA256 仍与 remediation.json 已通过验证的快照一致；完整 213 版本集合也与原扫描请求一致。上下文清单解析、task JSON/JSONL、本地文档链接及 `git diff --check` 通过，暂存区复核前为空，未发现无关改动。实现没有变化，因此复用上述真实回归结果，不重复运行全套测试。原漏洞查询属于 10-22 调查快照，本次本地提交不声称进行了 11-07 最新漏洞重扫。
