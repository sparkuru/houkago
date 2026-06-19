# P1 文件弹幕与 kokuban 骨架

## Goal

推进 P1 弹幕基础：新增 `houkago-kokuban` 包作为弹幕文件解析边界，先把“本地弹幕文件 → 统一时间轴 → 播放器按时间渲染”的机制跑通；同时设计后端上传、存储、管理弹幕文件的接口/数据边界，后续可扩展为房间级弹幕源。实时 `DANMAKU` 继续叠加，不被文件弹幕替代。

## What I Already Know

- `design.md` 的推荐下一项是 “P1 文件弹幕与 kokuban 骨架”。
- 当前 `DANMAKU` 协议信封、服务端 echo/gate、前端实时弹幕队列、聊天面板发送弹幕和 `DanmakuOverlay` 已落地。
- `Enmoku` 类型已经预留 `danmaku?: { type: "file" | "fetch"; ref: string }`，但 housou 数据库和 REST 创建接口尚未持久化该字段。
- 当前 `DanmakuOverlay` 是 Vue/CSS 的淡气泡 overlay，不是 `weizhenye/Danmaku` canvas 飞屏引擎。
- `EnmokuPlayer` 已暴露播放器容器 `$player` 给 overlay Teleport，适合作为文件弹幕渲染层挂载点。
- monorepo 使用 Bun workspaces；现有包是 `houkago-kousoku`、`houkago-housou`、`houkago-kyoushitsu`。
- 用户确认：弹幕是一个不小的工程，本任务优先把本地文件机制跑通；meta 自动获取、danmubox 搜索/接入、用户选择其他线上弹幕源都后置。
- 用户确认：长期方向需要后端上传/存储/管理弹幕文件，但前端不应默认打开弹幕；喜欢弹幕的人可以通过开关启用，并在切换不同视频流时自动使用对应弹幕源。

## Assumptions

- `houkago-kokuban` 首版只做纯解析与时间轴数据模型，不绑定 Vue/DOM/DB。
- 本任务优先支持本地选择文件在当前浏览器会话内使用，用它验证弹幕机制。
- 后端上传/存储/管理可以先做最小骨架或接口设计；完整房间级同步、清理策略和权限管理若范围过大可拆后续任务。
- 首版可只完整支持 B 站 XML 常见 `<d p="...">text</d>` 子集；ASS 可作为更小子集或后续任务。
- 文件弹幕开关应是用户偏好，不是房间强制状态；默认关闭，用户开启后不同视频流播放对应弹幕。

## Open Questions

- None.

## Requirements

- 新建 `packages/kokuban` / `houkago-kokuban` 包，导出弹幕时间轴类型与解析 API。
- 支持解析 B 站 XML 的常见子集为统一时间轴 JSON：至少包含时间秒、文本、颜色、模式。
- 前端在部室页允许为当前演目选择本地弹幕文件，用于验证弹幕机制。
- 前端提供文件弹幕开关，默认关闭；用户开启后才显示文件弹幕。
- 前端保留用户的弹幕开关偏好，切换不同视频流时按当前演目使用对应弹幕源。
- 前端根据当前播放时间渲染已解析的文件弹幕。
- 实时 `DANMAKU` 与文件弹幕共存；实时弹幕永远叠加在文件弹幕之外。
- 文件弹幕按演目隔离；切换演目时只显示当前演目对应的本地弹幕源，避免上一演目的弹幕污染当前播放。
- 后端方向要支持弹幕文件上传/存储/管理，但本任务只记录接口/数据边界，不实现上传 API。

## Acceptance Criteria

- [ ] `houkago-kokuban` 有纯函数解析测试，覆盖 B 站 XML 基础字段、HTML entity/text 解码、非法/空输入降级。
- [ ] kyoushitsu 有纯逻辑测试，证明给定播放时间可筛出应该显示的时间轴弹幕。
- [ ] 部室页可以选择一个本地 XML 弹幕文件，并在播放器播放时看到对应时间点弹幕。
- [ ] 文件弹幕默认关闭；用户打开开关后才渲染，关闭后立即隐藏但不影响解析结果。
- [ ] 开关偏好可记忆；切换不同视频流时，若当前演目有已选择/已绑定的弹幕源，则按偏好显示。
- [ ] 切换演目会清空当前显示；若新演目没有对应本地弹幕源，则不显示上一演目的弹幕。
- [ ] 实时聊天弹幕仍可发送和显示，不受文件弹幕开关影响。
- [ ] PRD 或技术实现明确后端上传/存储/管理的下一阶段边界，避免把 meta 获取和 danmubox 搜索混入本任务。
- [ ] 本任务不新增后端上传/list/delete/download API。
- [ ] `bun run typecheck`、`bun run lint` 通过；相关包测试通过。

## Definition of Done

- Tests added/updated where behavior changes.
- Lint / typecheck green.
- Any behavior-affecting design notes are reflected in `design.md` or `.trellis/spec/` if they become durable conventions.
- Rollback path is simple: remove the kokuban package import and hide the local file selector without touching playback sync.

## Technical Approach

Recommended MVP: local mechanism first, backend storage boundary second.

- `houkago-kokuban` owns file-format parsing and exports framework-free utilities.
- kyoushitsu owns file input, browser `File.text()` reading, local parsed timeline state, and overlay rendering.
- kyoushitsu owns a user preference switch for file弹幕 display. The switch defaults off, can be remembered locally, and gates rendering only; parsing/source selection remains available.
- `housou` should grow toward upload/storage/management of弹幕 files, but the first implementation should not block on full room-wide sharing unless explicitly selected.
- Keep parser independent from Vue/DOM and backend DB so it can later be reused by eisha fetchers or server-side upload endpoints.
- Future source priority remains: local/user-selected file first, then online/meta-derived fetch, then danmubox/search provider; realtime弹幕 always overlays independently.

## Decision (ADR-lite)

**Context**: 弹幕来源会逐步扩展为本地文件、自己上传/管理、meta 自动获取、danmubox/search 等多来源体系。一次性做完整来源系统会把解析、渲染、存储、安全、搜索和产品策略耦合在同一个任务里。

**Decision**: 本任务采用 “local mechanism + backend boundary”。实现 `houkago-kokuban` 解析、kyoushitsu 本地文件选择、默认关闭的记忆开关、按播放时间渲染；后端上传/存储/管理只在设计边界中保留，不实现 API。

**Consequences**: 可以快速验证弹幕机制和 UI 行为，避免提前承担文件生命周期和权限安全范围；代价是房间成员暂时不会自动共享同一份上传弹幕文件，后续需要单独任务补齐后端上传/list/delete/download 与演目绑定。

## Implementation Plan

- PR1: 新建 `houkago-kokuban` 包，定义统一弹幕时间轴类型，解析 B 站 XML 子集并补纯函数测试。
- PR2: 在 kyoushitsu 增加本地文件选择、开关偏好、按演目隔离的弹幕状态和按播放时间筛选的纯逻辑。
- PR3: 增加播放器 overlay 渲染文件弹幕，确认实时 `DANMAKU` 仍叠加；更新 roadmap/notes 说明后端上传管理边界。

## Out of Scope

- Automatic meta-derived弹幕 fetch, e.g. Bilibili video stream auto-mapping to official弹幕.
- Danmubox search/provider integration.
- User-selected online alternate弹幕 sources beyond local file unless explicitly scoped later.
- Complete ASS renderer fidelity, fonts, positioning, karaoke/effects.
- `weizhenye/Danmaku` integration unless chosen explicitly for this task.
- Full server-side large-file lifecycle if Option A is chosen: retention cleanup, quota, auth, malware scanning, cross-room library management.
- Database persistence of parsed timeline JSON.

## Technical Notes

- Inspected `design.md` §10.1-10.2 for current roadmap status.
- Inspected `packages/kousoku/src/domain.ts` and `messages.ts`: `Enmoku.danmaku` exists in protocol/domain, `DANMAKU` is realtime chat-style.
- Inspected `packages/housou/src/db/schema.sql`, `db/queries/enmoku.ts`, and `routes/bushitsu.ts`: enmoku persistence currently omits `headers/subtitles/sources/danmaku`.
- Inspected `packages/kyoushitsu/src/components/player/EnmokuPlayer.vue`: overlay target and control visibility are already exposed.
- Inspected `packages/kyoushitsu/src/components/danmaku/DanmakuOverlay.vue`: current realtime overlay is local Vue/CSS view state.
- Inspected `packages/kyoushitsu/src/views/BushitsuView.vue`: current演目, bangumi controls, and player/overlay wiring live here.
