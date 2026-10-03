# M6 pre-removal owner review

Status: accepted on 2026-10-04 (`视校通过；可以提交/继续；包括所有脏文件`). Implementation was authorized by `开始` on 2026-10-04.
Deletion and post-removal checks have now passed;
the owner has accepted the separate speed-dial criteria and all listed residuals.

## Tested result

The neutral core and 46-operation browser SDK are extracted. Active permission
presets and online/departed-member information are retained in the React control
dialog. Queue management is host-only; permitted guests can still select media.
Populated rooms dynamically move the launcher clear of player, queue actions
and composer, while retaining its saved preferred coordinates. Clicking dialog
interior padding keeps it open; actual backdrop clicks close and return focus.

Final automation: root 496 tests, React browser 60 cases, Vue comparison 40 cases
and installed adapter 1 case passed. Lint, all workspace types, deterministic
contract generation, React/Vue builds, boundary graph and independent code review
passed. Relevant project-selection skips and fixture limits are recorded in
[validation.md](../validation.md). The pre-removal Git restoration rehearsal
passed. No known executable parity failure remains.

## Owner decisions

| Difference | Already verified | Remaining judgment |
| --- | --- | --- |
| Launcher temporarily moves to nearest clear position | Five viewport layouts with populated content, cinema/fullscreen, unit collision cases; saved preference remains | Accept temporary position changes (phone cinema can put it above the composer) |
| Information and host presets are in the existing control dialog | All admitted viewers get duration/history; host preset/custom commands echo through server; phone tables fit and dialog scrolls | Accept the information presentation through `+` rather than repeating legacy placement |
| React uses browser-native confirmation for removal/revoke | Cancel, failure, retry and successful revocation pass; permissions unchanged | Accept native confirmation appearance in place of legacy custom confirmation |

The flowing mobile dock and overall Warm Club room layout were accepted on
2026-10-03. They are reused as the baseline and need no repeat approval merely
because old Vue used a mobile chat modal.

## Screenshots

- [Desktop populated room](screenshots/desktop-room-normal.png)
- [Phone cinema and clear launcher](screenshots/phone-room-cinema.png)
- [Phone member information](screenshots/phone-member-information.png)
- [Desktop member information](screenshots/desktop-member-information.png)

The main agent inspected corresponding final-state screenshots (and the
identical focused-run states). No visual clipping or obstructed control was
found. Diagnostic screenshots are not an approved pixel baseline. Media is a
local color-bar fixture; these images do not show private upstream accounts.

## Approved continuation — completed

Owner acceptance was recorded in the parent and child. The old Vue workspace,
configs/tests and obsolete dependencies were removed, active references updated,
and post-removal static, contract, browser and restoration gates passed.
Acceptance permits that local cutover work. The same owner reply authorizes all dirty-file commits and normal task closure.
Production deployment remains outside scope.

The required gate comes from [project validation policy](../../../../../spec/trellis-plus/validation.md):
“Complete runnable automation first and ask only about the remaining concern.”
It classifies migration/deletion and subjective visual/product acceptance as
human-required. The approved implementation plan additionally requires the
user-facing parity summary to be accepted before deleting Vue.
