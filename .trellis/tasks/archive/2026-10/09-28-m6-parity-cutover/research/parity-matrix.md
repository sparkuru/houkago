# M6 behavior and layout parity matrix

Snapshot: 2026-10-04. Legacy source files below are under
`packages/kyoushitsu/e2e/`; React counterparts are under
`packages/kyoushitsu-react/e2e/`. These are behavior mappings, not equal-pixel
claims. The owner-accepted 2026-10-03 room layout supersedes old room placement.
Each legacy test is represented below, including the separate installed adapter
runner. The default legacy baseline passed 40 cases with 8 project-selection
skips; the adapter is not part of that default run.

`baseline` means an existing React case ran before extraction; it must run again
after extraction. `gap` means required evidence is incomplete. `review` denotes
a user-visible difference needing disposition; a test count cannot accept it.

## Legacy cases

| ID | Legacy file and case | React counterpart / observable requirement | State before extraction | Final pre-removal evidence |
| --- | --- | --- | --- | --- |
| E1 | entry-home: session restoration settles signed-out | entry: delayed restore, non-auth restoration failure/recovery; no protected room reads | baseline | PASS: entry desktop/phone full suite |
| E2 | entry-home: auth labels, keyboard, pending/recovery | entry: authentication duplicate locks, typed failure/recovery; registration mode retained | baseline | PASS: entry desktop/phone full suite |
| E3 | entry-home: known classroom and new-classroom hierarchy | entry: create/join deep-link behavior; real-cookie refresh/current identity | baseline; room-layout visual review | PASS: entry desktop/phone full suite |
| E4 | entry-home: create pending/recovery | entry: create locks and explicit retry | baseline | PASS: entry desktop/phone full suite |
| E5 | entry-home: public config identity, title, empty room name | entry: configured name/title/create body; invalid config blocks bootstrap | baseline | PASS: entry desktop/phone full suite |
| E6 | entry-home: reduced-motion stable surfaces | entry: delayed restore/keyboard/reduced motion | baseline | PASS: entry desktop/phone full suite |
| D1 | desktop-room: short stage scrolls to composer | room-controls: bounded playlist and reachable controls; add explicit short viewport | gap | PASS: room-controls + responsive five viewports; accepted 10-03 flow baseline |
| D2 | desktop-room: tall content-sized workbench | room-controls: accepted full-height chat and bounded main/queue; tall viewport assertions | baseline; updated-layout review | PASS: room-controls + responsive five viewports; accepted 10-03 flow baseline |
| D3 | desktop-room: current/pending queue action hierarchy | real-cookie plus new governance coverage: move/delete/clear pending and current-item preservation | gap; guest deletion defect found | PASS: real-cookie owner queue/presets case, desktop/phone; guest host-action denial |
| D4 | desktop-room: primary player and bounded room surfaces | room-controls geometry plus media readiness; desktop, dock breakpoints, empty/active player | baseline | PASS: room-controls + responsive five viewports; accepted 10-03 flow baseline |
| D5 | desktop-room: cinema player/chat visibility | room-controls and media cinema/fullscreen; launcher hidden only for actual fullscreen | baseline | PASS: room-controls + responsive five viewports; accepted 10-03 flow baseline |
| D6 | desktop-room: keyboard retention step unselected | baidu-room: desktop pairing/retention/OAuth; no implicit retention choice | baseline | PASS: Baidu desktop/phone applicable cases; native confirmation review remains |
| D7 | desktop-room: read-only Baidu file states/selection | baidu-room: file permit/revoke states; permissions and failure feedback | baseline | PASS: Baidu desktop/phone applicable cases; native confirmation review remains |
| D8 | desktop-room: revoke cancel/failure/success/re-pair | baidu-room: desktop connection revoke state and retry | baseline; confirmation presentation review | PASS: Baidu desktop/phone applicable cases; native confirmation review remains |
| P1 | mobile-room: player first, shell within viewport | room-controls phone: main/dock/queue order and overflow; add iPad comparison | baseline phone; gap tablet | PASS: room-controls + responsive five viewports; accepted 10-03 flow baseline |
| P2 | mobile-room: modal chat sheet opens/expands/closes | accepted React inline dock/composer with shared draft; keyboard focus and reachable chat | review: modal replaced by accepted flowing dock | PASS: room-controls + responsive five viewports; accepted 10-03 flow baseline |
| P3 | mobile-room: dense queue touch actions/wrap/bounds | room-controls phone plus new governance queue tests; real interactive targets >=44px | baseline layout; gap queue command outcomes | PASS: room-controls + responsive five viewports; accepted 10-03 flow baseline |
| P4 | mobile-room: URL composer retains/reset drafts | real-cookie preview failure/add; add retained drafts and reset assertions | gap | PASS: real-cookie preview failure retains drafts; successful add resets |
| P5 | mobile-room: ordinary sources with desktop-only Baidu explanation | baidu-room phone explanation and ordinary controls | baseline; mobile provider intentionally unavailable | PASS: Baidu desktop/phone applicable cases; native confirmation review remains |
| G1 | room-governance: member-removal cancel/failure/retry/revocation | new React governance case: native confirmation, retry feedback, real server removal and no revoked reconnection | gap; dialog presentation review | PASS: real-cookie cancel/failure/retry/revocation, desktop/phone; native confirmation review |
| G2 | room-governance: owner reorder/clear, guest lacks management | new React governance case: guest with playlist still cannot move/delete/clear; host preserves current item | gap; source permission fix required | PASS: real-cookie owner queue/presets case, desktop/phone; guest host-action denial |
| G3 | room-governance: policy presets converge and management stays owner-only | Restore preset shortcuts beside React custom checkboxes; verify echoed combinations and guest exclusion | implementation required; equivalent raw combinations already passed | PASS: real-cookie owner queue/presets case, desktop/phone; guest host-action denial |
| S1 | subtitle-desktop: keyboard/local selection, source preserves, off/reselect/reset | media-room: native selector keyboard and source/subtitle controls; extend locality/reset/off/reselect | baseline media; gap additional contract assertions | PASS: media subtitle keyboard/locality/off/reselect/source/reload |
| S2 | subtitle-phone: visible selector/no overflow | media-room phone + subtitle final-state assertions | baseline | PASS: media phone subtitle states/overflow |
| K1 | danmaku-source: provenance/fallback/manual selection | danmaku-room: precedence/local XML/proposal/manual correction and stale candidate response | baseline | PASS: danmaku desktop/phone full suite |
| A1 | chromium-adapter-installed: real content-script/worker/DNR boundary | relocate unchanged behavioral smoke to houkago-adapter/e2e, build extension and execute its separate runner | gap execution/relocation | PASS: adapter-owned installed Chromium runner, 1 case |

## M4/M5 and child cross-checks

| Contract | Required evidence | Initial disposition |
| --- | --- | --- |
| Identity/admission | Real cookies, refresh/direct URL, approval/rejection, closed/password settings, revoked notice; no protected read before admission | Baseline approval test navigation needs fix; extend gate coverage |
| HTTP/realtime authority | Generated resource paths/cookies/AbortSignal and stale HTTP-versus-WS; one socket, server queue/playback authority | Root/runtime unit baseline passed; rerun after extraction |
| Media/sync | MP4/HLS/DASH fixtures, two clients, current guest permissions, explicit manual gesture, source/subtitle, cinema/fullscreen | Media desktop/phone baseline passed; extend subtitle assertions |
| Provider | Adapter handshake/preparation, pairing/retention/OAuth, read-only file selection, revoke/failure/recovery, owner wait, mobile explanation | Fixture browser baseline passed; installed runner still required; live upstream outside fixture evidence |
| Danmaku | Personal/file > room/fallback, proposal/manual correction, stale scope cancellation, echoed chat/live-danmaku and fullscreen subtree | Danmaku/media desktop/phone baseline passed; rerun |
| Speed-dial A1–A6 | All controls/info, focus/Escape/outside/inertness, drag/persist/clamp, layout/queue/dock order, dual shared composer, safe areas/motion | Six room-control desktop/phone baseline cases passed; independent child acceptance remains open |
| Core/contract isolation | No React/Vue/Pinia/Eden/server dependency in core or React graph; deterministic 46-operation browser subset and relocated helper tests | Planned extraction plus independent code/graph review |
| Rollback/removal | Record base + dirty diff, preserve pre-existing work, reviewable extraction/removal groups, verify restoration without resetting live checkout | Not yet verified; removal blocked until acceptance |

## Legacy unit/source surfaces outside E2E

The complete source classification is in [migration-inventory.json](migration-inventory.json).
The original workspace contains 141 tracked files. Initial extraction relocates
82 source/OpenAPI/test files, plus the typed-contract config and installed
adapter smoke. Four further preset/presence helper/test files bring the final
classification to 88 migrated and 53 retained until acceptance.

| Surface | Active behavior / disposition |
| --- | --- |
| `kengen-policy` helper/tests | Active preset controls in legacy KengenPanel; restore shortcuts and retain helper/tests in core rather than accepting their absence |
| `member-presence` helper/tests and store projection | Active online-duration and departed-member last-seen information in chat/settings; preserve via core helpers and React room information, with WS-derived state |
| `bushitsu-store` tests | Vue-binding implementation can be removed only after equivalent React admission, authority, presence/names, queue, permissions, chat/danmaku and room reset evidence |
| `use-shinkou` / `join-gate` tests | Vue lifecycle wrapper superseded by core controller/runtime unit tests and two-client media browser cases; keep audible join and permission/follow behavior |
| `room-motion` tests | Vue animation wrapper superseded by existing React reduced-motion/stable-layout browser evidence; no new animation system |
| `nickname` helper/tests | Retained legacy store field, but room name gate is initialized false and never enabled; actual Housou WS uses authenticated account ID/username and ignores custom display nickname. Preserve server identity, do not invent new nickname behavior |
| `chat-theme` helper/tests | No runtime consumer in legacy source; dormant helper can be removed after inventory/acceptance. Shared active theme/token preference stays in core |

## Design research decision

Project-local UI/UX Pro Max was run on the approved Warm Club shared-video
context using `--design-system --stack react`, with temporary output at
`/tmp/houkago-m6-ui-research.txt`. Its generic landing-page/alternate-palette
suggestions are not applicable to this migration. Keep the approved theme,
room layout, semantic names, focus restoration, >=44px interaction targets,
safe-area constraints and reduced-motion behavior. This original decision
summary retains no copied tool source or unverified engagement claims.

## Removal gate

Do not delete the legacy workspace while any required row is unmapped,
unverified, blocked or has an undisposed product/visual difference. Post-core
browser/static evidence, adapter execution, independent review and residual
owner acceptance must be recorded before removal. Native confirmation presentation
needs explicit disposition. Permission presets and active presence/history
information have been restored and verified rather than classified as unsupported.

## Final checkpoint — 2026-10-04

React: 60 passed, 3 explicit Baidu project-selection skips, no failures.
Vue comparison: 40 passed, 8 short/tall project-selection skips, no failures.
Installed Chromium adapter: 1 passed. Full commands and artifacts are in
[validation.md](../validation.md). All executable rows above passed; owner review
is still pending for the migration/deletion and identified presentation differences.

| Additional contract | Final evidence / disposition |
| --- | --- |
| M4/M5 admission, HTTP/WS authority, media, provider, danmaku | Full React suite plus 496 root unit tests and deterministic 46-operation browser SDK |
| Online duration / departure / rejoin / retained names | New real-cookie room information test desktop/phone and pure/runtime tests |
| Core isolation | AST negative boundary cases; final React graph has 46 core modules and zero forbidden entries |
| Rollback | [Independent Git tree restoration rehearsal](rollback.md) passed; no live reset or project commit |
| Owner-only judgment | [Review brief](human-review.md); parent and speed-dial child remain open |

### Speed-dial child evidence mapping

| Child criterion | Current automated evidence and archived baseline |
| --- | --- |
| A1 | Room-controls speed-dial case: portal controls, hidden inert actions; 10-03 layout validation |
| A2 | Room-controls geometry plus responsive normal/cinema at 1280×900, 375×812, iPad Mini, 1280×640 and 1280×1200; 10-03 main/queue/dock baseline |
| A3 | Real-cookie host/guest, admission, queue/preset and member information; media/provider/danmaku full cases |
| A4 | Room-controls focus/Escape/real-backdrop/interior-padding/keyboard/touch/drag/persistence/safe-area/reduced-motion cases |
| A5 | Populated player/queue/composer clearance at all five viewports, cinema and actual fullscreen; pure collision regressions |
| A6 | Original room-controls dock order/shared draft/independent chat-danmaku server echoes and player presentations; full suite rerun |

The archived layout task's acceptance is reused as the layout baseline. These
new checks complete executable coverage; they do not silently archive or mark
owner acceptance of the separately tracked speed-dial child.
