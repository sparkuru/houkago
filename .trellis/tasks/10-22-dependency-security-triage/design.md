# 安全升级候选设计

状态：用户已在调查与候选摘要后要求「帮我修复」，按最小升级路线实施；未授权部署或重启既有服务。

## 边界

保留七个 workspace、现有 Bun/Docker/dx 工作流及 HTTP/WS/媒体契约。最小修改面是 `bun.lock`、两个 Elysia 声明所在清单、React workspace 的 Vite 声明及根 `package.json` 的 js-yaml override。实施时若维持原声明，仅锁文件刷新也能容纳 Elysia/Vite，但建议将受影响声明的安全下界提高，防止重新解析回到脆弱版。禁止顺带升级 React、TanStack、Tailwind、Hey API 或迁移 Elysia 2。

## 候选

- `packages/eisha/package.json`、`packages/housou/package.json`：Elysia 安全下界至少 1.4.30，按现有风格可用 `^1.4.30`。
- `packages/kyoushitsu-react/package.json`：Vite 安全下界至少 8.1.6，紧急修复建议固定 `8.1.6` 控制本次解析范围。迁到 8.3.5 可作另一次选择，不能混淆最小修复与 latest。
- PostCSS 至少 8.5.23，Nano ID 至少 3.3.18，source-map-js 至少 1.2.2，优先在现有父范围内定向更新锁文件；最终值可以是经完整扫描的较新同系列补丁。
- 根 override `js-yaml: 4.3.2`。父 parser 的 exact pin 不能通过普通更新解除；override 必须在契约再生成与 YAML 正常样例通过后采用。等待上游修复可作为较低紧急度替代，但需要明确保留风险，不能记为已修复。

## 修复证据与风险

详见 [research.md](research.md) 和 [compatibility.json](compatibility.json)。Elysia RCE 官方公告修复字段未填，但 1.4.30 发布说明及已校验 npm 归档的键/值转义支持该候选；错误枚举上限及 multipart 单遍分组也已静态核对。不能将本项目未见动态 schema 等同于所有 Elysia 漏洞均不适用。

Elysia 验证/解析、Vite 小版本与 Rolldown binding、CSS 源图及 YAML parser 均需实际回归。Bun 运行时沿用现有 1.4.2 先建立兼容证据；运行时/镜像升级若需要，单列变更及基线，不扩大本轮范围。

## 发布与回滚

本地验证使用隔离配置、内存 SQLite 和自有测试容器。升级通过后部署/既有预览重启仍需单独明确安排；单改锁文件不会替换运行中的进程。保留变更前清单/锁文件及镜像 SHA，失败时仅恢复本批清单/锁文件并按旧锁重新安装，保留业务数据库和用户配置。安全回退会重新引入漏洞，需同步限制服务访问并记录残余风险；不执行全仓库 reset。
