# Workspace Index - yui

> Journal tracking for AI development sessions.

---

## Current Status

<!-- @@@auto:current-status -->
- **Active File**: `journal-1.md`
- **Total Sessions**: 16
- **Last Active**: 2026-06-14
<!-- @@@/auto:current-status -->

---

## Active Documents

<!-- @@@auto:active-documents -->
| File | Lines | Status |
|------|-------|--------|
| `journal-1.md` | ~537 | Active |
<!-- @@@/auto:active-documents -->

---

## Session History

<!-- @@@auto:session-history -->
| # | Date | Title | Commits | Branch |
|---|------|-------|---------|--------|
| 16 | 2026-06-14 | 全屏 UI 调优:气泡随控制条上移 + 折叠按钮收进聊天栏头部(#3/#4) | `1868ee6` | `k-on` |
| 15 | 2026-06-14 | 修中途加入不追平(延迟seek兑现)+离开后昵称丢失(roster合并) | `a66069a` | `k-on` |
| 14 | 2026-06-14 | 昵称持久化+进房兜底(guest gate)+roomId 净化(guest/权限 epic 片1) | `9ef17c9` | `k-on` |
| 13 | 2026-06-14 | 昵称显示：聊天/弹幕显 nickname 而非 senderId(roster + SHUSSEKI members) | `5240ed4` | `k-on` |
| 12 | 2026-06-14 | 部員自动跟随改用点击加入遮罩(撤销静音方案,方案二) | `ba733e1`, `c51ccab` | `k-on` |
| 11 | 2026-06-14 | 部員自动跟随播放：绕过浏览器 autoplay 策略（静音自动播+解除遮罩） | `cceb693` | `k-on` |
| 10 | 2026-06-14 | 修复 WS send 未连通抛错致放映断 + dx 端口冲突/docker 强约束工具链改进 | `9c1f696`, `ed24b5b` | `k-on` |
| 9 | 2026-06-14 | 源同步：房主放映源经 JOUEI 下发，部員自动跟随播放 | `428cd15` | `k-on` |
| 8 | 2026-06-14 | LAN/HTTP 下 crypto.randomUUID 崩溃修复（buinId secure-context fallback） | `ddb359a` | `k-on` |
| 7 | 2026-06-14 | P0 验证修复：CORS/LAN 使能 + 全屏 letterbox + 气泡层级 + 聊天可读 | `815b76d` | `k-on` |
| 6 | 2026-06-14 | P0纵切3：聊天气泡 overlay + 网页全屏保留侧栏 | `ad14417` | `k-on` |
| 5 | 2026-06-14 | P0纵切2：漂移校正（服务端权威钟心跳+zureHosei三档） | `a47e9ce` | `k-on` |
| 4 | 2026-06-14 | P0纵切1：单房间房主权威同步端到端 | `f56b415` | `k-on` |
| 3 | 2026-06-13 | Scaffold Bun monorepo（kousoku/housou/kyoushitsu）+ docker(./dx) 开发环境 | `4105532` | `k-on` |
| 2 | 2026-06-13 | 填充 backend/frontend 编码规范，bootstrap 收尾 | `48e9d13` | `k-on` |
| 1 | 2026-06-13 | 后端选型落定：Bun + Elysia.js spike + 弹幕引擎决策 | `ddea404` | `k-on` |
<!-- @@@/auto:session-history -->

---

## Notes

- Sessions are appended to journal files
- New journal file created when current exceeds 2000 lines
- Use `add_session.py` to record sessions