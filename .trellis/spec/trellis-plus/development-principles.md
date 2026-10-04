# Development Principles

These are project-authored defaults for ongoing Houkago development. Read
`.trellis/mainline.md` and task acceptance before edits and after interruptions;
implementation drift does not change approved scope.

## Scope and compatibility

- Solve the approved requirement and evidenced near-term needs. Reuse real
  components, API clients, room-session/player boundaries and tests before
  adding abstractions, providers, caches, flags or dependencies.
- For unreleased prototypes, change callers and contracts together and remove
  superseded paths. Do not add aliases or fallback chains for discarded designs.
- Preserve established room URLs, identity/admission, HTTP/WS authority,
  permissions, provider credentials, local subtitle/preferences and Warm Club
  behavior unless the task explicitly changes them. React is the local default;
  M6 legacy-workspace removal has completed under its recorded approval.
  These are affected-surface constraints, not a general compatibility gate.
- Do not delete unknown SQLite data or credentials. Only the isolated
  `HOUSOU_DB=:memory:` preview is demonstrably disposable; normal startup uses
  persistent data. Development status alone grants no deletion authority.
- Limit the diff to the requirement. Avoid adjacent refactoring, renaming,
  mass formatting, dependency upgrades or speculative recovery. Add dependencies
  only when existing tools cannot reasonably provide the needed behavior.

## Development access and verification

Use trusted-LAN startup in [development.md](development.md) when device access
is intended. All-interface publishing is an existing dev choice; honor explicit
narrower network requirements. Keep credential/authorization tests meaningful,
use fixture accounts and preserve production auth defaults. Do not remove auth
or expose extra ports merely to reduce testing friction.

Before a bug fix, reproduce current behavior and trace the real execution path.
If reproduction is unavailable, label the proposed cause as a hypothesis.
Test promised behavior and final state; do not weaken assertions, suppress
errors or mock away the behavior under test. Controlled fixtures must state
which external behavior they do not verify. Missing required configuration and
resources must remain visible failures, not success-looking defaults.

Use proportionate existing checks; build, HTTP 200, unit passes and browser
interactions prove different scopes. Report implemented but unverified behavior.
Keep actual results in task evidence, not another audit system. Frontend/mobile
requirements follow [validation.md](validation.md).

## Workspace and documentation

Treat dirty files as user-owned. Never reset, overwrite, clean or stage unrelated
work. Keep scratch artifacts in `/tmp`; remove only known task-created disposable
files. Preserve intentional tests/evidence. README and root `design.md` remain
human-owned and change only when requested. Store reusable rules here and task
decisions in existing task artifacts; avoid redundant guides, changelogs or TODOs.
