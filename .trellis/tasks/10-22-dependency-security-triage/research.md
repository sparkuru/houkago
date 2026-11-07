# 依赖安全调查与升级可行性

调查日期：2026-10-22。基线：`13758a1` / `k-on`。本报告是版本与暴露面调查，不是已实施修复或线上入侵取证。

后续状态：用户在调查交付后明确要求「帮我修复」。以下正文保留修复前调查快照；实际升级与回归结果以 [validation.md](validation.md) 的修复阶段和 [remediation.json](remediation.json) 为准。

## 结论

**存在命中，建议优先升级 Elysia 和 Vite。** npm bulk audit 与 OSV 对 212 个唯一外部包版本的匹配一致：6 个包、14 条公告；补查 Elysia 官方仓库新增 2 条数据库未覆盖的公告，共 **6 个包、16 条版本命中公告**。版本命中不等同于每条漏洞均可在本项目远程利用。

- Elysia `1.4.28 → 1.4.30`：优先级高，同系列补丁；已核对官方归档中的 multipart、错误枚举、schema 转义修复。
- Vite `8.0.16 → 8.1.6`：最小覆盖此次命中公告的维护版本，属于小版本升级；现有 React/Tailwind 插件 peer 允许。也可选择当日 latest `8.3.5`，但会扩大 Rolldown/Lightning CSS 更新范围，本轮建议先评估最小路线。
- PostCSS `8.5.15 → 至少 8.5.23`、Nano ID `3.3.12 → 至少 3.3.18`、source-map-js `1.2.1 → 至少 1.2.2`：可在现有依赖范围内定向更新锁文件，但必须核对最终解析版本，不能仅升级 Vite。
- js-yaml `4.2.0 → 4.3.2`：上游 parser 精确固定 `4.2.0`，当日 latest parser 与代码生成器仍未解除；需要根清单定向 `overrides` 或等待上游修复，并验证生成契约无漂移。
- 本次没有发现 React2Shell 所需的 RSC 包/运行机制，也没有锁定 Axios 或其本次投毒事件的 `plain-crypto-js`。

**兼容性结论：具备明确升级路径；尚未安装候选依赖、重写锁文件或运行升级后的应用回归，不能称为升级验证通过。**

## 方法、覆盖与证据

已读取根 `package.json` 和七个 workspace 清单，解析 `bun.lock` 的所有外部记录，包括平台可选依赖及嵌套版本：221 条记录、212 个唯一包版本、205 个包名。锁文件中的 workspace 链接不发送到外部接口；外发仅为公共包名/版本或公告编号。源码及配置未上传。

查询接口：

- npm 官方 `POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk`。
- OSV 官方 `POST https://api.osv.dev/v1/querybatch`，命中后查询 `GET /v1/vulns/<GHSA>`。
- Elysia 官方 `GET https://api.github.com/repos/elysiajs/elysia/security-advisories`，补上仓库公告与聚合数据库间的延迟。
- npm 官方候选版本元数据及 tarball；Elysia 两个归档均通过元数据 `sha512` 校验，仅静态读取指定文件，没有安装/执行下载包。

可复核结果见 [evidence.json](evidence.json)：盘点、请求/响应、命中范围、候选版本、查询时间和基线 SHA256。元数据与静态修复核对见 [compatibility.json](compatibility.json)。npm 与 OSV 共享部分上游数据，结果一致不构成两个完全独立的安全证明。

## 命中明细

范围与修复版本按当日公告记录；以下全部当前版本均命中所列范围。

| 依赖 | 公告 / CVE | 级别 | 受影响范围 → 修复版本 | 项目影响判断 |
| --- | --- | --- | --- | --- |
| Elysia 1.4.28 | [GHSA-9643-4qgh-g8mx](https://github.com/elysiajs/elysia/security/advisories/GHSA-9643-4qgh-g8mx) / CVE-2026-56669 | High | `<1.4.29` → 1.4.29 | multipart 归一化二次复杂度，可在鉴权 handler 前消耗 CPU；见下方小载荷验证 |
| Elysia 1.4.28 | [GHSA-46qc-v7pw-4j7j](https://github.com/elysiajs/elysia/security/advisories/GHSA-46qc-v7pw-4j7j) | High | 公告字段 `<1.4.29` → 1.4.30 | 10-11 发布；非 production 构造验证异常即枚举所有错误，统一 onError 返回短消息不能撤销此前开销 |
| Elysia 1.4.28 | [GHSA-gmm9-qwx3-2m3h](https://github.com/elysiajs/elysia/security/advisories/GHSA-gmm9-qwx3-2m3h) | Critical | `<=1.4.29`；公告修复字段空 | schema 属性/默认值进入代码生成；当前 schema 来自源码，未发现用户输入生成 schema 的入口，未建立本项目远程 RCE 链 |
| Vite 8.0.16 | [GHSA-rq7h-c2jc-7f22](https://github.com/vitejs/vite/security/advisories/GHSA-rq7h-c2jc-7f22) / CVE-2026-112946 | Moderate | `>=8.0.0 <=8.1.5` → 8.1.6 | 非 Windows、开发服务可访问且特定导入路径与系统绝对路径重合时越界读；项目使用 Linux/Bun 和对外监听，具体导入碰撞未证实 |
| Vite 8.0.16 | [GHSA-9jrq-w75r-8gcw](https://github.com/vitejs/vite/security/advisories/GHSA-9jrq-w75r-8gcw) / CVE-2026-112945 | Low | 同上 → 8.1.6 | 需 middleware/custom HTML 转换；当前标准 SPA 配置未发现所需 transformIndexHtml 调用方式 |
| Vite 8.0.16 | [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm) / CVE-2026-112942 | High | 同上 → 8.1.6 | 内嵌 launch-editor；此条 Windows 前提不符合现有 Linux Docker 路线 |
| Vite 8.0.16 | [GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv) / CVE-2026-112943 | Moderate | 同上 → 8.1.6 | Windows `%` 转义问题；现有 Linux Docker 路线不满足平台前提 |
| Vite 8.0.16 | [GHSA-r825-w8mm-5pxw](https://github.com/advisories/GHSA-r825-w8mm-5pxw) / CVE-2026-112944 | Moderate | 同上 → 8.1.6 | 需特定编辑器及路径/参数条件；未证实当前容器可利用，不能因锁文件没有独立 launch-editor 包而漏报 |
| js-yaml 4.2.0 | [GHSA-52cp-r559-cp3m](https://github.com/nodeca/js-yaml/security/advisories/GHSA-52cp-r559-cp3m) / CVE-2026-59869 | High | `>=4.0.0 <4.3.0` → 4.3.0 | YAML merge 链导致 CPU DoS；用于代码生成工具，项目输入是本地 OpenAPI JSON |
| js-yaml 4.2.0 | [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj) | High | `>=4.0.0 <4.3.1` → 4.3.1 | `!!omap` 解析 CPU DoS；公告未分配独立 CVE，不把同类 CVE 冒充本条编号 |
| js-yaml 4.2.0 | [GHSA-2883-xcg3-v3hh](https://github.com/nodeca/js-yaml/security/advisories/GHSA-2883-xcg3-v3hh) / CVE-2026-84375 | High | `>=4.0.0 <4.3.2` → 4.3.2 | 空 merge 源绕过预算；升级必须覆盖到 4.3.2 |
| Nano ID 3.3.12 | [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv) / CVE-2026-67214 | High（数据库评级） | `<3.3.16` → 3.3.16 | non-secure 负 size 死循环；PostCSS 实际调用为常量 `nanoid(6)`，未发现攻击者可控 size |
| Nano ID 3.3.12 | [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) / CVE-2026-67213 | High（数据库评级） | `<3.3.18` → 3.3.18 | 自定义生成器 size=0；当前 PostCSS 路径未发现对应调用。两条 CVSS v3 均为 5.9，与 High 标签不同，保留来源差异 |
| PostCSS 8.5.15 | [GHSA-r28c-9q8g-f849](https://github.com/postcss/postcss/security/advisories/GHSA-r28c-9q8g-f849) / CVE-2026-73646 | High | `<=8.5.17` → 8.5.18 | CSS sourceMappingURL 路径穿越读取 `.map`；项目构建处理仓库 CSS，未发现用户上传 CSS 后在服务器执行 PostCSS 的业务入口 |
| PostCSS 8.5.15 | [GHSA-fxqj-rqcc-2cmp](https://github.com/postcss/postcss/security/advisories/GHSA-fxqj-rqcc-2cmp) / CVE-2026-69153 | Moderate | `<=8.5.22` → 8.5.23 | 缺省 from 时前序修复不完整；不能只升到 8.5.18 |
| source-map-js 1.2.1 | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) / CVE-2026-93749 | High | `>=1.0.0 <1.2.2` → 1.2.2 | 恶意 indexed sourcemap offset 导致事件循环 DoS；来自 PostCSS/Tailwind 构建链，未发现公开业务解析入口 |

## Elysia 暴露面与修复核实

来源：`packages/eisha/package.json`、`packages/housou/package.json` 均为 `elysia: ^1.4.0`，锁定 1.4.28。请求根入口 `packages/housou/src/index.ts:17`，验证错误处理位于 `:42`；注册/登录普通对象 body 位于 `packages/housou/src/routes/seitoshou.ts:34`、`:57`，handler 内才做 Origin/身份处理。

本地已安装 1.4.28 的 `compose.mjs` 会按 Content-Type 选择 multipart 解析；`adapter/web-standard/index.mjs` 在归一化中遍历键并调用 `form.getAll(key)`。不能因源码没有 `t.File` 或 `formData()` 就排除这条路径。

**已执行的小载荷实验**：复用已有开发镜像，仅只读挂载 `node_modules`，无网络、无端口、无 `.env`、无数据库；内存 256 MiB/CPU 1/PID 64。构造一个独立 Elysia 应用，body 仅为 `{name: t.String()}`，发送一个字段的 FormData，经 `app.handle` 返回 `200 {accepted:true,name:"audit-fixture"}`。这验证默认解析可达，不是大载荷 DoS 复现，也不是对线上端点的攻击测试。

验证枚举漏洞：已安装 `error.mjs` 在构造 `ValidationError` 时展开完整错误集合；在非 production 场景下，应用稍后返回固定 422 文本不能避免构造阶段工作。当前预览使用 development；production 默认隐藏详情可能降低这条路径，但未核对线上运行配置。

RCE 公告要求攻击者控制 schema 属性名或默认值。当前 route/schema 定义位于受版本控制的源码，未发现用户自定义 schema/form builder 入口；因此结论是**受影响版本存在，但本项目远程利用前提未建立**。

修复状态存在上游元数据不一致：RCE 公告仍写 Patched=None；[1.4.30 发布说明](https://github.com/elysiajs/elysia/releases/tag/1.4.30) 列出该公告。下载官方 1.4.28/1.4.30 归档并校验完整性后，静态对比确认候选版 headers/params/query 的键和值使用 `JSON.stringify`，multipart 改为 Map 单遍分组，错误枚举通过 `takeErrors` 限制 `MAX_ERRORS=64`。这支持 1.4.30 作为候选，不把公告的空字段静默改写成官方已声明修复。错误枚举公告范围字段 `<1.4.29` 与正文复现 1.4.29 也不一致，所以不建议止于 1.4.29。

## Vite 暴露面

`packages/kyoushitsu-react/vite.config.ts:31` 设置 `host: "0.0.0.0"`；项目开发预览以 Vite 提供站点，反代 `/api` 到内部后端。**devDependency 在此运行方式下仍是直接提供网络服务的依赖**。具体 host publication、外网可达性和线上是否沿用该模式未核对；没有探测或重启原预览。

10-06 公告、10-20/21 数据更新中，8.0.16 命中五条。文件越界读还要求具体导入路径碰撞；源码检查没有建立实用利用链。Windows 两条不适用于当前 Linux Docker 环境。跨源脚本条目需要 custom/middleware transformIndexHtml，当前标准 SPA 不满足已知前提。仍建议集中升级至 8.1.6，避免后续配置改变重新激活风险。

10-21 [GHSA-8g5g-mxqh-grgj](https://github.com/vitejs/vite/security/advisories/GHSA-8g5g-mxqh-grgj) 针对 v6，不因发布时间新就归入 Vite 8；10-06 的 [GHSA-vfpm-58rq-9qcg](https://github.com/vitejs/vite/security/advisories/GHSA-vfpm-58rq-9qcg) 仅影响相应 8.2/8.3 段且 Bun 不满足其运行时条件，当前 8.0.16 不命中。

## 依赖链与兼容性

| 依赖链 / 目标 | 约束与升级判断 | 必查风险 |
| --- | --- | --- |
| eisha、housou → Elysia 1.4.30 | 两处 `^1.4.0` 均允许；cors 1.4.2/openapi 1.4.16 的 Elysia peer 均为 `>=1.4.0`；Elysia 当前/候选 deps 与 peers 一致，TypeBox 0.34.49 满足 `<1` | 验证错误详情、multipart 归一化、安全键过滤、cookie、HTTP/WS 与 OpenAPI 类型/序列化行为 |
| React workspace → Vite 8.1.6 | 清单 `^8.0.0` 允许；plugin-react 6.1.1 peer `^8.0.0`，Tailwind 4.3.3 peer 包含 `^8` | Rolldown 从锁定 1.0.3 迁到 `~1.1.5`，需编译/native binding/HMR/proxy/媒体回归 |
| Vite → PostCSS → Nano ID/source-map-js | 当前范围分别 `^8.5.15` / `^3.3.12` / `^1.2.1` 可容纳修复；候选 Vite 8.1.6 的 PostCSS 下界仅 `^8.5.17`，不自动保证已安全 | 确保最终至少 8.5.23/3.3.18/1.2.2，不能留下旧嵌套副本 |
| Tailwind node → source-map-js | 当前 `^1.2.1` 可升级 1.2.2 | 更新共享解析后复查两条父链，保留样式构建结果 |
| 根 @hey-api/openapi-ts 0.99.0 → parser 1.4.4 → js-yaml 4.2.0 | 上游及当日 latest 均固定旧版本，普通更新无效；建议根 `overrides: {"js-yaml":"4.3.2"}`，不是添加无关直接依赖 | 突破父包 exact pin，需要正常 JSON/YAML 输入及 `contract:drift` 证明兼容；生成物有变化必须逐项解释 |

现有开发镜像 SHA `db4506572339a663b8f735064d5c58f459ee0367825beac03d6479b4ea5630a8`，创建于 2026-10-08，实际 Bun `1.4.2`（无网络容器执行 `bun --version`）。`@types/bun` 是声明包，不等同于运行时。Vite 候选要求 Node `^20.19.0 || >=22.12.0`，Hey API 要求 Node `>=22.18.0`；本项目通过 Bun 执行，仍需用实际 Bun 验证，不能用 Node engines 字段独自证明兼容。

最小候选及可选 latest 共 8 个包版本再查 OSV，查询时均返回空命中；这仅表示数据库当时未报告已知问题。正式实施后必须重扫完整新锁文件，而非只扫这些候选包。

## 热点排除与调查边界

- [React2Shell / CVE-2025-55182 官方公告](https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components)：前端入口 `packages/kyoushitsu-react/src/main.tsx:6` 使用 `react-dom/client` 的 createRoot。清单/锁文件没有 `react-server-dom-webpack/parcel/turbopack`、Next、Waku、`@vitejs/plugin-rsc`、TanStack Start；标准 React 插件不等同于 RSC 插件。本次架构及锁文件未发现该漏洞条件。
- [Axios 投毒事件维护者复盘](https://github.com/axios/axios/issues/10636)：锁文件无 Axios、plain-crypto-js。本次扫描也未返回恶意包公告；这不代表已做安装历史/机器入侵取证，也不是全历史供应链安全认证。
- Seroval 1.6.7、React/DOM 19.3.0、hls.js 1.6.16、dashjs 5.2.0、Artplayer 5.4.0 等已纳入完整版本匹配，查询时未返回公告，不能据此证明没有未知漏洞。
- 未扫描 Debian 系统包/浏览器二进制/宿主机/外部部署；`oven/bun:1` 是可变标签，旧镜像不会因标签更新自行获得补丁。Bun 的实际版本已记录，本轮不宣称对运行时和镜像完成全量安全认证。
- 未运行破坏性利用、压力测试、候选依赖安装或升级后测试；未改业务代码、锁文件、配置、依赖缓存，未启停既有服务。

## 建议顺序与后续门槛

先 Elysia 1.4.30，再 Vite 8.1.6 与 CSS 工具链定向更新，最后单独处理 js-yaml override。两类改动可分批回归；不要 `bun update` 全仓库升级。

实施前读取 [design.md](design.md) 与 [implement.md](implement.md)，落实明确版本、完整新锁文件扫描、lint/types/unit、双次契约漂移、React 构建及 HTTP/WS/媒体和桌面/手机现有回归。本轮完成调查，task 保持 planning；依赖升级与部署尚未执行。
