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
- 弹幕：artplayer-plugin-danmuku（实时聊天弹幕 + 预载文件弹幕）
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
1. **实时聊天弹幕**：WS `OSHABERI`/`DANMAKU` → 实时 push 进 ArtPlayer danmuku 插件
2. **装载文件弹幕**：用户上传 xml/ass → kokuban 解析 → 时间轴 JSON → 前端预载、按 currentTime 渲染
3. **抓取弹幕**：kokuban 按标题匹配 → 从 B 站/第三方取 → 时间轴 JSON

优先级链 本地文件 > 在线抓取 > 弹幕盒子，前端按配置选当前源；实时聊天弹幕永远叠加。

### 8. 技术选型

| 层 | 选型 | 理由 |
|----|------|------|
| 前端 | **Vue 3 + Vite** | 与 ArtPlayer 集成示例多；synctv-web 也 Vue，便于参照 |
| 播放器 | **ArtPlayer + artplayer-plugin-danmuku + hls.js/dash.js** | 弹幕生态最契合；HLS 多音轨/字幕切换齐备 |
| housou | **Node/TS（Fastify + ws）** | 与前端共享 TS 类型；迭代快 |
| eisha | **Go**（或 Node 起步） | 代理/manifest 重写/并发拉流 Go 更稳；独立进程可后换 |
| 传输 | WebSocket，JSON（v1）→ protobuf（后期） | |
| 存储 | SQLite（v1）→ Postgres | 单文件零运维起步 |
| 工程 | pnpm monorepo | 同仓共享类型 |

> polyglot 取舍：eisha 用 Go 还是 Node。v1 建议先 Node 同栈跑通，代理性能不足再单独换 Go——独立进程，替换不影响其他模块。

### 9. 仓库结构

```
houkago/
├── packages/
│   ├── kousoku/      # 校則 · 共享 TS 类型（WS 协议、Enmoku 模型）
│   ├── housou/       # 放送室 · server：Fastify + ws + sqlite
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
> 选型已被 synctv-web 印证：`artplayer@5 + artplayer-plugin-danmuku@5 + hls.js + dashjs`。

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