# M4 validation

Checked on 2026-09-28 after implementation and an independent Trellis check.
The check fixed same-account epoch stale-room rendering, typed WS command
construction, pending-reply correlation, and cancellation of HTTP commands
after disconnect, admission loss, reconnect or disposal. It also removed an
external network dependency from the browser preview fixture.

## Acceptance

| Criterion | Evidence | Result |
| --- | --- | --- |
| A1: one room session and lifecycle | `room-runtime.test.ts`: start once, pre-admission gating, reconnect, room/identity replacement, revocation, idempotent disposal and late-response fencing | Pass |
| A2: realtime authority and commands | Delayed HTTP queue loses to newer `BANGUMI`; current item follows WS; matching permission/admission/decision replies clear pending; failed HTTP command leaves live queue unchanged | Pass |
| A3: two clients | Real-cookie Playwright host and guest: approval, admission, chat, guest denial/HTTP 403, React queue add and `BANGUMI`, current selection, member removal and revocation | Pass |
| A4: direct React room and media boundary | Entry and room Playwright on desktop and 375px; no Vue handoff; visible playback-unavailable notice; phone room screenshot checked for contrast and horizontal overflow | Pass |
| A5: integration gates | Root typecheck/lint/tests, React build, contract drift, shell harness, browser tests and module graph boundary checks below | Pass |
| A6: scope | No backend, protocol, DB, provider or player implementation changed; M5 media remains deferred | Pass |
| A7: local entry | `dev.sh` starts `dev:react` on 5173; isolated runner starts Housou + React and tears down owned processes | Pass with port note below |

## Commands and results

The independent check ran:

```sh
./dx bun run typecheck                              # 7 packages passed
./dx bun run lint                                   # 300 files passed
./dx bun run test                                   # 471 passed, 0 failed
./dx bun run contract:drift                         # 18 generated files byte-stable
./dx bun run --filter houkago-kyoushitsu-react build # 453 modules; passed
./dx bash scripts/test-react-preview.sh            # 93 checks passed
bash -n dev.sh scripts/dev-react-preview.sh scripts/test-react-preview.sh
shellcheck dev.sh scripts/dev-react-preview.sh scripts/test-react-preview.sh
shfmt -i 2 -d dev.sh
shfmt -d scripts/dev-react-preview.sh scripts/test-react-preview.sh
git diff --check
```

Shell syntax, ShellCheck, shfmt and diff checks passed. The React build emitted
`packages/kyoushitsu-react/dist/module-graph.json`; a search for Vue, Pinia,
Eden, ArtPlayer, HLS, DASH and Housou server sources returned no matches.

For browser checks, default 3000/5173 were already occupied by unrelated
processes in this environment. The check used a task-owned isolated memory
preview and stopped it after tests:

```sh
DX_EXTRA_PORTS=3187,5187 ./dx bash scripts/dev-react-preview.sh --backend-port 3187 --frontend-port 5187
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5187 PLAYWRIGHT_HOUSOU_URL=http://127.0.0.1:3187 bunx playwright test --config packages/kyoushitsu-react/playwright.config.ts --reporter=line
```

Playwright passed 28/28 cases across desktop and 375px projects. Host Chromium
hit SIGTRAP under the filesystem sandbox, so the browser command was rerun
with sandbox escalation using the bundled Chromium. The default fixed-port
`dev.sh` was not smoke-tested while those unrelated ports were occupied;
its startup command, the equivalent isolated two-service runner and the fake
Docker/Bun shell harness were verified.

The browser test fixes the successful preview HTTP response with a Playwright
route fixture: Housou's actual public URL preview issues an external Range GET.
The subsequent add mutation, live `BANGUMI`, cookie sessions, WebSocket traffic,
approval, permission denial and revocation use real Housou. Fake-transport
adapter tests cover preview request shape, credentials, abort and typed errors.

M4 deliberately renders a current item without video playback; M5 owns media.
