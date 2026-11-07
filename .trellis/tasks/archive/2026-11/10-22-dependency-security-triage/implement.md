# 后续升级执行与验收计划

调查交付后，用户明确要求「帮我修复」，以下最小升级方案已获实施授权。实际结果逐项记录在 validation.md，不把计划引用为已通过证据。

1. 采用已推荐的最小 Vite 8.1.6 路线；复核最新公告与工作区差异，读取 `trellis-before-dev`、适用包规格及任务 context。
2. 保存基线清单/锁文件校验值；在隔离工作副本进行精确、无无关更新的解析。检查包脚本及来源，避免自动执行无关 lifecycle hooks；不要用整个仓库 `bun update`。
3. 第一批将 eisha/housou 的 Elysia 升至 1.4.30；检查只有目标解析变化，运行聚合 types/unit/lint、HTTP/WS/cookie 与 multipart 小样例回归。不得做大载荷 OOM 演示。
4. 第二批升级 Vite 8.1.6 并刷新 PostCSS/Nano ID/source-map-js 的安全版本，检查 Rolldown 与 native 平台包匹配；验证 root 与 Tailwind 引入的 source-map-js 副本。
5. 第三批评估根 js-yaml 4.3.2 override。验证父 parser 的正常 JSON/YAML 解析及生成结果；上游 exact pin 被覆盖的事实进入变更说明。
6. 针对完整新锁文件重复 npm bulk + OSV 扫描、补查上游公告；不能只检查六个包或只检查顶层版本。记录扫描时间与修复前后差异。
7. 按项目现有命令执行（全部使用 `./dx`，无凭据 fixture）：

   ```sh
   ./dx bun run lint
   ./dx bun run typecheck
   ./dx bun run test
   ./dx bun run contract:drift
   ./dx bun run --filter houkago-kyoushitsu-react build
   python3 scripts/test-preview.py
   bash scripts/test-react-preview.sh
   ```

8. 契约生成在浏览器回归之前完成，避免 Vite watcher 重载使浏览器结果失真。在独立内存 fixture 验证 `/api/health`、注册/登录、权限、WS、媒体 Range/HLS/DASH、来源/扩展入口；使用项目既有 React 桌面/手机浏览器套件（命令与配置见 validation policy），必要时运行已安装适配器等价覆盖。记录真实上游/手机设备未测边界。
9. 仅在相关自动化完成后进行 `trellis-check` 和要求/差异审查；失败保留日志并在当前批次修复，不放宽验证要求。更新 research/validation，区分版本清零、功能回归及尚未验证的部署状态。
10. 按项目生命周期决策再提交/归档及安排运行实例重启；保留用户配置和 SQLite。回滚仅限本次清单/锁文件及安装状态，且同步说明回退恢复的安全风险。

本轮文档验收：盘点计数、两套 API 结果一致性、候选元数据/范围、Elysia 三处静态修复、小字段 multipart 实验、context 解析、文档链接及 `git diff --check`；无需重跑未变的产品全套测试。
