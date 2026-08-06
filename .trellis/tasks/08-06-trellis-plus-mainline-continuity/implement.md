# Implementation plan: Trellis Plus mainline continuity

1. Update the `trellis-plus` trigger description, default enhancement registry,
   discovery workflow, injection targets, update-resilience notes, and expected
   results with short pointers to mainline continuity.
2. Add `references/mainline-continuity.md` with the durable record template,
   Pulse matrix, authorization modes, parent/child conventions, conductor
   protocol, injection guidance, and validation checklist.
3. Regenerate or align `agents/openai.yaml` so its UI summary and default
   prompt accurately describe the extended skill.
4. Validate Markdown references, frontmatter/UI metadata, and the skill folder
   using the skill-creator validator; inspect the target repository diff to
   exclude its pre-existing unrelated modification.
5. Perform a forward-read against representative `no_task`, `guided`, and
   `serial` scenarios, then run the Trellis check gate and commit only the
   target skill files plus this task's artifacts.

## Risk gates

- Do not encode a product-priority heuristic as autonomous authority.
- Do not patch hooks or Trellis runtime scripts when workflow text and the
  existing parser are sufficient.
- Do not treat the task tree as an implicit dependency scheduler; record
  ordering and readiness explicitly in the mainline record.
- Do not stage or edit `mtf/init-dpkg.sh` in the target repository.

## Validation commands

```sh
python3 /home/wkyuu/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  /home/wkyuu/cargo/repo/04-flyMe2theStar/03-genshin/tsuki/21-agent-skills/share/trellis-plus
rg -n 'mainline-continuity|Mainline Continuity' \
  /home/wkyuu/cargo/repo/04-flyMe2theStar/03-genshin/tsuki/21-agent-skills/share/trellis-plus
git -C /home/wkyuu/cargo/repo/04-flyMe2theStar/03-genshin/tsuki/21-agent-skills diff --check
```
