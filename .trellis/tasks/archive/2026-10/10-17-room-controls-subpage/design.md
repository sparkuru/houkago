# 房间控制子页面技术设计

## Boundary and ownership

这是一个 presentation-only redesign。`RoomControls` 继续拥有 dialog 打开/关闭、
launcher focus restore、RoomRuntime 回调和 host/guest 分支；`RoomInformation` 只
投影 `RoomState`；`GovernancePanel` 只调用已有治理命令。CSS 负责层级、布局、状态
和动效，不把视觉状态写回房间运行时。

变更范围：

- `packages/kyoushitsu-react/src/features/room/room-controls.tsx`
  - 将 dialog 拆成 header / scroll body / information workspace 的语义 section；
  - 增加状态 pill、摘要块、成员表的 responsive hooks（`data-label`）；
  - 保留原有 id、role、aria-labelledby、active clock 和 speed-dial 行为。
- `packages/kyoushitsu-react/src/features/room/governance-panel.tsx`
  - 用明确的 host-only section、fieldset、preset grid、pending/member rows 替代
    重复 Card 标题；不改变任何 callback 或权限判断。
- `packages/kyoushitsu-react/src/styles/index.css`
  - 只增加 `.room-controls-*` 作用域规则和 dialog 的 responsive/motion 规则；
  - 复用 Warm Club semantic/component tokens，不新增 raw palette。
- `packages/kyoushitsu-react/e2e/room-controls.spec.ts`
  - 增加可见结构、宽度/溢出、control target、host/guest 语义和截图断言；不镜像
    CSS 常数。

## Information architecture

```text
native dialog
├─ header: context title + room identity + connection status + close
└─ scroll body
   ├─ error feedback (when present)
   └─ responsive grid
      ├─ room information
      │  ├─ room/admission summary
      │  ├─ online members table
      │  ├─ history members table
      │  └─ read-only permission summary
      └─ host governance (host only)
         ├─ admission fieldset + save
         ├─ permission presets + fine controls
         ├─ pending requests
         └─ durable member roster
```

Desktop uses a 42/58 split with the governance column slightly wider, matching the
control-first workflow; tablet and phone collapse to one column. The dialog remains the single scroll container so
focus order and native Escape behavior stay predictable. On phone it is a safe-area
aware near-bottom sheet, while desktop stays centered.

## Visual language

- The dialog is a paper sheet above the existing room canvas; its canvas/surfaces use
  the existing `--color-canvas`/`--color-surface`/`--color-surface-raised` Warm Club
  layers, wood semantic borders and primary actions use `--color-border*`/`--color-accent*`,
  while teal `--color-focus-ring` is reserved for status, focus, selected and allowed states.
  No dialog-local raw palette is introduced.
- One accent rail/status treatment establishes orientation; status text and labels
  remain visible so color is never the sole meaning. The host's left column keeps only
  the compact read-only permission summary; the right column owns the editable permission
  scheme and details. A guest dialog uses the same information section but a narrower
  single-column width instead of reserving the host's control-desk width.
- Summary fields use a quiet two-column rule grid rather than four boxed cards. Member
  tables use quiet row rules, not heavy boxed grids. Governance controls use one raised
  admission group plus separators and a selected preset state so the host can distinguish
  overview from edit without repeating the detailed permission matrix.
- Motion is limited to dialog entry and state feedback: transform/opacity/color in the
  160–240ms range, with no looping animation and global reduced-motion override.

## Contracts to preserve

- `RoomControls` keeps the native dialog and its current `onCancel`, `onClose` and
  true-outside-rectangle click behavior. Interior clicks must not dismiss it.
- `RoomInformation` continues to start its one-second clock only while `active` and
  to clear it on close/fullscreen/unmount.
- Existing selectors and semantics remain available: `.room-controls-info-list`,
  `.room-controls-dialog-header button`, `#admission-mode`, `#admission-password`,
  `.room-form`, `getByRole("dialog", { name })`, labels and headings.
- Host-only rendering remains `room.isHost`; command disabled state remains based on
  `state.command`; all mutation callbacks stay `setAdmission`, `setPermissions`,
  `decide` and `removeMember`.
- No room state, local storage, network client, new package dependency, or i18n key is
  introduced. Existing localized strings are reused for all visible product copy.

## Responsive and accessibility strategy

- Dialog width uses a bounded `min()` on desktop and `calc(100vw - gutter)` on narrow
  viewports. Its body has `min-height: 0` and owns scrolling; header/close remain visible.
- Member table headers remain in the DOM. Below the phone breakpoint, each cell exposes
  its existing localized column name through `data-label` and reflows to a two-line row,
  eliminating horizontal overflow without dropping table semantics.
- Buttons, select, checkbox, and close controls preserve 44px minimums. Focus styles use
  the shared focus token. Selected permission presets expose `aria-pressed` plus visible
  surface/border changes.
- Long room IDs, nicknames, error copy and translated labels use `overflow-wrap:anywhere`;
  no meaningful control text is ellipsized.

## Rollback

If a visual change regresses room control behavior, revert only the child task's room
controls JSX/CSS/e2e files. Do not revert the already submitted speed-dial commit or
touch RoomRuntime/player/danmaku code.
