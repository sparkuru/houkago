# 放課後 / Houkago — 在线一起看平台 设计文档

## 第一部分 · 架构设计

### 1. 设计目标（源自需求）

1. 多人同步播放（play/pause/seek/rate，迟到者自动追平）
2. 边看边聊的聊天室（B 站直播风：侧栏 + 弹幕叠加）
3. 弹幕三源：聊天弹幕 / 装载弹幕文件 / 第三方·平台抓取，优先级 本地文件 > 在线抓取 > 弹幕盒子
4. 强播放器：字幕切换、音轨切换
5. 多平台来源解析：可插拔解析器，一平台一解析器
6. 全开源、自有 license

### 2. 总体架构：5 个模块，控制面 / 媒体面分离

```
┌─────────────────────────────────────────────────────────────┐
│                  houkago-kyoushitsu (教室 · 前端)              │
│  ArtPlayer + 弹幕 + 字幕/音轨切换 │ 聊天室 UI │ 部室/浏览 UI    │
└───┬─────────────────────────────┬──────────────────┬─────────┘
    │ WS(控制面)+REST              │ 媒体直连(媒体面)   │ REST
    ▼                              ▼                  ▼
┌──────────────┐         ┌──────────────────┐  ┌──────────────┐
│houkago-housou│         │  houkago-eisha    │  │houkago-kokuban│
│ 放送室        │         │  映写室            │  │ 黒板          │
│房间/同步/聊天 │         │ 解析器 + 流代理    │  │ 弹幕聚合       │
│ 元数据/鉴权   │         │(过期URL/m3u8重写)  │  │(抓取/解析/匹配)│
└──────┬───────┘         └────────┬─────────┘  └──────┬───────┘
       │ SQLite                   │ 拉上游             │ 拉上游
       ▼                          ▼                   ▼
    持久化                    各视频平台             各弹幕源

           共享契约：houkago-kousoku (校則 · WS协议+类型)
```

**核心原则：控制面与媒体面彻底分离。**
- `houkago-housou`（放送室）只跑控制面：WebSocket 同步 + 聊天 + 房间/元数据 REST，**不碰任何媒体字节** → 极轻，永不是带宽瓶颈。
- 媒体字节只走 `浏览器 ↔ houkago-eisha 代理 ↔ 上游`。
- 最难的代理/m3u8 重写隔离在 `houkago-eisha`（映写室），与同步核心解耦。

### 3. 模块职责

**houkago-housou（放送室 / 控制面核心）**
- 部室生命周期、部员、角色（部長 host / 部員 member / 見学 guest）
- 控制权裁决（v1 房主权威模型）
- WebSocket 同步 hub：状态广播、迟到追平、漂移校正
- 聊天 + 弹幕消息中继（与同步共用一条 WS）
- 番組表（当前演目 + 队列）
- 演目元数据存储（url/headers/subtitles/sources/danmaku 引用）
- 鉴权（v1：生徒証 JWT/token；OAuth2 后置）
- **不做视频代理**（推给 eisha）

**houkago-eisha（映写室 / 解析 + 流代理）**
- 可插拔解析器接口：一平台一实现（bilibili / 通用 m3u8 / …）
- 解析：平台链接 → `{ url, headers, subtitles[], sources[], danmakuRef, live }`
- **稳定流代理端点**：处理过期/签名 URL、注入 header、m3u8 manifest 重写、range/seek。
  浏览器永远拿 `https://eisha/stream/<token>` 稳定地址，过期由 eisha 内部重解析。
- 平台 浏览/搜索 API（喂前端浏览 UI）

**houkago-kokuban（黒板 / 弹幕聚合，v1 可与 eisha 同进程部署）**
- 抓取：按标题匹配从 B 站/第三方 API 取弹幕
- 解析：弹幕文件 xml/ass/B站xml → 统一 JSON 时间轴
- 标题识别 → 源匹配；按优先级链返回
- CORS 全在服务端解决，浏览器从不直连源站

**houkago-kyoushitsu（教室 / 前端）**
- 播放器：ArtPlayer + hls.js/dash.js（字幕轨、HLS 多音轨切换）
- 弹幕：P1 local-first 用 Vue/CSS overlay 验证本地文件机制；密集飞屏/正式统一引擎目标仍是 `weizhenye/Danmaku`（MIT, canvas）。
- 聊天室 UI（B 站直播风：右侧栏 + 视频上弹幕叠加）
- 部室 UI：建/进房、部员列表、番組表、房主控制条
- 浏览/搜索 UI：调 eisha
- WS 客户端：讲 houkago-kousoku 协议

**houkago-kousoku（校則 / 共享契约）**
- WS 协议消息类型、Enmoku 模型等 TS 类型；web 与 server 共享，一词一义。

### 4. WebSocket 同步协议（自定义，裁剪自 synctv）

信封：`{ type, ts, senderId, payload }`，v1 用 JSON（后续可换 protobuf）。

| type | 汉字 | 方向 | payload | 对应 synctv | 说明 |
|------|------|------|---------|-------------|------|
| `NYUUBU` | 入部 | C→S | `{}` | JOIN | 进房 |
| `TAIBU` | 退部 | C→S | `{}` | LEAVE | 退房 |
| `OSHABERI` | お喋り | C↔S | `{content}` | CHAT | 聊天，广播 |
| `DANMAKU` | 弾幕 | C↔S | `{content,color,mode}` | — | 弹幕 |
| `SHINKOU` | 進行 | C↔S | `{isPlaying,currentTime,playbackRate}` | STATUS | 同步原语，房主操作→广播 |
| `OIKAKE` | 追いかけ | C→S | `{}` | SYNC | 迟到者请求权威状态 |
| `GENJOU` | 現状 | S→C | `{enmokuId,shinkou,serverTime}` | CURRENT+STATUS | 权威状态下发 |
| `TENKO` | 点呼 | C↔S | `{currentTime}` | CHECK_STATUS | 周期心跳，驱动漂移校正 |
| `JOUEI` | 上映中 | S→C | `{enmokuId}` | CURRENT | 当前演目切换 |
| `BANGUMI` | 番組表 | S→C | `{enmoku[]}` | MOVIES | 队列更新 |
| `SHUSSEKI` | 出席数 | S→C | `{n}` | VIEWER_COUNT | 在线人数 |
| `KEIHOU` | 警報 | S→C | `{message}` | ERROR | 错误 |

v1 不含 WebRTC 语音（synctv 的 WEBRTC_* 一组后置到 P4）。

### 5. 同步状态机（全系统唯一硬骨头，显式设计）

**控制权模型：房主权威（v1）**
- 只有 部長(host) 的播放器事件（play/pause/seek/ratechange）触发 `SHINKOU` 广播。
- 部員 收到 SHINKOU → 应用 → **回声抑制**：置 `tsuijuuChuu=true`（追従中），忽略由此触发的本地事件 ~200ms。
- 部員 自己的播放操作不广播（或被服务端拒绝），只能被动跟随。
- 自由控制（人人可控、时间戳 last-writer-wins）后置到 P4。

**迟到追平**
- 部員 NYUUBU → 发 `OIKAKE` → server 回 `GENJOU`。
- server 保存最近一次 `SHINKOU` 及其接收时的服务端墙钟 `shinkouServerTime`。
- 投影进度：`projected = shinkou.currentTime + (isPlaying ? (now - shinkouServerTime) * rate : 0)`。
- 新部員 seek 到 `projected` 并按 isPlaying 播/停。

**漂移校正（延迟补偿）**
周期 3–5s，host（或权威钟）发 `SHINKOU`/`TENKO`，每个部員算
`zure = |localCurrentTime - projectedRemoteTime|`：
- `zure > 1.5s` → 硬 seek
- `0.3s < zure ≤ 1.5s` → 软校正：临时 playbackRate ±5% 拉回，无跳变
- `zure ≤ 0.3s` → 忽略

> **v1 实现（P0 纵切2）**：漂移校正落地为「服务端权威钟周期 GENJOU 心跳（~4s）+ 客户端 `zureHosei` 三档」。心跳与 OIKAKE 追平复用同一条 `GENJOU` 权威下发路径（迟到追平即 zure 极大→seek 档，与漂移统一）。`TENKO`（C→S 成员上报心跳）在服务端权威钟模型下 v1 未用。

**时钟对齐**
- 消息带服务端 `ts`，client 用一次轻量 ping/pong 估 `clockOffset`（NTP-lite）。
- v1 简化：信任 host.currentTime + 单程延迟（RTT/2）补偿。

> **参考实现**：
> - 服务端消息流：`archive/refer/synctv/server/handlers/websocket.go`（AGPL）
> - 客户端同步逻辑（最值得读）：`archive/refer/synctv-web/src/plugins/sync.ts`（Apache）——回声抑制、seek 追平的实际写法在此
>
> **读设计可以，禁止拷 AGPL 代码**（synctv-web 是 Apache，可借鉴但需保留署名）。本协议表已是裁剪后的自有设计。

### 6. 演目 / 来源模型（houkago-kousoku 内定义）

```ts
// 演目：一个待放映项
interface Enmoku {
  id: string
  bushitsuId: string                                    // 所属部室
  title: string
  type: 'direct' | 'hls' | 'dash' | 'live'
  url: string                                           // 指向 eisha 稳定代理地址
  headers?: Record<string, string>                      // 代理拉上游用
  subtitles?: Record<string, { url: string; type: string }>  // 多字幕轨 → 需求4
  sources?: { name: string; url: string }[]             // 多清晰度/音轨
  danmaku?: { type: 'file' | 'fetch'; ref: string }     // 弹幕引用
  live?: boolean
  addedBy: string                                       // 投稿者 buinId
}
```
eisha 产出此结构 → housou 存 → kyoushitsu 消费。

### 7. 弹幕管线（需求 3，三源优先级合流）

前端弹幕轨道合并三条流：
1. **实时聊天弹幕**：WS `OSHABERI`/`DANMAKU` → 前端 overlay；后续密集飞屏再统一 push 进 `weizhenye/Danmaku` 引擎
2. **装载文件弹幕**：用户上传 xml/ass → kokuban 解析 → 时间轴 JSON → 前端预载、按 currentTime 渲染
3. **抓取弹幕**：kokuban 按标题匹配 → 从 B 站/第三方取 → 时间轴 JSON

优先级链 本地文件 > 在线抓取 > 弹幕盒子，前端按配置选当前源；实时聊天弹幕永远叠加。

> P0/P1 local-first 偏离回填：实时聊天弹幕与本地文件弹幕先实现为自有 Vue/CSS overlay（`components/danmaku/DanmakuOverlay.vue`、`FileDanmakuOverlay.vue`），用于验证开关、来源隔离和按时间渲染。canvas 飞屏弹幕引擎 `weizhenye/Danmaku` 推迟到样式化/密集弹幕切片（密集弹幕才需 canvas 性能）。

### 8. 技术选型

| 层 | 选型 | 理由 |
|----|------|------|
| 前端 | **Vue 3 + Vite** | 与 ArtPlayer 集成示例多；synctv-web 也 Vue，便于参照 |
| 播放器 | **ArtPlayer + hls.js/dash.js** | HLS 多音轨/字幕切换齐备 |
| 弹幕引擎 | **P1 Vue/CSS overlay → 后续 `weizhenye/Danmaku`（MIT, canvas）** | local-first 先验证机制；密集飞屏/正式统一引擎不自研 |
| housou | **Bun + Elysia.js**（TypeBox + Eden Treaty） | spike 实测：Bun 原生 WS pub/sub topic 天然适配房间广播；#781 非 WS 全局 publish 已验证可干净实现（详见 `.trellis/tasks/06-13-elysia-js-spike-bun/research/elysia-spike-results.md`）。备选 Fastify-on-Bun 未触发。|
| eisha | **Go**（或 Node 起步） | 代理/manifest 重写/并发拉流 Go 更稳；独立进程可后换 |
| 传输 | WebSocket，JSON（v1）→ protobuf（后期） | |
| 存储 | SQLite（v1, `bun:sqlite`）→ Postgres | 单文件零运维起步；Bun 内置 SQLite 驱动 |
| 工程 | Bun workspaces monorepo | 同仓共享类型 |

> polyglot 取舍：eisha 用 Go 还是 Node/Bun。v1 建议先 Bun 同栈跑通，代理性能不足再单独换 Go——独立进程，替换不影响其他模块。
>
> **后端框架落定（spike 结论）**：housou 用 **Elysia.js on Bun**。6/6 能力探针全过，硬指标 #781（HTTP handler / `setInterval` 等非 WS 上下文全局 `publish` 到房间 topic）实测 PASS——工作模式为 handler 内 `server.publish(topic,msg)`、非请求上下文 `app.server?.publish(topic,msg)`。WS 信封用 TypeBox 校验，契约共享走 Eden Treaty（编译期）。完整实测见 `.trellis/tasks/06-13-elysia-js-spike-bun/research/elysia-spike-results.md`。

### 9. 仓库结构

```
houkago/
├── packages/
│   ├── kousoku/      # 校則 · 共享 TS 类型（WS 协议、Enmoku 模型）
│   ├── housou/       # 放送室 · server：Bun + Elysia.js（WS pub/sub）+ bun:sqlite
│   ├── kyoushitsu/   # 教室 · web：Vue3 + ArtPlayer
│   ├── eisha/        # 映写室 · 解析器 + 流代理（含 parsers/ 插件目录）
│   └── kokuban/      # 黒板 · 弹幕聚合（v1 可并入 eisha 部署）
├── archive/refer/    # synctv & synctv-web 源码，仅本地参考；.gitignore 已排除（勿提交：AGPL）
│   ├── synctv/       # core 后端（AGPL）— 协议/同步/弹幕 参照
│   └── synctv-web/   # 官方前端（Apache）— 播放器/弹幕/同步客户端 参照
├── design.md         # 本文件
├── license           # Je-Suis-Le-Deluge
└── readme.md
```

### 10. 分期路线

- **P0 — MVP（证明同步）**：housou(部室+WS 房主权威同步+聊天) + kyoushitsu(ArtPlayer+进房+手填直链 m3u8/mp4+聊天侧栏+聊天弹幕)。跑通一条直链多人同步。
- **P1 — 弹幕基础**：文件弹幕加载渲染；kokuban 骨架。
- **P2 — 解析+代理**：第一个解析器（B站 或 通用）+ 过期 URL 流代理 + manifest 重写；浏览/搜索 UI。
- **P3 — 扩展**：更多解析器；按标题抓取弹幕；番組表队列；部员角色。
- **P4 — 打磨**：漂移校正调参、断线重连、鉴权/OAuth、字幕/音轨 UI、自由控制权、WebRTC 语音（可选）。

> **规划记录约定**：`design.md` 是项目主干 PRD / 产品蓝图，记录长期路线、
> 当前实现状态和跨模块待办；Trellis task 的 `prd.md` 只承载一次具体执行项，
> 完成后会归档。后续从本节挑选一个待办进入实现时，再创建对应 Trellis task。

#### 10.1 当前实现状态（2026-06-18）

| 阶段 | 状态 | 已落地 | 主要缺口 |
|------|------|--------|----------|
| P0 MVP 同步 | 基本完成 | `kousoku`/`housou`/`kyoushitsu` 三包；部室创建/进入；ArtPlayer 直链播放；WS 聊天；`SHINKOU`/`OIKAKE`/`GENJOU`/`JOUEI` 同步；迟到追平；服务端权威心跳；客户端漂移三档校正；番組表基础队列 | 缺少完整浏览器 smoke/e2e；断线重连与重启恢复仍弱 |
| P1 弹幕基础 | 部分完成 | `DANMAKU` 协议信封与服务端 echo/gate；前端独立实时弹幕队列；聊天面板可发送弹幕；`DanmakuOverlay` 渲染实时 `DANMAKU`；`houkago-kokuban` 本地 B 站 XML 子集解析；前端本地文件弹幕选择、默认关闭开关、按演目隔离和按播放时间 overlay 渲染 | 未接 `weizhenye/Danmaku`；无 ASS 完整支持；无后端弹幕上传/存储/管理 API；无 meta 自动获取；无 danmubox/search |
| P2 解析+代理 | 部分完成 | `Enmoku` 类型预留 `headers`/`subtitles`/`sources`/`danmaku`；`houkago-eisha` 包已建立；通用直链/HLS/DASH resolver；base64url 稳定代理 token；housou 挂载 `/eisha/proxy/:token`；基础 Range/seek 代理测试 | 无平台解析器；无过期 URL 续期；无 m3u8 manifest 重写；无浏览/搜索 UI；前端 dev 表单尚未接 resolver |
| P3 扩展 | 部分提前 | 番組表队列；来宾权限开关；入室开放/审核/关闭；角色显示基础 | 无更多解析器；无按标题抓取弹幕；无独立部员列表/管理面板；`Enmoku` 扩展字段未持久化 |
| P4 打磨 | 部分提前 | 漂移校正已可用；授权来宾播放控制已落地 | 无断线重连策略；无鉴权/生徒証/OAuth；无字幕/音轨 UI；无自由控制权策略文档化；无 WebRTC 语音 |

#### 10.2 下一批可执行 backlog

**推荐下一项：P1 文件弹幕与 kokuban 骨架**

- 新建 `houkago-kokuban` 包，先提供本地文件解析 API 的最小骨架。
- Local-first：前端先支持为当前演目选择本地 B 站 XML 子集，转换为统一时间轴 JSON，并按播放时间渲染。
- 文件弹幕前端默认关闭；用户开启后记忆偏好，切换不同视频流时只播放对应演目的本地弹幕源。
- 后端上传/存储/管理弹幕文件是后续独立切片；本地机制验证阶段不实现 upload/list/delete/download API。
- 明确长期优先级链：本地/用户选择文件 > meta 自动获取 > danmubox/搜索；实时弹幕永远叠加。

**P2：eisha 解析与代理骨架**

- 已完成：新建 `houkago-eisha` 包；通用直链 / m3u8 / mpd resolver；稳定代理 token；housou co-deploy 挂载 `/eisha/proxy/:token`；range/seek 基础行为测试。
- 下一刀：将前端 dev 直链表单接入 resolver/create 流程，或先做 m3u8 manifest segment 重写。
- 后续再加入 m3u8 manifest 重写、过期 URL 自动重解析、平台浏览/搜索 API。

**P3：房间与内容管理扩展**

- 为部室页增加独立部员列表/角色面板。
- 将 `Enmoku.headers/subtitles/sources/danmaku/live` 持久化到 SQLite。
- 支持更多解析器和按标题抓取弹幕。
- 为番組表增加更完整的队列管理（重排、清空、当前项保护、远端同步）。

**P4：稳定性与权限体系**

- 实现 WS 断线重连、重连后恢复 room/admission/authority state。
- 引入 `生徒証` token/JWT 鉴权；OAuth 后置。
- 补字幕/音轨/多清晰度 UI。
- 明确“自由控制权”策略：人人可控、授权可控、last-writer-wins 的边界与冲突处理。
- 评估 WebRTC 语音是否仍符合产品方向。

### 11. 风险与对策

| 风险 | 对策 |
|------|------|
| 同步正确性（P0 核心难点） | 房主权威模型 + 第 5 节漂移算法，先把模型做简单做对 |
| 过期/签名 URL、m3u8 重写（P2） | 全隔离在 eisha 稳定代理端点，内部按需重解析 |
| CORS（媒体/弹幕跨域） | 一律服务端拉取（eisha/kokuban），浏览器不直连源站 |
| B 站反爬（cookie、wbi 签名） | 解析器内处理，可能需登录态 cookie，做成解析器私有逻辑 |
| License | 不 fork/不链接 synctv，仅参照协议；全栈 Je-Suis-Le-Deluge |

---

## 第二部分 · 编码 / 命名规范（放課後主题）

### 12. 核心原则

1. **代码标识符用 romaji（ASCII）**，汉字只进注释与文档。JS/TS 标识符不用中日文。
   例：`class Bushitsu` + 注释 `// 部室`。
2. **主题化范围**：组件、协议消息、领域实体、生命周期动词——全套放課後换皮，赋予项目性格。
3. **保持英文**：纯基建/工具代码（循环、HTTP 管线、通用 helper、第三方适配）用标准英文。
   判据：**业务概念 → 放課後词典；通用机械代码 → 英文**。
4. **一词一义**：词典是唯一来源。`Buin` 永远是成员，不再另起 `Member/User`。

### 13. 命名词典

**组件（学校设施）**

| 组件 | romaji 包名 | 汉字 | 隐喻 |
|------|------------|------|------|
| server | `houkago-housou` | 放送室 | 向各教室广播=WS 中继 hub |
| resolver+代理 | `houkago-eisha` | 映写室 | 装片放映管胶卷=解析+代理 |
| danmaku | `houkago-kokuban` | 黒板 | 涂写浮现=弹幕 |
| web | `houkago-kyoushitsu` | 教室 | 坐着看屏幕的地方 |
| shared | `houkago-kousoku` | 校則 | 共同遵守的契约=协议 |

**领域实体**

| 概念 | romaji | 汉字 |
|------|--------|------|
| 房间 | `Bushitsu` | 部室 |
| 成员 | `Buin` | 部員 |
| 房主 | `Buchou` | 部長 |
| 游客/旁观 | `Kengaku` | 見学 |
| 连接/会话 | `Shusseki` | 出席 |
| 播放列表 | `Bangumi` | 番組表 |
| 影片/可播项 | `Enmoku` | 演目 |
| 当前在播 | `Jouei` | 上映中 |
| 播放状态 | `Shinkou` | 進行 |
| 同步对齐 | `Ashinami` | 足並み |
| 迟到追平 | `Oikake` | 追いかけ |
| 漂移量 | `zure` | ずれ |
| 弹幕 | `Danmaku` | 弾幕 |
| 鉴权令牌 | `Seitoshou` | 生徒証 |

**生命周期动词**

| 动作 | romaji | 汉字 |
|------|--------|------|
| 登录 / 登出 | `toukou` / `gekou` | 登校 / 下校 |
| 进房 / 退房 | `nyuubu` / `taibu` | 入部 / 退部 |
| 心跳 | `tenko` | 点呼 |
| 广播 | `housou` | 放送 |
| 早退/异常断开 | `soutai` | 早退 |

### 14. 代码风格示例

```ts
// houkago-housou：部室管理 RoomManager
class BushitsuKanri {
  nyuubu(buin: Buin) {}              // 入部：成员进房
  taibu(buinId: string) {}           // 退部
  housou(msg: KousokuMessage) {}     // 放送：向全员广播
}

// 進行制御 playback sync controller
class ShinkouSeigyo {
  private tsuijuuChuu = false        // 追従中：回声抑制（正在应用远端状态）
  private buchouKengen: boolean      // 部長権限：房主权威

  oikake(genjou: Shinkou) {}         // 追いかけ：迟到追平
  tenko() {}                         // 点呼：心跳 tick，驱动漂移校正
  zureHosei(zure: number) {}         // ずれ補正：漂移分级处理
}
```

### 15. 命名速查（技术 ↔ 主题）

```
RoomManager        → BushitsuKanri      部室管理
MemberService      → BuinService        部員
PlaybackController → ShinkouSeigyo      進行制御
BroadcastHub       → HousouHub          放送
Playlist           → Bangumi            番組表
Movie / MediaItem  → Enmoku             演目
JoinRoom           → nyuubu             入部
LeaveRoom          → taibu              退部
Heartbeat          → tenko              点呼
AuthToken          → Seitoshou          生徒証
DriftCorrection    → zureHosei          ずれ補正
EchoSuppressing    → tsuijuuChuu        追従中
```

---

## 第三部分 · 参考实现索引（archive/refer，仅本地，不进版本库）

> `synctv`=AGPL（**只读设计，禁止拷代码**）；`synctv-web`=Apache（**可借鉴，保留署名**）。
> 选型部分已被 synctv-web 印证：`artplayer@5 + hls.js + dashjs`。弹幕本项目改用 MIT 的 `weizhenye/Danmaku`（不沿用 synctv-web 的 artplayer-plugin-danmuku）。

| 本文设计节 | 参考文件（archive/refer/…） | 看什么 |
|-----------|----------------------------|--------|
| §3 housou 房间/成员 | `synctv/server/handlers/room.go`、`member.go` | 部室/部员 REST 与生命周期 |
| §3 housou 鉴权 | `synctv/server/handlers/user.go`、`synctv/internal/op/` | 会话/权限模型 |
| §4 WS 协议 | `synctv/proto/message/message.proto`、`synctv-web/src/proto/message.ts` | 消息类型枚举（服务端/客户端两侧） |
| §5 同步状态机（服务端） | `synctv/server/handlers/websocket.go` | hub、广播、status 维护 |
| §5 同步状态机（客户端·重点） | `synctv-web/src/plugins/sync.ts` | 回声抑制、seek 追平、漂移处理的真实写法 |
| §5 播放控制 | `synctv-web/src/plugins/control.ts` | 播放器事件 ↔ 同步消息接线 |
| §6 Enmoku 模型 | `synctv/internal/model/movie.go`、`synctv-web/src/types/Movie.ts` | url/headers/subtitles/sources 字段设计 |
| §6 加片/演目接口 | `synctv/server/handlers/movie.go` | 直链影片创建、headers/subtitles 提交 |
| §7 弹幕（客户端） | `synctv-web/src/plugins/danmu.ts` | 弹幕插件接线、实时 push |
| §7 弹幕（服务端） | `synctv/server/handlers/danmu.go` | 弹幕消息流 |
| §8 播放器/字幕/音轨 | `synctv-web/src/components/Player.vue`、`src/plugins/{subtitle,source}.ts`、`src/plugins/artplayer-plugin-ass/` | ArtPlayer 集成、字幕(含 ASS)/多源切换 |
| §8 选型佐证 | `synctv-web/package.json` | 播放器/弹幕/HLS·DASH 依赖版本 |
| 房间状态管理（前端整体） | `synctv-web/src/stores/room.ts`、`src/hooks/useRoom.ts`、`useMovie.ts` | 前端房间/影片状态组织方式 |
| 影院 UI（B站直播风参照） | `synctv-web/src/components/cinema/` | 播放器+聊天+弹幕的布局 |

---

## 第四部分 · 开发与协作约束（硬约束）

> 本部分对人与 AI 同等生效。违反即返工。操作细节落在 `.trellis/spec/{backend,frontend}/quality-guidelines.md`（Build & Run 节），本部分给原则。

### 16. Docker 优先：开发与验证一律在容器内

**宿主机不安装语言运行时/工具链（含 bun）。** 所有 build / install / typecheck / lint / test / 启动服务，统一在 `oven/bun:1` 容器内通过仓库根 `./dx` 包裹器执行：

```
./dx bun install
./dx bun run typecheck      # 全 workspace
./dx bun run lint           # biome
./dx sh -c 'cd packages/housou && bun test'
```

- **目的**：环境可复现、隔离、零宿主机污染；最大限度**减少向宿主机请求执行命令**——能在容器内自证的（装/编/测/跑），不要回到宿主机问。
- `./dx` 已做 uid 映射（产物归当前用户）、端口发布（3000 housou / 5173 kyoushitsu）、容器内 HOME=`/app/.devhome`（gitignore）。
- **两个 `./dx` 不可并发**（重复绑定端口）；「起服务 + 连客户端」放进同一个 `./dx sh -c`：后台起服务→跑驱动断言→kill。
- 容器内服务监听 `0.0.0.0` 才能从宿主访问（`app.listen({ hostname:'0.0.0.0' })` / vite `server.host:'0.0.0.0'`）。
- **验证以容器内实跑为准**：验收靠 `./dx` 跑出的实际命令与结果证据，不靠口头断言。
- 例外（必须经宿主机的极少数操作，如 `git`、`docker` 本身、改宿主机 dotfiles）才在宿主机执行，且应事先说明。

### 17. 编码遵守优秀工程规范

代码质量是硬指标，不是事后润色。**操作层规则以 `.trellis/spec/` 为准（trellis 子代理逐任务注入）**；本节给不可让渡的总原则：

1. **契约单一源 / 一词一义**：跨端共享的类型、协议、领域模型只在 `kousoku` 定义一处，他处 import 不重定义；命名严格遵 §13 词典，禁同义词漂移（成员永远 `Buin`，影片永远 `Enmoku`）。
2. **类型优先、禁逃逸**：TypeScript strict；禁 `any`、禁用 `as`/`@ts-ignore` 绕过契约——类型不符就改契约而非强转。运行时边界（WS 信封 / REST body）用 TypeBox 校验，TS 类型 `Static<>` 同源。
3. **薄传输厚 domain、单一职责**：路由/WS handler 只解析+委派；业务逻辑进 `domain/`，I/O 进 `db/`。函数小而专注，一个函数一件事。
4. **DRY 但不过度抽象**：改任何常量/配置前先全局搜索引用（防「忘了同步另一处」）；重复出现 3 次以上才抽象，避免过早抽象。
5. **错误不吞**：禁空 `catch {}`；错误带类型/`code`，集中映射（REST→状态码，WS→`KEIHOU`，非断连）；绝不半应用状态后假装成功。
6. **注释克制**：解释「为什么」与非显然的领域意图；禁复述代码、禁装饰性 banner、禁留注释掉的死代码。
7. **测试覆盖核心逻辑**：纯逻辑（尤其同步状态机 §5：projected 投影、漂移分级、房主权威）必须可脱离 socket/DOM 单测；提交前 typecheck / lint / test 全绿（容器内实跑）。
8. **安全与边界**：不记录密钥/令牌/用户消息内容；服务端权威，不信任客户端自律（房主权威在服务端强制）；媒体/弹幕跨域一律服务端拉取。
9. **小步提交**：按功能切分提交，提交信息说清「做了什么 + 为什么」；提交前工作树自检。
10. **不引入实验性/不稳定依赖作地基**：选稳定主线版本（前车之鉴：vue-router 用稳定 4.x，禁实验性 5.x）；引入新依赖说明理由与许可。
