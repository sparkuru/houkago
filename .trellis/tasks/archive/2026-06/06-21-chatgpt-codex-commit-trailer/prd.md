# Add ChatGPT Codex Commit Trailer Rule

## Goal

Add a durable Trellis workflow rule so work commits made by ChatGPT/Codex include the repository's AI co-author trailer in the user-visible commit plan and in the executed `git commit` command.

## Requirements

- Add the rule to the current Trellis commit step in `.trellis/workflow.md`.
- Use the default trailer because recent commit history does not show an existing Codex/OpenAI convention:
  `Co-authored-by: OpenAI Codex <codex@openai.com>`
- Apply the trailer only to work commits that include files edited by ChatGPT/Codex in the current Trellis session.
- Exclude Trellis archive commits, journal commits, user-authored/unrecognized-only commits, and commits the user chooses to make manually.
- Show the trailer in the proposed commit plan before asking for confirmation.
- Preserve the current workflow numbering, where Phase 3.4 is the manual test checkpoint and Phase 3.5 is commit.

## Acceptance Criteria

- [x] `.trellis/workflow.md` documents the ChatGPT/Codex co-author trailer in Phase 3.5.
- [x] The commit plan template shows the trailer for applicable AI-edited commits.
- [x] The execution command uses a separate `-m` argument for the trailer.
- [x] The rule explicitly excludes `/finish-work` archive and journal commits.
- [x] The workflow remains consistent with the existing Phase 3.4 manual checkpoint and Phase 3.5 commit split.

## Definition of Done

- Workflow documentation is updated narrowly.
- Formatting/readability is checked by inspecting the edited markdown.
- No runtime app validation is required because this is documentation/workflow guidance only.

## Technical Approach

Patch `.trellis/workflow.md` in Phase 3.5, immediately around the commit plan and commit execution steps. Do not create a parallel workflow or modify Trellis runtime scripts.

## Decision (ADR-lite)

**Context**: The `$trellis-plus chatgpt-codex-commit-trailer` reference expects the co-author rule to live in the Trellis commit phase. This repo already has a prior Trellis Plus manual-test gate, so commit is now Phase 3.5 rather than Phase 3.4.

**Decision**: Add the trailer rule to Phase 3.5 while preserving the existing phase split.

**Consequences**: Future Trellis runs will present and execute Codex-attributed work commits without changing `/finish-work` archive or journal behavior.

## Out of Scope

- Changing Git author identity.
- Adding trailers to Claude, archive, journal, or manually authored commits.
- Modifying Trellis upstream package templates.
- Adding automated runtime tests.

## Technical Notes

- Relevant reference: `/home/wkyuu/cargo/repo/04-flyMe2theStar/03-genshin/tsuki/22-agent-skills/trellis-plus/references/chatgpt-codex-commit-trailer.md`
- Recent `git log --format=%B -n 20` showed no existing Codex/OpenAI trailer convention.
- Current workflow source of truth: `.trellis/workflow.md`.
