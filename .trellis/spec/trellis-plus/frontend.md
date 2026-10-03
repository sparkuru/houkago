# Frontend Design Integration

Houkago has user-facing React/Vite/Tailwind room and entry sources under
`packages/kyoushitsu-react`; portable helpers are in `packages/kyoushitsu-core`.
M6 retired the old application after owner acceptance. Dependencies and actual
sources prove UI applicability.
A backend-only change does not need design generation.

## Initialization

Codex's project-local entry is `.codex/skills/ui-ux-pro-max/SKILL.md`; its
`scripts/search.py --help` passes and scripts/data are present. Reuse it.
A global installation does not replace it. Other platforms must check their
actual project-local entry and referenced assets.

If initialization is absent/incomplete, ask whether to run
`uipro init --ai codex` (or the active platform), explaining the local files
created. Do not install silently, use `--ai all` or overwrite existing skills.
If declined, skip UUPM commands, retain ordinary UI validation and record the
decision in existing task notes. Generated platform files remain local;
existing tracked Codex files are preserved, not expanded. Read the
[third-party inventory](../../../third_party/index.md) before retaining copied
material; missing notices are not resolved by package metadata.

## Plan → implement → check → update spec

1. During UI planning, read the initialized skill, relevant frontend specs
   and approved visual/interaction references. Generate task design research
   with the existing CLI, for example for a React Warm Club room task:

   ```sh
   python3 .codex/skills/ui-ux-pro-max/scripts/search.py "shared video watch room Warm Club content-first responsive" --design-system --stack react -p "Houkago room" -f markdown
   ```

   Capture output under task `research/` when its source/license permits;
   otherwise retain an original decision summary. This does not authorize a
   rebrand or replace approved designs. Incidental stack/example wording in
   the local skill yields to the real repository stack and approved decisions.
   Do not create another canonical `design-system/MASTER.md` via `--persist`.
2. Select decisions into approved task `design.md`: layouts, type, colors,
   states, keyboard/focus, touch, safe areas and reduced motion. Cover loading,
   empty, error, disabled, success and permission states. Classify mobile
   before implementation using [validation.md](validation.md).
3. Register specs, approved design and research/decision evidence in both
   manifests using [loading.md](loading.md). Preserve supplied decisions;
   record constraint-driven changes and update both contexts.
4. Implement through the real component/runtime path. Check user flows,
   contrast, names, focus, touch targets, responsive states, motion, image/list
   performance and chart non-color cues when relevant. Run focused desktop
   and mobile browser checks; static checks alone do not validate UI. Ask only
   for residual human judgment after automation.
5. Promote only verified, stable and approved reusable decisions into shared
   policy. Keep task-specific decisions/evidence in the task; do not copy tool
   source or unreviewed recommendations into shared specs.

This policy update changes no UI and generates no design artifact.
