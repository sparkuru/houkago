# Retained Third-Party Notices

This inventory supplements original notices; it does not change the project
license or claim all distribution requirements have been satisfied.

| Component | Version/provenance | Retained project paths | Notice status |
| --- | --- | --- | --- |
| Trellis | `.trellis/.version` and matching installed npm `@mindfoldhq/trellis` / `@mindfoldhq/trellis-core` metadata: 0.6.14 | Protected Trellis workflow/runtime/templates and managed AGENTS/platform files | Exact [LICENSE](TRELLIS-0.6.14-LICENSE) collected from matching installed Trellis; core's LICENSE is byte-identical |
| UI/UX Pro Max | Project `.codex/skills/ui-ux-pro-max/` scripts/data; installed `ui-ux-pro-max-cli` is 2.10.2, which alone does not prove retained asset version | Existing tracked `.codex/skills/ui-ux-pro-max/**` and retained task design research | `license-notice-needed`: no applicable exact LICENSE/NOTICE found in project assets or local CLI package; version/source mapping unresolved |

Trellis source is the matching installed npm distribution's root `LICENSE`,
with package metadata declaring `AGPL-3.0-only`. No separate component
COPYRIGHT/NOTICE was found in that local distribution; collection does not
resolve a notice omitted from the package. Preserve inline notices and consult
exact release provenance if additional material is needed.

Do not use the unrelated `ui-styling/LICENSE.txt` bundled by the UUPM CLI as
UUPM's license or fabricate MIT text from metadata. Until exact provenance and
notice are established, do not stage new UUPM platform/source copies. Existing
tracked platform files are preserved without retroactive untracking.

Ordinary dependencies retain package notices; this inventory does not vendor
every dependency. `dx`, `dev.sh`, isolated preview scripts and the new thin
`preview.sh` remain ordinary project scripts; no tool implementation was copied
into them here. Recheck notices when retained versions/assets change, preserving
applicable older entries and verifying collected bytes.
