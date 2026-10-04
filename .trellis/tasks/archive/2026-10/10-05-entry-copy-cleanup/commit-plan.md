# 提交与正常闭环 — 2026-10-05

用户在最终精简与验收结果交付后回复“不错；可以提交”，接受视觉结果并授权提交与正常 Trellis 归档。随后明确“脏文件一起提交”，授权纳入当前全部可追踪脏文件，包括启动前已有的提示配置/默认值/字典修改。无需重复确认；不授权 push 或部署。

## Work commit

`feat(ui): refine homepage layout and simplify entry copy`

- 首页 Home、EntryPanel、IdentityPanel、ClassroomScene、首页范围样式与已有 entry 回归测试。
- `config/config.toml`、`packages/kousoku/src/site-config.ts`、`packages/kyoushitsu-core/src/i18n/messages.ts` 中当前已认可的公开文案。
- `.trellis/spec/frontend/site-configuration.md`、`.trellis/spec/trellis-plus/validation.md`、`.trellis/mainline.md`。
- 当前 task 的 PRD/design/implement/research/validation/context/task 元数据与本提交计划。

暂存采用精确路径。当前已确认 12 个 tracked dirty 文件及本 task 的新文件，无其他可追踪脏文件、预先暂存内容或新工具/第三方素材。

## Closure commits

1. Work commit 后，通过 `task.py archive --no-commit` 归档本 task；更新归档上下文路径与 mainline。归档提交恰好一次使用 `Co-authored-by: OpenAI Codex <codex@openai.com>`。
2. 使用 `add_session.py --no-commit` 记录工作提交、真实检查与闭环结果，只提交相应 journal/index。

不 amend、不推送、不启动新的产品工作。隔离 fixture 已停止，保留用户原有预览。
