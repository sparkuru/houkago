# 更新主设计路线图

## Goal

把刚才对 `design.md` 与当前代码实现的差距回顾，沉淀回主设计文档，让 `design.md` 继续承担主干 PRD / 产品蓝图的角色；后续具体开发仍用 Trellis task 承接。

## What I Already Know

* 用户接受“主线产品规划写进 `design.md`，具体执行项再用 Trellis task”的建议。
* Trellis 有 task `prd.md` 和 parent/subtask 机制，但没有固定名为“主干 PRD”的项目级概念。
* 当前仓库实际存在 `kousoku`、`housou`、`kyoushitsu` 三包。
* `eisha` 与 `kokuban` 仍停留在设计阶段，代码包不存在。
* P0 同步主干基本成型；P1/P2 大块未开始；P3/P4 有局部功能提前落地。

## Requirements

* 更新 `design.md` 的分期路线部分。
* 增加“当前实现状态 / 差距回填”内容。
* 明确哪些能力已完成、部分完成、未开始。
* 将待办按 P0-P4 重新梳理成可执行 backlog。
* 标出建议下一项：P1 实时 `DANMAKU` 最小纵切。
* 不创建长期 parent task。
* 不修改功能代码。

## Acceptance Criteria

* [ ] `design.md` 说明主设计文档与 Trellis task 的分工。
* [ ] `design.md` 包含当前实现状态对照。
* [ ] `design.md` 包含 P0-P4 的剩余任务清单。
* [ ] `design.md` 明确推荐下一步。
* [ ] Lint 通过，或说明未运行原因。

## Definition of Done

* 文档更新完成。
* 不触碰已有未提交的 `readme.md` 改动。
* 如有必要，提交并归档本 Trellis 任务。

## Out of Scope

* 实现任何 P1/P2/P3/P4 功能。
* 建立长期 parent task。
* 调整 `.trellis/spec/` 编码规范。

## Technical Notes

* 主要目标文件：`design.md`。
* 既有未提交文件：`readme.md`，本任务不纳入。
