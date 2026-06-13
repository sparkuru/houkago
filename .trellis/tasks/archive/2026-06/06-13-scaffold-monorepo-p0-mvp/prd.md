# Scaffold monorepo（scaffold-only，为 P0 铺路）

## Goal

搭起 Bun workspaces monorepo 可 install / 可启动的骨架：root 工程配置 + `kousoku` 完整
共享契约 + `housou`（Elysia app + WS 接入 + bun:sqlite 初始化 + 最小部室 REST）+
`kyoushitsu`（Vue3+Vite app + Eden/WS 客户端接线 + ArtPlayer 挂载 + 进房 UI 占位）。
**本任务不做 P0 同步正确性逻辑**（房主权威 hub / 回声抑制 / 追平 / 漂移分级）——那是
紧随其后的独立 P0 任务。本任务确保：装得上、跑得起、类型端到端流通、WS 连得上并能回声、
DB 能初始化，给 P0 一个干净的地基。

## Requirements

### Root（monorepo）
- `package.json` 配 Bun workspaces（`packages/*`）。
- base `tsconfig.json`（strict）+ 各 package extends。
- Biome 配置（lint + format，单一工具）；root 脚本：`bun run typecheck` / `lint` / `dev`。
- `.gitignore` 已含 archive/refer；补 `node_modules`、`*.db`、`dist`。

### kousoku（校則 · 共享契约，scaffold 阶段就定全）
- WS 信封 `{type,ts,senderId,payload}`（design §4）。
- 消息类型判别联合：NYUUBU/TAIBU/OSHABERI/DANMAKU/SHINKOU/OIKAKE/GENJOU/TENKO/
  JOUEI/BANGUMI/SHUSSEKI/KEIHOU（design §4 全表）。
- 域类型：Bushitsu / Buin / Buchou 角色 / Enmoku（design §6）/ Shinkou。
- 进房模型：NYUUBU payload 带 nickname；Bushitsu 有 buchouId；首个进房/建房者为 部長。
- 每个信封配 TypeBox schema（housou 校验用），TS 类型由 `Static<>` 导出，一处定义。

### housou（放送室 · 控制面，scaffold 阶段）
- Elysia app（`src/index.ts`），导出 `export type App = typeof app`（Eden 用）。
- WS `/ws`：TypeBox 校验信封；畸形 → KEIHOU（error 事件，非断连）；合法 OSHABERI/DANMAKU
  在 `room:<bushitsuId>` topic 回声广播（证明 pub/sub 通路，非完整同步）。
- bun:sqlite：`src/db/client.ts` 单实例 + `schema.sql`（bushitsu / buin / enmoku 最小表，
  string id、snake_case 列）+ 启动时幂等建表。
- REST：建部室 / 取部室 / 加演目（手填直链）最小集，走 domain → db 分层。
- 进房昵称模型，无 token（生徒証 后置）。

### kyoushitsu（教室 · 前端，scaffold 阶段）
- Vue3 + Vite app；Pinia 装好；router 装好。
- Eden Treaty 客户端（`src/api/`）against housou `App` 类型——编译期端到端类型流通可证。
- WS 客户端骨架（`src/ws/`）：连 `/ws`、收发 kousoku 信封、解码进 store（不含同步算法）。
- ArtPlayer 装好并能挂载一个手填直链 m3u8/mp4 播放（hls.js）。
- 进房 UI 占位：填昵称 + 房间 id → 建/进房 → 进入放映页（播放器 + 聊天侧栏空壳）。

## Acceptance Criteria

- [ ] root `bun install` 成功，workspaces 互相解析 `houkago-kousoku`。
- [ ] `bun run typecheck` 全绿；改 housou 契约导致 kyoushitsu 的 Eden 调用编译报错（端到端类型流通可证）。
- [ ] `bun run lint`（Biome）全绿。
- [ ] housou 启动；WS 可连；发畸形信封收到 KEIHOU（非断连）；两个客户端进同一 room 互收 OSHABERI 回声。
- [ ] housou 启动时自动建表；建部室 REST 写入、取部室读回。
- [ ] kyoushitsu `bun run dev` 起得来；进房 UI 可填昵称+房间id 进入；ArtPlayer 能播一条手填直链。

## Definition of Done

- typecheck / lint 通过。
- 遵循 .trellis/spec/{backend,frontend}（romaji 标识符、一词一义 §13、薄传输厚 domain、
  契约单一源、Eden 编译期类型、room pub/sub publish 路径）。
- 同步算法虽未实现，但 kousoku 契约 + housou/kyoushitsu 接线已为 P0 留好挂点（ShinkouSeigyo
  占位、GENJOU/SHINKOU 通道已通）。

## Decision (ADR-lite)

**Context**: design.md 已锁定全部架构/选型/协议；起步要在「一把梭 P0」与「先稳地基」间取舍。
**Decision**: 先 scaffold-only；P0 同步正确性另起任务。只建 kousoku/housou/kyoushitsu 三 package
（eisha/kokuban 不建）；持久化直接 bun:sqlite 最小表；进房昵称+房间id 无 token；lint/format 用 Biome。
**Consequences**: 地基可独立验收（install/typecheck/lint/run/WS echo/DB），P0 任务专注同步状态机
这一硬骨头不被脚手架噪声干扰；代价是多一次任务切分。

## Out of Scope

- P0 同步正确性逻辑（房主权威 hub、回声抑制 tsuijuuChuu、OIKAKE→GENJOU 追平、漂移分级）——下一个任务。
- eisha 解析+流代理（P2）、kokuban 弹幕文件/抓取（P1）。
- 番組表队列、部员角色细化（P3）；漂移调参、断线重连、OAuth、字幕/音轨 UI、自由控制权、WebRTC、protobuf（P4+）。
- 生徒証 JWT 鉴权。

## Technical Notes

- 参考实现（仅本地，禁拷 AGPL）：`archive/refer/synctv-web/src/plugins/{sync,control}.ts`（P0 任务再细读）、
  `archive/refer/synctv/server/handlers/websocket.go`。
- Elysia #781 工作模式：WS 内 `ws.publish(topic,msg)`；HTTP handler `server.publish`；
  非请求上下文 `app.server?.publish`（归档 spike 结论）。
- spec 依据：.trellis/spec/backend/*、.trellis/spec/frontend/*。
- 选型版本参考归档 spike：elysia 1.4.x、@elysiajs/openapi、@elysiajs/eden、@types/bun。
