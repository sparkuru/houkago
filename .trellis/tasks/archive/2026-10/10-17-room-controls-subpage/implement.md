# 房间控制子页面执行计划

## Start gate

- [x] 子 task 已创建，并挂在 `10-17-floating-action-button` 之下。
- [x] 已确认范围为当前房间控制子页面；不改变房间运行时、权限或 speed dial 契约。
- [x] 已读取用户提示、父 task、room runtime、frontend、visual、validation 和
      UI/UX 规范，并检查了现有源码、测试和最终 dialog 截图。
- [x] 用户已明确要求开始实现；不再等待额外产品决策。
- [x] 完成计划收敛后运行 `task.py start`，再写产品代码。

## Ordered implementation

1. 完成 PRD convergence，记录当前源码/截图证据、editorial control desk 方向和
   host/guest、mobile、native dialog 的不可变约束。
2. 更新 `RoomControls` dialog shell：增加清晰的上下文 header、房间身份/连接状态、
   可滚动 body 和 responsive information/governance grid，保留原有 aria/id/focus
   语义与 active clock。
3. 更新 `RoomInformation` 的 section markup：摘要块、成员 heading/table wrapper、
   移动端 `data-label` 和权限摘要；只重排现有 `RoomState` 数据。
4. 更新 `GovernancePanel` 的 section/fieldset markup：入室、权限方案、精细权限、
   待审和成员名册分区；保留所有既有 callback、disabled 和 native confirmation。
5. 在 `index.css` 中实现 Warm Club 纸面层叠、状态 pill、editorial spacing、双列/单列
   responsive、mobile sheet、table reflow、focus/pressed/selected、dialog entry 和
   reduced-motion；不使用硬编码新配色或外部资源。
6. 扩展 `room-controls.spec.ts`：验证 host/guest 结构、dialog 语义与焦点、桌面/手机
   几何/溢出、44px 目标、移动表格可读性、现有 governance actions 和最终截图。
7. 用项目预览与 Playwright 容器运行 affected room-controls desktop/phone matrix；
   逐轮查看截图，针对八维自检发现的具体问题继续修正。
8. 运行 contract drift、lint、typecheck、unit、build 和 task validation，更新
   `validation.md`；本 child task 的 commit/archive/push/deploy 另等授权。

## Validation commands

```sh
./dx bun run contract:drift
./dx bun run lint
./dx bun run typecheck
./dx bun test packages/kyoushitsu-react/test
./dx bun run test
./dx bun run --filter houkago-kyoushitsu-react build
python3 ./.trellis/scripts/task.py validate 10-17-room-controls-subpage
```

Browser validation reuses the healthy preview contract and the repository's local
`houkago-dev:playwright` image when host Chromium libraries are unavailable:

```sh
docker run --rm --network host \
  --user "$(id -u):$(id -g)" \
  -e HOME=/app/.devhome \
  -e PLAYWRIGHT_BASE_URL=http://127.0.0.1:9999 \
  -e PLAYWRIGHT_HOUSOU_URL=http://127.0.0.1:9998 \
  -v /home/wkyuu/cargo/repo/07-houkago:/app \
  -w /app houkago-dev:playwright \
  ./node_modules/.bin/playwright test \
  --config packages/kyoushitsu-react/playwright.config.ts \
  --project=room-controls-desktop --project=room-controls-phone
```

Capture normal host/guest dialogs at desktop, 375px, narrow 320px, short height,
reduced-motion and a wide desktop; inspect final screenshots rather than accepting
only DOM/CSS assertions.

## Risk and rollback points

- Native dialog grid/scroll changes can break backdrop geometry or focus restoration;
  retain the existing outside-rectangle handler and run the interior-click regression.
- Table display changes can accidentally hide accessible headers or overflow long text;
  keep table DOM and test bounding boxes/scroll width at 320/375px.
- Reusing `Card` inside a new grid may add unintended padding or selector collisions;
  scope overrides under `.room-controls-dialog` and inspect desktop/mobile screenshots.
- Markup-only changes must not move state ownership; compare governance callback test
  behavior before/after the visual pass.

## Final review checklist

- [x] Typography: sequential headings, readable body/label scale, no clipped localized copy.
- [x] Whitespace: section rhythm separates overview from controls without dead gaps.
- [x] Hierarchy: room status and primary governance intent are visible in one glance.
- [x] Color: semantic tokens and text/status contrast remain readable.
- [x] Motion: entry/pressed/selected feedback is purposeful and reduced-motion safe.
- [x] Micro-interaction: focus, close, pending/disabled and selected states are explicit.
- [x] Responsive: desktop, tablet, phone, short viewport and safe areas are usable.
- [x] Originality: Warm Club editorial control desk; no generic UUPM template leakage.
