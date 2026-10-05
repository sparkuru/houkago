# 房间界面实现与验证

## Implementation scope

实现 R1–R6：紧凑的部室名/四态连接栏；普通布局桌面与手机 16:9 空投影舞台；播放状态、节目标题与取消当前节目形成层级；番组表先节目后来源，保留 URL 解析→预览→加入、Baidu 与原确认；侧栏沿用出席→弹幕设置→聊天，收敛重复外框并保留 fixed dock 到底的 composer。空队列与等待标题使用角色中立字典文案。

单项删除的 UI 与 runtime 统一使用 playlist gate。当前项无删除操作，房主/获准成员可删除非当前项；排序/清空保持 host gate。不改后端、同步算法、provider 授权或共享主题/控件。

实现代理只编辑产品范围、focused/e2e 测试和此证据；规划、manifest、spec/mainline 与任务生命周期由主会话负责。用户配置与既有 9998/9999 preview 保留。

## Runtime and artifacts

- `DX_BIND_HOST=127.0.0.1 DX_EXTRA_PORTS=13000,15173 ./dx bash scripts/dev-react-preview.sh --backend-port 13000 --frontend-port 15173` 启动独立 memory fixture。禁用 dotenv/provider 私人配置；健康接口与实际 frontend 已探测。
- Website: `http://127.0.0.1:15173`；Housou: `http://127.0.0.1:13000`。
- 本任务最初容器 `0b1df1f8b079` (`blissful_lumiere`) 在验收期间意外退出；替换的 live fixture 为 `2969d701b74a` (`gracious_boyd`)，foreground session `27760`，仅此容器发布上述 loopback 两端口。最终检查结束后，主会话核对 exact ID 和仅 13000/15173 loopback 映射，用 `docker stop 2969d701b74a` 成功停止；原 preview 保留。内存房间在重启时重置。
- 全部 scratch/log/screenshots：`/tmp/houkago-room-interface-refinement/`。`baseline/` 是改前截图；`first-pass/`、`final-pass/` 为中间诊断，不冒充最终视觉验收。
- UUPM 规划原始输出仍仅在 `/tmp`；未复制工具输出、数据或第三方资产进仓库。

## Engineering evidence

全部 Bun 通过 `./dx` 执行；host project-local Playwright 使用 `/usr/bin/google-chrome` 与上述两个实际 fixture URL。SDK drift 在浏览器前完成，浏览器期间不改 watched product source。

| Check | Observed result / evidence |
| --- | --- |
| Focused React units | 55 pass / 0 fail；`focused-unit.log` |
| Root lint | 278 files，无 fixes；`final-lint.log`，独立检查最后 CSS/test 修正后再次通过 `verified-lint.log` |
| Workspace typecheck | 全部包 exit 0；`final-typecheck.log` |
| Root test | 460 pass / 0 fail；`final-test.log`，包含无权限、撤权、closed/error、waiting、busy、guest move/clear 等拒绝路径 |
| Contract drift | 18 generated files byte-stable；`final-drift.log`，最终 CSS 修正后再次通过 `verified-drift.log` |
| React build | exit 0；`final-build.log`，最终 CSS 修正后 `verified-build.log` |
| Emitted module graph | 488 module IDs、0 forbidden Vue/Pinia/Eden/server modules；按实际 graph 内容检查 |

最后 launcher 修正前的工程 checkpoint：`last-lint.log` / `last-typecheck.log` / `last-build.log` / `last-drift.log` 均通过，串行 `serial-final-test.log` 460/460。最终仅 selector 与 overlap test 增量后 `final-incremental-lint.log` 再次通过；独立 checker 的最终 types/综合复核结果记录在下方主会话复核。

第一次 root test 在未修改的 `packages/housou/test/baidu.e2e.test.ts:518` 出现 socket close 后 grant 仍返回 200（预期 403）。原测试单独重跑通过，随后两次 aggregate 都通过；并行浏览器负载下 `last-test.log` 再次出现同一失败。串行最后 aggregate 为 460/460（`serial-final-test.log`）。原失败保存在 `test.log`，独立重跑在 `baidu-root-rerun.log`。保留该未修改测试的时序不稳定证据，不将多次失败隐藏为从未失败；未更改后端、授权或弱化安全断言。

## Browser evidence and iteration

- 改前 room-controls desktop/phone：8/8 passed（`baseline-browser.log`）。
- 第一轮 room/layout/real-cookie：22 pass / 1 fail（`first-browser.log`）。唯一失败是旧测试机械期待 30.72/40 等标题字号，与批准的紧凑 22px 新设计冲突。更新过时字号期待，保留行高、可读性、dock/列/断点几何断言；迭代 desktop/phone 4/4 passed（`iteration-browser.log`）。
- 第一轮全受影响 browser：36 pass、2 fail、3 intentional applicability skips（`final-browser.log`）。两个失败来自新增 offline 测试错误期待 composer disabled：实际 RoomSession 断连会清空 admission 并显示 gate，composer 正确不在 DOM。改为检查断开 copy、gate、无 composer/删除动作，恢复后重获 admission/权限；desktop/phone 2/2 passed（`offline-cookie-rerun.log`）。
- 真实 cookie/WS 证明：未授权 guest DELETE 403/队列保留；房主授权并等 server echo 后，guest 可通过可见删除按钮对房主添加的待播项取消确认/确认删除；确认 DELETE 200、双方 BANGUMI 队列一致。guest move/clear 403；当前项无删除按钮。撤权时待播项仍存在，guest 按钮消失且 DELETE 403、双方队列保持；offline gate 无受保护操作。房主 clear 的取消与确认仍保留当前节目。
- 已有 real-cookie 流程继续覆盖 restore/审批/拒绝/关闭/密码/成员移出/消息和姓名历史；URL 解析错误保留草稿，成功预览后实际加入并由 WS 更新双方队列。
- 布局测试覆盖 320/375/768/812/850/851/1199/1200/1280/1440、812×375 横屏与既有 2048、short/tall/iPad。检查 stage 比例、DOM Range 文本边界、long/unbroken 标题、source 阅读顺序、展开设置、44px settings/input/label 高度、200% text 后控件与文字边界，以及实际聊天最终状态。
- 普通/reduced-motion、focus/inert、菜单 dismiss/拖动/存储/避让、返回/复制、native dialog、fixed dock 内 chat/composer 到底、cinema 与 native/web fullscreen 由既有受影响 browser 行为断言验证。

完整 `verified-browser.log` 运行在 20 passes 后意外 exit 143；之后 `last-browser.log` 为所有适用项目 connection-refused。核对发现任务 fixture 容器已经退出，并非产品断言失败；重启 fixture 后两端健康探测通过，再串行执行工程 gate 与最终 browser。保留这些环境失败日志，不将中断的 runner 当作完整通过。

最后完整 browser checkpoint：全部 13 受影响项目 **38 passed / 3 applicability skips**（41 registered cases，`accepted-browser.log`，1.0m）。覆盖 room-controls、三个 room-layout、real-cookie、media、danmaku、Baidu 桌面/手机配对。

随后完成两项已批准 refinement：visible settings label hit areas 也参与避让，避免 launcher 在文字/滑块间吞掉标签触控区；200% 下 queue title/metadata block 也参与避让，避免文字被覆盖。二者仅扩展实际测量 selector，不改 drag/storage/finder 算法。隐藏的 composer 1×1 label 不单独计入；整个 composer 始终受保护。

label-only `label-browser.log` 16/17：phone cinema 的旧断言要求 launcher 必须在 composer 下方，实际已经在上方且无重叠。主会话确认契约允许任意方向净空；改为测四个矩形方向最大分隔距离 ≥8px，原无重叠断言保留。最终增量 **17/17 passed**（`final-incremental-browser.log`，27.7s），重跑 room-controls desktop/phone、room-layout ipad/short/tall、danmaku desktop/phone；其他功能未变，保留完整 checkpoint。

独立 checker 随后指出 manual-search 的可见 htmlFor label 也需避让。仅增加 `.room-dock .danmaku-manual-search label`，保留隐藏 composer label 排除；既有 danmaku 手动搜索流程补 scroll→真实≥8px净空→label 点击→关联 input focus。最后受影响 **6/6 passed**（`final-manual-label-browser.log`，10.1s）：danmaku desktop/phone 全部4项与 refined-long room-controls desktop/phone 2项；root lint 278文件通过（`final-manual-label-lint.log`）。产品/测试源文件在此冻结。最新 refined-long/200%/empty 截图为 `final-manual-label/`；其他布局最终图保留 `final-incremental/`，完整 checkpoint 图保留 `accepted/`。

主会话最后中文 desktop/phone 截图与可见 dock input/button/summary/settings+manual label 净空脚本通过（`main-review-final.log`），实际有≥7.5px浮点容差净空、errors[]；目视 final phone 展开设置和200%长标题图。checker 的独立最终结论见下方主会话复核与 check-review.md。

最终截图在 `/tmp/houkago-room-interface-refinement/final-incremental/`；完整 checkpoint 图在 `accepted/`。已读取最终桌面/手机空舞台、有媒体、展开设置/长队列、200% 和 cinema 截图；最后 title/label 修正后重做整体八维检查，未保留可具体指出的范围内文字或控件遮挡。主会话最终 Chinese room/实际颜色/44px 与控件净空测量在 `main-review/`，记录错误数组为空、placeholder 5.96:1、有效控件边界3.22–3.28:1；最终主体视觉与独立 checker 结果见下方主会话复核。

## Eight-dimensional review

| Dimension | Observation → correction → verification |
| --- | --- |
| Typography | 原 header 大字号+overline+状态三层过重；收敛为 22px 部室名与 compact 状态。长节目名/用户名按实际边界换行，200% 下队列 title basis 让动作换到下一行；普通和放大文字 Range/控件检查通过。 |
| Whitespace | 原来源框抢在节目列表前、dock 多重 card 外框竞争。节目先行，来源以下分隔线连接；dock 单一纸面与分段，聊天填满余高。普通/cinema 的 chat/composer bottom 几何、短高视口滚动通过。 |
| Hierarchy | 空投影/有节目舞台为第一重心，取消当前为媒体次要描边动作；队列选择、排序、危险删除/清空分层。角色中立等待/空队列 copy 不误导未获准成员。 |
| Color | 复用 Warm Club tokens，无新主题。必要 media metadata 使用 overlay-muted；危险操作使用 danger。独立检查发现 placeholder 默认 50% alpha 和 provider 控件边界不足，修为 muted+opacity1 与既有 wood70%+accent30% mix。正文 ink/canvas 12.66:1、muted/canvas 5.26:1、muted/surface 5.86:1、danger/surface 5.80:1、混合边界/surface 3.22:1；主会话实际渐变测量 stage headline15.91/hint9.91。 |
| Motion | 不新增装饰循环；保留 dial normal 节奏与 reduced-motion。既有 transition settling、reduce 断言与 native/fullscreen 行为回归通过。静态截图关闭动画仅作诊断。 |
| Microinteractions | 保留 labels、confirm、pending 文案、解析错误/成功草稿与 server authority。独立检查发现 settings ranges/number/label 高度16/25.6px，房间范围修为 min44，新增实际 browser target 几何断言。随后展开 phone 设置发现 `+` 覆盖时间校正输入：仅扩展消费侧 obstacle selector 包含 dock 可见按钮/输入/summary/settings label，并观察 source-panel resize；再纳入 200% queue title/metadata。原拖动/存储/算法不改。新增展开后、多宽度与200%的真实控件/文字 overlap 断言，最终17/17通过。权限/忙碌/断连路径及菜单/焦点/触控行为实测。 |
| Responsive | 空舞台此前只在桌面 16:9，扩展所有普通布局；长标题动作行/200% 换行，布局断点与安全区、fixed/flow dock、cinema 条件保留。最终多宽度与 desktop/phone 交互重新执行。 |
| Originality | 延用自有投影 SVG、暖纸放映工作区与建筑式对齐。没有引入图库、远程字体、landing 模板或新依赖；截图检查整体观看重心与辅助操作细节，不以存在 SVG 当作品质证明。 |

实现代理、主会话与独立 check 在最后一次改动后完成八维整体视觉复核，未发现剩余范围内可具体指出的问题；各自证据已记录。工程证据与主体视觉偏好分开；未宣称任何奖项认证。

## Boundary and residual human review

全部受影响交互 `mobile-required` / `playwright-required`，既有有效 runner 标为 equivalent。Baidu desktop 专属成功流程在 phone 项目跳过；phone desktop-only 说明在 desktop 项目跳过，这三项是同一配对测试的适用性排除，相关功能在适用项目仍需通过。

受控 MP4/HLS/DASH、provider/adapter、danmaku fixture 证明本地 UI 与真实 Housou cookie/WS 行为，不证明真实上游、Safari、实体设备、软键盘或跨设备 LAN。本任务已排除这些新增验收；未使用真实凭据。剩余完整视觉/产品偏好归 `human-required`，自动化完成后只留主观验收，不要求用户代做已覆盖的 smoke tests。

## Main-session final review

最终 frozen source 的独立 Trellis check 通过：root lint 278 files、七个 workspace typecheck、focused runtime/connection 11 tests / 82 assertions；未留下源码、权限或 spec 合规问题。独立 UI probe 在 320/375/1280px 检查设置展开、长队列 200% 文字及滚动后的 launcher 可见、视口内、净空与实际点击/Escape，三个宽度的 pageErrors 均为空。日志 `check-final-lint.log`、`check-final-typecheck.log`、`check-focused.log` 和 `check-ui/results.json`；结论见 `check-review.md`。

主会话读取最终中文桌面/手机整页、展开设置及最终 200% 长标题诊断图，核对八维观察与实际修正：观看舞台优先、来源次于队列、dock 分段安静，文字/目标/边界对比和浮动按钮避让已补齐。没有剩余可具体指出的范围内问题。A1–A6/A8 技术证据完成；A7 的八维自检与独立检查完成，最终主观视觉偏好仍由用户确认，因此任务保持 in_progress。

原 preview 的 `./preview.sh status` 最后健康探测通过，Website `http://127.0.0.1:9999`，host 地址候选包含 `http://192.168.9.4:9999`；其他设备连通性未重新验证。没有提交、归档、push 或部署。

Cleanup: 任务容器 `2969d701b74a` 已精确停止。清理后再次 `./preview.sh status` exit 0，原 9998/9999 API/frontend 仍健康；`original-preview-final-status.log` 保存完整监听/地址证据。无需保留临时 memory 账户或房间。

## Follow-up R7/R8 — whole viewport and selected source flows (2026-10-05)

用户的新两项反馈继续当前任务，下面是后续实现证据；上方首轮 checkpoint 和 cleanup 不表示本轮服务或结果。没有提交、归档或发布。

### Implementation and observed defects

- 改前实际鼠标从 launcher `{x:872.8125,y:773.78125}` 拖向固定 chat feed 中心，最终仍在 `x:872.8125`，无法跨越整栏左边界；同时链接表单和 Baidu 面板都可见。此事实来自改前隔离 browser probe 的工具输出，后续 `baseline.png` 曾被诊断重写，不作为改前图像证据。
- R7 移除 dock 宽度产生的 right inset，保留真正 viewport/safe-area、归一化存储、8px 具体障碍、drag threshold、焦点、resize 与 fullscreen；具体障碍新增可见 dock 标题、成员姓名/角色、消息和来源 select。菜单按实际宽度 clamp 到视口，取消整栏左偏移，跟随渲染重新量宽。
- 实际拖动新增验收发现关闭 native details 的孩子在 Chromium 仍有正尺寸且 visibility 为 visible；旧筛选把看不见的设置当作障碍，空 feed 落点被推开约 70px。改用 `checkVisibility({visibilityProperty:true})` 排除隐藏祖先/折叠 details，观察 `hidden`/`open` mutation；可见细控件仍参与避让。
- R8 将来源呈现抽为房间局部 `RoomSources`，小型 typed source list 驱动原生选择器，当前流程是视频链接和百度网盘。一次只显示一个面板，非活动流程 mounted + hidden，不进布局、焦点或障碍。链接草稿/预览和 Baidu 连接状态留存；无 playlist 只展示个人 Baidu 流程，不新增 provider、依赖或后台注册机制。支持类型在持久 hint 出现，placeholder 收敛为“粘贴视频链接”。
- 独立复核补充发现 Baidu 旧按钮每次 `loadDirectory('/')`，返回面板重新开浏览器会丢失目录。先扩现有 provider 用例：进入 `/动画` → 关闭 → 切换链接/Baidu → 重新打开仍有当前“动画” breadcrumb。`browse-retention-red.log` 实际失败后仅改打开参数为 `path`，仍重新读取目录；撤 playlist 时在既有 page/selected 清理旁同步 `setPath('/')`。原 revoke reset、HTTP/adapter、OAuth、错误、许可和 media grant 逻辑保留。

### Final verification and iteration

所有命令使用既有 `./dx` 和项目本地 Playwright/Chrome；browser base `http://127.0.0.1:15173`，API `http://127.0.0.1:13000`。Artifacts：`/tmp/houkago-room-interface-refinement/followup/`。

| Check | Actual result / evidence |
| --- | --- |
| Root lint / types / tests / build | `accepted-lint.log` 279 files；`accepted-types.log` 7 workspaces；`accepted-tests.log` 460/460、2355 assertions；`accepted-build.log` production build exit 0。第三方 dashjs build warning 保留在日志，未改依赖。 |
| Contract / actual graph | `drift.log` 18 generated files byte-stable，发生在所有 browser acceptance 前；实际 emitted graph 489 modules、0 forbidden Vue/Pinia/Eden/Housou/旧应用 source。最后目录改动不触及生成合同/依赖，未并发 regeneration。 |
| Broad final R7/R8 browser checkpoint | `accepted-browser.log`：13 affected projects，40 pass / 3 applicability skips。包括 room-controls desktop/phone、iPad/short/tall layout、real-cookie pair、media pair、danmaku pair、Baidu pair。 |
| Last Baidu folder fix | `browse-retention-final.log`：Baidu desktop/phone pair 3 pass / 3 existing applicability skips，包含非 root 目录切换往返、OAuth/permit/revoke-failure/success 和 mobile limitation；`browse-retention-lint.log` 279 files、`browse-retention-types.log` 7 workspaces、`browse-retention-units.log` 55/55 React tests、245 assertions。此为最后两行 provider 改动后的针对性最终结果，40/3 是此前广泛 checkpoint。 |
| Main independent visual probe | `main-visual-rerun.log` 与 `main-review/`：中文 desktop/phone、source picker 44px、hidden 面板、draft roundtrip 和 dock 控件/labels 净空；page errors 空。首次首页等待 timeout 诊断保留，随后健康 probe 与独立重试通过，未据此虚构产品缺陷。最后短 placeholder 及目录修正后的 main/check refresh 由其各自复核记录补充。 |

保留失败与修正路径：`iteration.log` 2 failures 揭示 collapsed-details phantom obstacle；`iteration2.log` 2 failures 是用空房间执行尚不存在的 cinema 控件，改为真实 local MP4 fixture；`iteration3.log` 2/2 pass。`final-browser.log` 36 pass/3 skips/4 fail，其中 3 条旧断言要求 launcher 左于整栏或对齐 grid-right，按 R7 改为 viewport 16px / composer 8px 净空，保留 dock 几何；另一条是 native picker tap 后程序 selectOption 再 Enter 提交旧选择，改为 tap → ArrowDown → Enter。`final-layout.log` 14/15，唯一 phone 窄屏拖动测试在 scroll 后立即读旧 launcher 几何，补两个 rAF 等捕获 scroll 的避让测量稳定，保持精确目标断言；`final-drag.log` desktop/phone 2/2。最后完整 `accepted-browser.log` 40/3；目录 RED→修正→对应 pair GREEN 如上。没有扩大 timeout、删除权限/authority 断言或弱化手机落点。

新的交互实测：375px 实际 CDP touch 将按钮拖入已滚到视口的空聊天 feed；同一 touch context resize 1280 后在固定 dock normal/cinema 落点保持，desktop 用鼠标；方向键跨入/跨出 dock、reload 存储恢复、resize 不覆写偏好、Enter/Escape/焦点和菜单视口范围。原 drag 不误开菜单与 fullscreen 隐藏保持。选择来源覆盖桌面键盘、手机 touch 打开 native picker，隐藏流程不聚焦、草稿/预览回来保留；真实 cookie guest 无 playlist 仍可管理 Baidu 个人连接，没有链接创建或浏览添加入口，授权/撤权与 WS queue 权威通过。

### Final eight-dimension follow-up review

最终源码在最后目录修正后重读，结合 `accepted-browser-results/` 的 desktop/phone、expanded settings、200% 长文字、cinema 截图和最后 provider 真实往返进行复核；两行目录修正不改变静态版式。

| Dimension | Observation / correction / final evidence |
| --- | --- |
| Typography | 选择来源与链接表单字体沿现有 token；长 hint 可换行，placeholder 不再重复类型列表或手机截断；200% 来源/队列/中文与 unbroken title 可读，DOM Range 和 control geometry 通过。 |
| Whitespace | 队列先节目、后 picker；仅一个流程占空间，Baidu 面板 hidden 时无残留分隔框。fixed dock 仍满高，手机 flow 顺序保留，空 feed 成为实际可放置区域。 |
| Hierarchy | 播放器仍是重心；统一来源入口和一条所选流程避免来源数量增加时堆叠表单。Bilibili/直接视频共用原 parse 流程，未新增竞争卡片。 |
| Color | picker 派生已有 wood border、warm surface/ink、teal focus，与已验证输入/控件组合一致（必要边界约3.2:1、muted/white 约5.96:1）；44px 原生目标及 focus 保留，没有新配色或降低有效文字 opacity。 |
| Motion | 来源切换原生/即时，不新增装饰 reveal；menu 保留正常节奏与 reduced-motion，viewport/menu 测量不会动画覆盖用户输入；已有 normal/reduce browser 断言通过。 |
| Microinteractions | 真正 mouse/touch/keyboard 全区域拖动，持久偏好不被自动避让改写，hidden/collapsed 控件不冒充障碍；picker pending gate、草稿/预览、Baidu 当前目录、个人连接和权限撤销保留，原 native dialog/confirm/错误最终状态通过。 |
| Responsive | 320/375/768/812、850/851、1199/1200、1280/1440、short/tall/iPad/cinema、200% final browser geometry 通过；选择器不形成横向 tab strip；实际375 touch和1280 fixed dock都已操作。 |
| Originality | 原创投影与 Warm Club 放映工作区继续作为身份，picker 体现真实来源流程而非通用图库/营销模板；无新外部资产、远程字体、插件或依赖。 |

本轮最后复核没有剩余范围内可具体指出的静态视觉/行为问题；独立 check/main 最终结果记录在各自章节。受控 fixture 不证明 upstream、Safari、实体设备或软键盘，排除范围保留。最终主观视觉偏好仍由用户确认。

本轮 memory fixture 容器 `6ec97d9b4ae4` / foreground session `48742` 暂留给 main/check 最终复核；结束后只由主会话精确停止。原 preview 9998/9999 从未停止、配置未改，收尾状态/cleanup 由主会话记录。

### Main-session follow-up closure checkpoint

主会话已读取最终 RoomSources/launcher/目录修正与 shared spec diff，目视中文 desktop/phone 整页、两种来源及独立实际200%字体现有截图，确认八维最终观察与需求一致。最终短 placeholder 的独立中文截图/44px picker/draft roundtrip/hidden panel/具体控件净空脚本 `followup/main-visual-final.log` exit0、pageerrors[]；最后目录两行行为修正由真实 RED→GREEN provider 回归及 checker 最终 probe 覆盖，未把之前的完整浏览器 checkpoint冒充修正后全量重跑。

独立最后 review PASS，见 check-review.md follow-up 章节：279-file lint、七 workspace types、真实1280鼠标/375触控、hidden-details测量、原生来源焦点、草稿及真正computed字体200% probe通过。A9/A10与全部技术criteria已验证，A7仅保留主观视觉验收；task保持in_progress，没有提交/归档/push/部署。

所有任务browser已结束。核对 `6ec97d9b4ae4` exact ID 与仅127.0.0.1的13000/15173映射后，`docker stop 6ec97d9b4ae4`成功；临时 memory服务/数据已结束。清理后 `./preview.sh status` exit0，原9998/9999服务仍ready，完整地址与监听证据在 `followup/original-preview-final-status.log`。Website host候选 `http://192.168.9.4:9999`，local `http://127.0.0.1:9999`；本轮未验证其他设备连通性。用户原配置/持久数据保留。

## Screenshot follow-up — viewport-only free placement (2026-10-05)

用户截图标出的右上出席、右下composer仍被上一轮具体内容避让限制；最新R7替代全部内容净空要求。下面记录本轮实际修复，上方历史checkpoint仍保留，不代表当前自由放置行为。

### Reproduction and final implementation

隔离Chromium 2048×1196实际复现：出席标题目标中心 `(1832,41.8)` 被推到 `(1832,88.6)`；输入目标 `(1832,1093)` 被推到 `(1832,1009)`；发送目标 `(1971,1145)` 也被推到 `(1971,1009)`。`free-placement/baseline-measurements.json` 与三张 `baseline-*.png` 保存改前落点。根因是launcher每次渲染通过 `findClearRoomFloatingPosition` 避让 `.room-dock h2` 与whole-composer等障碍，整栏边界开放后这两区仍无法停留。

最终实现仅将归一化位置转换到当前viewport/safe-area/button-size矩形。删除所有content obstacle selectors/state/measurement、room MutationObserver、content ResizeObserver与scroll监听，以及已无生产消费者的 `RoomFloatingObstacle` / `findClearRoomFloatingPosition`，不保留兼容别名。只保留viewport resize/visualViewport resize与portal自身尺寸观察，以响应实际viewport和inset变化。用户拖入任何文字、播放器、输入或按钮后都允许覆盖，不再自动寻找其它落点。

存储key/version和已有v1位置不变；没有存储时默认改为 `{x:1,y:0.65}`，避免新房间自动占用底部发送按钮，仍是简单常量而非内容测量/隐式禁区。旧位置可继续自由拖回右下或标题。鼠标/触摸capture和threshold、drag-click抑制、箭头/Shift步长、菜单实际尺寸视口clamp、inert、Escape/焦点及真正fullscreen隐藏保持。来源选择、provider、room runtime与样式未作本轮修改。

### Final runnable verification

Artifacts为 `/tmp/houkago-room-interface-refinement/free-placement/`。沿用 `./dx`，browser使用host项目本地Playwright和 `/usr/bin/google-chrome`；base/API分别 `http://127.0.0.1:15173` / `http://127.0.0.1:13000`。未读取私人dotenv/凭据；新fixture为memory数据库。

| Check | Actual result / evidence |
| --- | --- |
| React focused units | `unit-final.log`：50/50，235 assertions。保留归一化转换、clamp、合法/无效storage、resize、较大设备safe-inset；默认坐标与fresh行为按新需求同步。 |
| Root tests / lint / types | `root-tests.log`：455/455、2345 assertions、87 files；`lint-final.log`：279 files；`types-final.log`：7 workspaces均exit0。 |
| Production build / graph | `build-final.log` exit0，保留原dashjs第三方build warning；实际 `dist/module-graph.json` 489 modules、0 forbidden，摘要 `module-graph.json`。未改依赖/共享core/API/generated，复用上轮18-file byte-stable drift证据，不在browser期间regenerate。 |
| Affected browser coverage | `final-browser.log`：9项目room-controls桌面/手机、iPad/short/tall layout、media桌面/手机、danmaku桌面/手机中27项通过；只新增safe-inset模拟两项失败，修正test几何settling后 `safe-browser.log` 两项通过。最终29项受影响case全部通过，无skip。先前真实cookie与Baidu成功/权限/provider流程保持上轮证据，未冒充本轮重新执行。 |
| Precise placement | 2048×1196、1280×900鼠标；375×812及同touch context resize1280实际CDP touch。normal/cinema分别拖到出席标题、输入、发送，release中心距目标<2px、菜单仍关闭；箭头在同区实际移动16px并返回，scroll/details展开折叠、权威queue WS更新不推开；reload恢复，resize不覆写storage，较大inset clamp和菜单边界通过。 |
| Existing behavior | fresh实际输入/发送成功，用户覆盖composer后移开仍实际发送；closed actions inert、menu viewport/focus/dialog/dismissal、source状态保留、媒体本地source/subtitle/play/seek/cinema、web/native fullscreen隐藏恢复及danmaku成功/stale状态通过。 |

测试数量变化明确：460→455 root与55→50 React均因删除**5项仅验证旧8px内容避让政策**的unit cases，废弃helper一并删除；不是掩盖失败。浏览器旧 `expectNoSpeedDialOverlap` / composer8px条件由最新用户R7撤销，改为viewport安全边界和真实目标保持；dock/player/queue布局、文字、44px目标与各业务最终状态仍保留。新增独立free-placement用例，原来源状态用例保留。没有扩大timeout、恢复避让或修改命令权限。

迭代失败保留：`initial-browser.log` desktop通过、phone下一目标失败，scrollIntoView让两个不同内容目标恰在同视口坐标，零距离touch实际是tap。测试helper在接近同坐标时先真实拖到另一位置，再拖回目标，保持产品threshold不变，`target-browser.log` 2/2通过。`final-browser.log` 两项模拟safe-inset失败来自改padding后尚未等portal ResizeObserver完成就读取drag start；测试先断言当前偏好在新inset矩形已重新投影，再实拖两端，`safe-browser.log` 2/2通过。边界要求、target精度及所有产品行为未削弱。

### Eight-dimension final observations

最后product源码与desktop/phone fresh、normal/cinema放置、long queue200%截图及真实操作一并复核。排版/层级保持紧凑标题、观看优先和单来源流程；留白保持dock满高与原flow顺序；色彩/44px控件/focus沿已验证Warm Club tokens无变动；normal/reduced-motion与menu/inert/focus动态用例继续通过。微交互修复明确目标释放后不推开，真实touch与键盘同样可达；响应式覆盖320/375/768/812、断点两侧、1280/1440、2048、short/tall/iPad/200%及cinema/fullscreen，launcher不再因内容变化位移。原创投影、放映工作区及资产来源不变，无新增素材/依赖。用户主动选择覆盖底层内容是最新R7允许的行为，不将其重新记为自动避让缺陷；fresh默认位置避免初始发送区回退。

本轮未发现剩余范围内具体问题。截图静态关闭动画，动态normal/reduce另由现有runner验收。受控本地media与Chromium touch模拟不证明upstream、Safari、实体设备或软键盘；原排除边界保留，完整主观视觉仍待用户确认。

本轮fixture容器 `62a3ebd6fef7`（仅127.0.0.1映射13000/15173），foreground session `93767` 暂留给main/check，结束后由主会话精确清理。原9998/9999 preview/configuration始终保留；本代理没有提交、归档或部署。独立main/check结果和最终cleanup由对应负责人追加。

最终跨文件检查发现danmaku manual-search还留有上一轮label≥8px launcher净空条件。按新R7仅删除这段过时几何断言，保留scroll、真实label click、input focus、搜索/确认及stale行为；`danmaku-final.log` 桌面/手机配对4/4通过（6.3s）。这是最后test-only改动，产品源码与上述29项验收时相同；未重复root/build。`rg`确认React产品与e2e已没有finder/type/obstacle selector或旧no-overlap/composer-gap消费者。

### Main-session screenshot repair checkpoint and cleanup

主会话独立mouse2048×1196 / CDPtouch375×812六个原受限目标全部<1px精确保持，aria-expanded=false、errors[]。desktop中心为attendance(1832,42)、input(1832,1093)、send(1971,1145)，对应实际按钮左上(1806,16)/(1806,1067)/(1945,1119)。日志free-placement/main-review.log，六图与结果main-review/；已目视desktop-attendance和phone-send，截图确认按钮确能放入用户标出的区域。此用户选择覆盖与原布局/文字/44px目标分开评价，最终八维记录完整且无范围内具体遗留问题。

Independent reviewer最终PASS，见check-review.md screenshot follow-up：自己的279-file lint/七包types、6-target真实输入、scroll/details/reload/storage/key/menu/focus与fresh/moved-away真实WS发送通过，核验455/50单测、29browser和finaldanmaku4/4、build/graph及sharedspec同步。22+22 context验证和diff whitespace通过。A9重新勾选；任务仍in_progress等待A7主观视觉，不含提交、归档、push或部署。

所有代理browser与文件所有权已释放。主会话核对exact容器62a3ebd6fef7与仅loopback13000/15173映射后，docker stop成功；本轮memory夹具已结束。清理后./preview.sh status仍exit0/ready，原9998/9999preview与用户配置/持久数据保留。完整状态在free-placement/original-preview-final-status.log；Website候选http://192.168.9.4:9999，本机http://127.0.0.1:9999，本轮未验证其它设备连通性。

### Owner acceptance and submission — 2026-10-05

最终可运行结果、截图修复与独立检查完成后，用户明确回复 `可以提交`。
本次最终结果接受解除 A7 主观视觉余项，并授权当前 task 的 work commit 与正常
归档/会话收尾。A1–A10 均已解决。此批准不授权 push、生产部署或新产品任务。
提交前仅更新验收与生命周期记录，产品源码保持最终已检查版本；无需重复产品测试。
