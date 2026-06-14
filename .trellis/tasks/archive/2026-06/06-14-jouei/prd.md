# 源同步：房主放映源经 JOUEI 下发，部員自动跟随播放

## Goal

当前两端各自填 m3u8 才有内容，transport(SHINKOU 播放/暂停/seek)已同步但"源"本身没下发。目标：房主(部長)选定/填入一个源后，房间内所有部員**自动加载并播放该源**，无需各自手填；迟到者进房也自动对上当前源。这是 P0「一起看」的核心闭环。

## What I already know（现场已勘）

- 协议已备料：`JOUEI`(上映, `{enmokuId}`)、`GENJOU`(带 `enmokuId`)、`BANGUMI`、REST `POST /:id/enmoku`(注册源入番组表) + `GET /:id/bangumi` 都在。
- **缺口**：
  - housou `ws/handler.ts` 的 message switch **无 JOUEI 分支**；enmokuId 权威态从未被真正 set——`shinkouSeigyo.shinkou()` 虽有 enmokuId 参数，handler 调用时传 `null`。
  - 前端 `BushitsuView.playManual()` 只设本地 `current.value`，**不 POST enmoku、不广播 JOUEI**；也没监听 `store.enmokuId` 变化去切 `current`。
  - 隐患：`shinkouSeigyo.shinkou()` 每次 SHINKOU 都覆写 `enmokuId`(当前传 null)。做本任务必须让 SHINKOU **不清空** enmokuId。
- store 已 apply JOUEI/GENJOU → `enmokuId`；OIKAKE→GENJOU 已带 enmokuId，迟到追平的源信息通道已通，只差前端解析+播放。
- `api/index.ts` 的 treaty client 已可达 housou REST（含 enmoku/bangumi 端点）。

## Requirements

1. 房主填源(开发期 manual 直链；后续解析器)→ 注册为房间 enmoku → 经 JOUEI 下发 enmokuId → 房间所有客户端(含房主自己)据此加载并播放该源。
2. housou `ws/handler.ts` 新增 JOUEI 分支：校验仅部長可下发(非部長→KEIHOU)，set 权威 enmokuId，广播 JOUEI 给全房。
3. `shinkouSeigyo`：提供设置当前 enmokuId 的路径(jouei setter)；并修正 SHINKOU 路径不清空已有 enmokuId。
4. 前端：部員监听 `store.enmokuId` 变化 → 从番组表解析对应 Enmoku 的 url/type → 设 `current` 播放；本地番组表缺该 enmoku 时重新 `GET /:id/bangumi` 再解析。
5. 迟到者(OIKAKE→GENJOU 带 enmokuId)走同一解析路径自动对上当前源。
6. (#5 顺带)开发期 manual 输入框默认值填 `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8`，标注后续清除。

## Acceptance Criteria

- [ ] A(房主)填源并放映后，B(部員)**无需手填**自动加载并播放同一源。
- [ ] A 之后切到新源，B 自动跟随切换。
- [ ] B 在 A 已放映后才进房(迟到)，自动对上当前源并追平进度。
- [ ] 非部長发 JOUEI 被拒(KEIHOU)，不影响他人。
- [ ] SHINKOU(播放/暂停/seek)不会清空当前 enmokuId。
- [ ] 容器内 typecheck/lint/build 全绿；housou + kyoushitsu test 不回归并补关键用例。

## Out of Scope（单列后续）

- **房间控制/权限**：房主限制 B 能否输入链接、房主强制控当前内容、踢人等——独立任务。
- 解析器(B站/通用)、流代理、manifest 重写(P2)。
- 番组表队列管理(增删排序/下一首自动播)——本任务只做"当前上映源"单点同步。
- 昵称显示、全屏弹幕/聊天 UI 调优（各自独立任务）。

## Decision (ADR-lite)

**Context**: 源需从房主到达所有部員(含迟到者)，需选下发机制。
**Decision**: 采「注册番组表 + JOUEI(enmokuId)」。房主 `POST /:id/enmoku` 注册源得真 enmokuId → 广播 `JOUEI(enmokuId)`；客户端从番组表解析 url(本地缺则重拉 `GET /:id/bangumi` 再解析)。迟到者 OIKAKE→GENJOU(enmokuId) 走同一解析路径。
**Consequences**: 协议不改(JOUEI 仍 `{enmokuId}`)；与 design §6 演目模型、GENJOU/追平一致；源有持久记录便于后续番组表队列。代价是房主每次新源多一次 POST 往返、客户端命中缺失时多一次 GET——可接受。JOUEI 直携 url 方案因迟到 GENJOU 仅带 enmokuId 会导致两条解析路径不一致，舍弃。

## Technical Notes

- 验证：容器内 `./dx`（注意端口被运行中 dev-server 占用时改用等价无端口 `docker run oven/bun:1`）；LAN 实跑由用户最终确认。
- 部長判定已有 `store.isBuchou` / housou `fetchBushitsu().buchouId`；JOUEI 鉴权复用 SHINKOU 同款 NotBuchou→KEIHOU 路径。
