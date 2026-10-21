# Implementation plan

Status: implementation authorized with `可以；开始实施`; checks in `validation.md`.

## Sequence

1. Load applicable package contracts and `trellis-before-dev`. Record baseline
   dirty files; preserve unrelated room UI edits and the owner's preview.
2. Add the backend `/api` mount and test route/error behavior; settle generated
   SDK prefix ownership and regenerate with the existing contract pipeline.
3. Update shared HTTP/provider base resolution and WS joining. Audit returned
   media/source/grant/sentinel/callback URLs and add focused behavior coverage.
4. Update extension base validation, requests and grant parsing; preserve
   negative origin/path tests and explicit re-pair behavior.
5. Add owned Docker networking, Vite proxy target and WS upgrades; remove
   backend host publication. Update readiness/status/summary/configuration,
   safe examples and isolated browser fixture together. Preserve lifecycle,
   current `.env` contents and private-data injection boundaries.
6. Run focused checks, then broad relevant checks on the final source. Finish
   contract generation before browser runs to avoid watcher reloads.
7. Record actual evidence/limits, update affected project contracts, review
   final diff and present the result. Commit/archive require later authority.

## Checks

- Focused backend API/auth/WS/media tests, client base/path tests and extension
  runtime/security tests through `./dx bun test <affected test paths>`.
- `bash -n dx preview.sh scripts/preview-services.sh scripts/dev-react-preview.sh`;
  ShellCheck/shfmt when available, with unavailability reported.
- `python3 scripts/test-preview.py` and `bash scripts/test-react-preview.sh`.
- `./dx bun run contract:drift`, `./dx bun run lint`,
  `./dx bun run typecheck`, `./dx bun run test`,
  `./dx bun run --filter houkago-kyoushitsu-react build`.
- Isolated real Docker lifecycle with two free configurable port pairs and
  dynamic host publication; inspect absent backend mapping, internal health,
  public `/api/health`, proxy failure, reuse and persistence. Use temporary
  configuration/source copies and fresh SQLite plus memory fixtures.
- Existing React entry/real-cookie/media/room/danmaku/Baidu desktop and phone
  suites against the unified site entry. Update test fixture endpoints to
  `/api`; record mocks versus actual HTTP/WS and external-provider boundaries.
- Build Chromium adapter and run its installed-extension acceptance against
  the same path-bearing entry; retain auth denial and cleanup assertions.

## Review and rollback points

- Highest-risk surfaces: generated route prefix duplication, WS pathname
  replacement, response-created media URLs, extension origin/base confusion,
  proxy streaming and readiness accepting SPA HTML as an API success.
- Preserve the original eight dirty paths and untracked room-controls child;
  any required room-controls test edits must retain their existing changes.
- No persistent data conversion is planned. Never reset a database to resolve
  startup failures. Never stop unrelated containers or remove shared networks.
- Owner plan review and `task.py start` are complete. Commit/archive have not
  been requested; retain the in-progress task for review and later closure.
