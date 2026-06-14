# 昵称持久化 + 进房昵称兜底（直接进房/刷新也有名）

## Goal

昵称机制(roster)已实现，但实跑仍显 uuid：因 `store.nickname` 不持久、只在首页输入时设；用户直接打开/刷新房间 URL（或隐私窗口）时 nickname 为空 → connect 传空 → housou 回退 senderId → 显 uuid。目标：直接进房/刷新/分享链接进房都能带上昵称并显示。

## Root Cause（已勘定）

- `stores/bushitsu.ts` `nickname = ref("")` 非持久；仅 HomeView.enter() 设值。buinId 已 localStorage 持久，nickname 没有。
- 直接导航到 `/bushitsu/:id` 或刷新 → 跳过首页 → nickname 空。隐私窗口连 buinId 都是新的，更无昵称。
- 次要：房间 id 误填整段路径(`bushitsu/<uuid>`)致 housou 路由/查找 500（BUSHITSU_NOT_FOUND 本已映射 404，是带斜杠的脏 id 撞坏路由）。

## Requirements

1. 昵称持久化：nickname 写入 localStorage，store 初始化时读回（与 buinId 同 lib 风格）。刷新/直接进房沿用上次昵称。
2. 进房昵称兜底：BushitsuView 挂载时若 `store.nickname` 为空，先要昵称再 connect（见 Open Question 选法）；提交后持久化并连接。
3. HomeView：设置/进房时也把昵称持久化（与 store 同步）。
4. roomId 净化：HomeView join 把粘入的 URL/路径剥成纯房间 id（取末段 uuid），避免 `bushitsu/<uuid>` 这类脏 id 进房。
5. 不破坏 roster/nicknameOf 显示链路、房主权威、JOUEI/同步。

## Acceptance Criteria

- [ ] 设过昵称后刷新房间页，聊天/弹幕仍显该昵称（非 uuid）。
- [ ] 直接打开房间 URL（含隐私窗口）昵称为空时，按选定方式取得昵称后进房，显示正确。
- [ ] 误填整段路径作房间号时被净化为 uuid，正常进房（不再 500）。
- [ ] A、B 双端互显对方昵称。
- [ ] 容器内(./dx) typecheck/lint/build 全绿；test 不回归并补关键用例。

## Out of Scope

- 改名 UI、重名消歧、头像。
- 昵称服务端 DB 持久化（roster 仍内存态）。
- housou 针对带斜杠脏 id 的 500→404 深究（净化后不触发；如顺手可加但非目标）。

## Decision (ADR-lite)

**Context**: 用户最终愿景是 synctv 式 guest 身份 + 房主权限矩阵（房主控制 guest 看视频/聊天/播放列表/进房）。该 epic 较大，拆片推进；本任务=**片1**，只解眼前"显 uuid/无名"，且与 guest 模型前向兼容。权限矩阵(角色模型+权限开关+服务端强制)为独立后续 epic。
**Decision**: 无昵称访客视作 **guest**——BushitsuView 进房前若 `store.nickname` 空，叠一个内联「输入昵称加入」表单（输入框默认占位/默认值「ゲスト」，可编辑），提交后 `saveNickname`+set+connect。昵称持久化到 localStorage，刷新/直接进房沿用。HomeView 设名时同样持久化。roomId 进房前净化为纯 uuid。
**Consequences**: demo 立即显真名；分享链接访客被引导取名再进，符合 guest 方向。本片不引入角色枚举/权限开关（留 epic 片2/3）。guest 与正式成员此片不作权限区分，仅身份显示。

## Notes for follow-up epic（不在本任务做）

- 角色模型：部長/部員/guest 显式 role（`BuinSchema.yakuwari` 已有字段）落 domain/store/协议。
- 房主权限矩阵：guest 能力开关（聊天/播放控制/播放列表/进房），服务端强制。

## Technical Notes

- 持久化助手放 `lib/identity.ts`（已管 buinId）或新 `lib/nickname.ts`：`loadNickname()/saveNickname()`。store init `nickname = ref(loadNickname())`。
- 兜底若选内联提示：BushitsuView 在 connect 前 gate 一个昵称输入（小遮罩/表单），提交→saveNickname+set+connect。
- roomId 净化纯函数（取 `/` 后末段、去空白），可单测。
- 验证用 ./dx（强约束，禁裸 docker）。双端实跑由用户确认。
