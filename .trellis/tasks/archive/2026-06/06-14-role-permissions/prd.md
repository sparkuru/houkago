# 角色模型(两层) + 房主权限开关(控播放/发言/选源) + UI gating

## Goal

synctv 式 guest 权限的 epic 阶段1：把"角色"显式化（两层：部長/ゲスト），并让房主用房间级开关控制 guest 能否 控制播放 / 发言聊天 / 选源(播放列表)。无权限时对应控件对该用户**隐藏或用遮罩替换**（UI gating），同时服务端强制（双保险）。**入房控制（开放/审批/关闭）为本 epic 阶段2，单列后续任务**，本任务不做。

## Background（现状）

- `YakuwariSchema`(buchou/buin/kengaku) 已定义但**全代码未用**；运行时只有 `senderId===buchouId` 单一房主判定。
- SHINKOU/JOUEI 现为硬性 host-only(NotBuchou→KEIHOU)。OSHABERI/DANMAKU 任何人可发。manual 源输入框现仅部長可见(早前 #1)。
- roster(senderId→nickname) 经 SHUSSEKI 广播。无 per-room 权限状态。

## Decision (ADR-lite)

**角色**：两层——部長(host, senderId===buchouId)、ゲスト(其余, yakuwari=kengaku)。不引入个体提升的"部員"(三层留更后续)。服务端在 roster/SHUSSEKI members 标注每人 yakuwari，客户端据此显示角色 + 分支 gating。
**权限**：房间级开关(对所有 guest 生效)，三项 `guestCan: { playback, chat, playlist }`。默认 playback:false、chat:true、playlist:false（房主默认掌控放映与源、guest 默认可聊天）。
**变更与下发**：房主经新消息 `SETTEI`(C→S, host-only) 改权限；服务端存 per-room(内存,如 roster)、强制、并以 `KENGEN`(S→C) 广播当前权限(新进者进房即收、变更广播全房)。
**双保险**：服务端强制(拒绝越权 SHINKOU/JOUEI/OSHABERI→KEIHOU) + 客户端 UI gating(无权限控件隐藏/遮罩)。

## Requirements

1. 协议(kousoku)：`YakuwariSchema` 已有；SHUSSEKI members 每项加 `yakuwari`。新增 `KENGEN`(S→C, 权限快照 `{playback,chat,playlist}`) 与 `SETTEI`(C→S, host 设权限)。
2. housou：per-room 权限状态(内存,默认如上)+ roster member 标注 yakuwari(host vs kengaku)；handler 加 `SETTEI`(host-only→设权限+广播 KENGEN)；open 时向新进者发 KENGEN(+广播已含 yakuwari 的 SHUSSEKI)；enforcement——SHINKOU/JOUEI 改为 `host || guestCan.playback/playlist`，OSHABERI/DANMAKU 改为 `host || guestCan.chat`，越权→KEIHOU 不广播。
3. kyoushitsu store：存 roster 含 yakuwari、当前 `kengen` 权限、派生 `canControl/canChat/canPlaylist`(host 恒 true)。
4. kyoushitsu UI：
   - 房主设置入口：一个权限开关面板(三개 toggle)，发 SETTEI。
   - UI gating(无权限→隐藏或遮罩)：guest 无 playback 权 → 播放器控制遮罩/禁用(至少不让其操作，越权也被服务端挡)；guest 无 chat 权 → 聊天输入隐藏/禁用显"閲覧のみ"；guest 无 playlist 权 → 源输入入口隐藏(现已 host-only,改为按 canPlaylist)。
   - 角色显示：roster/聊天昵称旁可标注部長/ゲスト(轻量)。
5. 不破坏：房主权威/JOUEI/同步/NTP-lite/昵称/autoplay join-gate/nameGate/全屏布局。

## Acceptance Criteria

- [ ] 房主可开关 guest 的 控播放/发言/选源 三项；变更实时广播，guest 端 UI 立即随权限隐藏/遮罩或恢复。
- [ ] guest 无某权限时：客户端控件隐藏/遮罩，且即便绕过前端、服务端也拒绝(KEIHOU)。
- [ ] 默认：guest 可聊天、不可控播放、不可选源；房主全可。
- [ ] 角色(部長/ゲスト)在成员/聊天处可见。
- [ ] 容器内(./dx) typecheck/lint/build 全绿；housou+kyoushitsu test 不回归并补关键用例(权限判定纯函数、SETTEI 鉴权、enforcement)。

## Out of Scope（本任务）

- **入房控制(开放/审批/关闭 + join 门控 + 审批流 + 等待 UI)——epic 阶段2,紧随单列**。
- 三层角色/个体提升部員、账号/鉴权、权限持久化 DB(内存即可)、踢人。

## Technical Notes

- 权限判定抽纯函数(如 `lib/kengen.ts` 客户端 + housou 侧 `canDo(role, kengen, action)`)便于测。
- SHUSSEKI members 加 yakuwari 需同步 store apply 与既有昵称 roster(上轮)逻辑。
- 服务端 enforcement 复用 NotBuchou→KEIHOU 路径(可加更通用的 Forbidden/権限なし error code,或复用)。
- UI gating:播放器控制遮罩可复用/类似既有 join-gate overlay 思路;聊天只读隐藏 input。
- 验证用 ./dx(强约束,禁裸 docker)。双端实跑由用户确认。
