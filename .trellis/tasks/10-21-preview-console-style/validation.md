# Preview console style validation — 2026-10-21

## Delivered scope

The owner approved implementation with `开始`. `preview.sh` retains its original
forwarding entry; `dx` now provides sectioned help, semantic ANSI roles and
`[log]`/`[warn]`/`[error]` diagnostics. The Python renderer styles success and
section headings, leaves URLs/data plain and chooses color from the actual
destination stream. Both implementations honor nonempty `NO_COLOR` and
`TERM=dumb`. Existing Docker/configuration/discovery/readiness and diagnostic
redaction behavior remains in place. The project console spec records these
rules; no skill assets were copied or runtime dependency added.

## Results

| Check | Result and boundary |
| --- | --- |
| Baseline regression | The new stdout TTY regression failed on the old renderer before repair; this established the color-selection defect. The initial script invocation also ran existing fixtures because this runner does not accept unittest class filters. |
| `python3 scripts/test-preview.py` | PASS: 31 tests in 70.341 seconds, including two new console cases and existing configuration, address discovery, preparation, readiness, failure diagnostics/redaction, reuse and cleanup fixtures. Docker is stubbed; loopback HTTP servers are real. |
| Final focused `ConsoleTests` via unittest loader | PASS: 3 tests after adding the help isolation case. Covers all four stdout/stderr TTY pairs, success/section/error roles, plain URL lines, both opt-outs and help from another directory with no `.env`, Python or Docker available. The other 29 suite cases required no source changes afterward. |
| `bash scripts/test-react-preview.sh` | PASS: 93 shell behavior checks; fake Docker/Bun, publication, credential isolation, exit/signal propagation and cleanup. |
| `/tmp/houkago-console-pty-check.py` | PASS: 6 real PTY help combinations, independently placing stdout or stderr on the terminal under normal, NO_COLOR and TERM=dumb settings. Header/section/option ANSI values and empty stdout verified. |
| `bash -n dx preview.sh scripts/preview-services.sh` | PASS. |
| ShellCheck / shfmt | Not installed on the host; not run. Existing tab indentation and shell structure reviewed directly. No tools installed for this task. |
| Task contexts | PASS: implement/check each resolve all eight explicit policy/research entries with `task.py validate`. Main session read the relevant files directly. |
| `git diff --check` | PASS; final scoped diff reviewed. No staged paths or commits. |

## Real Docker smoke

`python3 /tmp/houkago-console-smoke.py` passed using the existing
`houkago-dev:playwright` image and copied installed dependencies, a temporary
tracked-source copy, secret-free configuration, dynamic loopback host ports and
a fresh persistent SQLite path. It performed no image build or dependency
installation and does not claim cold-start preparation coverage.

- Both owned services reached readiness; the summary's backend `/health` and
  frontend root each returned HTTP 200 at ports 32798 and 32799.
- Start, repeated healthy start and ready status produced identical summaries;
  successful output contained no routine stderr noise.
- Stop and repeated down preserved the generated SQLite database. An exact
  repo/scope label query confirmed no fixture containers remain.
- The user's repository configuration, databases and running preview were not
  used for this check. No real provider credentials were injected.
- Artifact directory: `/tmp/houkago-console-smoke-f02lz6yr/` contains stdout,
  stderr, isolated source and retained temporary database. Printed ports are
  historical evidence; services are stopped.

This smoke checks host-loopback HTTP, not LAN devices, HTTPS, provider acceptance
or browser product behavior. Browser/mobile/UUPM work is outside this terminal
presentation task.

## Acceptance and scoped checklist reconciliation

A1–A3 and A5 pass via output fixtures, real PTYs, help isolation and scoped
diff review. A4 passes the runnable syntax/behavior/container checks; optional
ShellCheck/shfmt execution remains unavailable as recorded above.

For the current skill checklist recorded in `research.md`: 01–05, 07, 10–13,
18, 27 and 30–33 pass within this scoped enhancement. IDs 16–17, 19–21 retain
the existing lifecycle/network/config constraints with fixture regression and
loopback smoke evidence; cross-device and exhaustive cold-start validation
remain unverified and are not claimed. ID 14 is `human-optional`: console
styling preference can be reviewed with `./preview.sh --help`; automation has
covered the objective behavior. Other IDs remain outside the examined scope.

No protected Trellis runtime, personal settings, README, `.env`, dependency
manifest/lockfile or unrelated UI changes were modified. No new third-party
material or notices were added. The owner subsequently approved commit/archive
and normal closure with `归档、提交`. No push or deployment is authorized.

## Closure authorization

Pre-commit review confirmed the scoped runtime diff matches the validated
implementation; syntax and diff checks passed again. No implementation changed,
so the successful behavior/container checks above were not repeated. Both task
contexts now include commit policy explicitly (nine entries each), and resolve.
The index was empty before staging; unrelated dirty files are excluded and
snapshotted for a final preservation check.

Use one implementation commit, then the supported
`task.py archive 10-21-preview-console-style --no-commit --skip-branch-validation`
route and one explicit archive commit with the exact Codex trailer. This task
was completed directly on `k-on` and has no PR branch, matching that option's
documented purpose. Record the developer journal separately without repeating
task-level attribution.
