# Preview presentation discovery

## Evidence and boundary

- `preview.sh` forwards to `dx preview`. Preserve the thin entry and existing equivalent renderer rather than copying the reference asset or introducing another lifecycle.
- `dx:23` owns shared help. `die`, `setup_step`, build/preparation and cleanup messages are shell presentation sites.
- `scripts/preview-config.py:25` styles all destinations based on `sys.stderr.isatty()`. `render_section` colors URL lines; `TERM=dumb` is unchecked. Keep machine-readable `load`/`runtime` output free of styling.
- Read the user-specified Trellis Plus skill's current `CHACKLIST.md`, console contract, bootstrap integration, environment configuration, file policy and project-policy-loading references; inspected `assets/refer-preview.sh` for observable style/help behavior.
- `./preview.sh --help` succeeded during planning and displayed unsectioned shared dx/preview help. No lifecycle test or real Docker startup was performed.
- Preserve baseline dirty frontend guidelines, floating-action-button task metadata, room-controls-subpage task directory, core i18n messages, room-controls browser tests, governance/room controls components and React CSS.

## Ownership and validation plan

Ordinary project code: `preview.sh`, `dx`, `scripts/preview-config.py`, focused existing preview regressions. Project-shared data: this task, mainline and applicable Plus details. Protected Trellis runtime/managed integrations remain read-only; personal settings and `.env` stay local. No staging or third-party copying is proposed.

After implementation approval:

- Run `bash -n` and available ShellCheck/shfmt for affected shell files, retaining project formatting.
- Exercise semantic styling under TTY, separate stdout/stderr TTY combinations, nonempty `NO_COLOR`, `TERM=dumb`, plain URLs and dependency-free help, using existing tests and `/tmp` fixtures.
- Run `python3 scripts/test-preview.py` and `bash scripts/test-react-preview.sh`. Python fixtures bind loopback sockets and stub Docker; report that boundary.
- If available, run isolated real-container smoke with secret-free copied configuration, disposable data and free loopback ports. Never start the user's configured preview merely to review colors; explicitly report unavailable real execution.
- Run `git diff --check`, task context validation and scoped diff inspection. Browser/mobile checks are not applicable to terminal-only presentation.

## Scoped checklist at planning

This is a scoped console enhancement, not a full application/audit. PASS below covers planning evidence only; implementation acceptance remains pending.

| Current IDs | State | Evidence / remaining work |
| --- | --- | --- |
| 01–04, 07, 10, 12 | PASS | Ownership classified, project policy retained, existing lifecycle reused, protected and unrelated paths excluded. |
| 05 | PASS | Main session read applicable details; implement/check each contain eight explicit policy/research entries and `task.py validate` passed. Manual loading is not automatic hook injection. |
| 11, 13, 27 | UNKNOWN | Verification selected from project profile; post-change execution awaits implementation approval. |
| 14 | N/A | Planning stage; no submit-ready or commit action. |
| 16–17, 19–21 | UNKNOWN | Lifecycle/config preserved as constraints; regressions planned, no new runtime evidence. No configuration synchronization changes intended. |
| 18 | GAP | Shell help/log styling and Python actual-fd/URL behavior differ from the reference; R1–R5 own repair and validation. |
| 30–32 | PASS | Scoped planning authorized and linked from mainline; no serial continuation inferred. |
| 33 | PASS | Current skill-local checklist loaded; limited scope and unexecuted checks identified. |

Other IDs (06, 08–09, 15, 22–26, 28–29, 34) are unexamined outside this enhancement. No initialization, template update, toolchain setup, UI/browser integration, third-party distribution or archival action is proposed.

Planning verification: both context manifests resolve; `git diff --check` passed. Runtime code is unchanged and the task remains `planning` pending PRD review/implementation approval.

The paragraph above is the planning checkpoint. The owner subsequently approved
implementation with `开始`; actual results and current scope are recorded in
`validation.md`, including the retained unavailable checks.
