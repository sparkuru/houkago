# Development and Environment Profile

## Runtime and checks

Reuse root `./dx`; do not generate a competing `hako`. It runs the project-local
`houkago-dev:playwright` image, built from `Dockerfile.dev` on top of
`oven/bun:1`, at `/app`, maps the caller's uid/gid and uses ignored `.devhome/`.
The image includes the system libraries required by Playwright's Chromium.
Docker and an accessible daemon remain prerequisites. Override the image with
`DX_IMAGE=...`; force a rebuild after Dockerfile changes with
`DX_REBUILD_IMAGE=1 ./dx <command>`.

Run from the repository root:

```sh
./dx bun install
./dx bun run lint
./dx bun run typecheck
./dx bun run test
./dx bun run contract:drift
./dx bun run --filter houkago-kyoushitsu-react build
```

Use `./dx bun test packages/kyoushitsu-react/test` for focused unit verification.
`./dx bun run format` writes across the repository: use it only within an
authorized formatting scope. Browser execution uses the host/project-local
mode in [validation.md](validation.md).

## Service and preview lifecycle

### Current implementation

Root `preview.sh` forwards all commands to `dx preview`. `dx` owns the Docker
arguments and lifecycle; `scripts/preview-services.sh` supervises each service
inside its own detached `--init` container. `dev.sh` is deleted in the working
tree; do not restore it or document it as an available entry. Commands below
are implemented, including `--origin` for start and `--help`.

Ownership uses exact `houkago.repo` (resolved repository path),
`houkago.scope=preview` and `houkago.service` labels. Repository-derived names
prevent concurrent starts from creating duplicate services. A configuration
fingerprint prevents silently reusing instances with changed settings; stop
then start after such changes. Stop/status inspect existing labeled containers
without loading the current `.env`, so deletion or invalid edits to that file
do not prevent teardown. Stop removes only owned containers and preserves
bind-mounted databases/caches; there are no disposable data volumes to remove.

`package.json`'s `config.ports` supplies absent-key defaults (currently backend
9998, frontend 9999); `.env` controls actual listeners/publications. Normal
preview fails on busy required ports; ordinary `dx` verification retains its
existing skip-busy behavior for optional publications. Container listeners
must use `0.0.0.0` or `::` for Docker publishing; restrict host access using
`DX_BIND_HOST=127.0.0.1` or `::1`. This entry supports host-published preview;
a Docker-network-only runtime requires explicit implementation before use.

Host ports may differ from container ports, including `0` for Docker-assigned
host ports. Start inspects the backend mapping before creating React and passes
that effective port as `VITE_HOUSOU_PORT`. React normally uses the browser
hostname for API access; an explicit `VITE_HOUSOU_URL` takes precedence.

Default manual probes after starting the owned preview (use the printed
effective ports when configuration changes or host ports are dynamic):

```sh
curl --fail --silent --show-error http://127.0.0.1:9998/health
curl --fail --silent --show-error http://127.0.0.1:9999/ -o /dev/null
```

Start/status verify both the owned container's HTTP listener and its actual
published host endpoint. Responses from a pre-existing listener are not
readiness evidence for this preview. Stop with `./preview.sh stop` after
validation unless the user requested a running preview.

### Required preview command contract

Apply when creating/adapting the preview entry, its lifecycle or configuration.
Keep one Docker-backed service implementation for Housou and React; reuse `dx`
and any established lifecycle rather than adding a competing wrapper. Keep the
root executable `preview.sh` a convenience entry when forwarding becomes
possible. Resolve the repository from the script location, including `.env`,
mounts and configuration, so all commands work from another working directory.
Do not silently fall back to host execution or change Vite's separate
production-preview semantics.

| Command | Required behavior |
| --- | --- |
| `./preview.sh` / `./preview.sh start` | Start both development services in the background, wait for readiness, print the summary and return control; reuse a healthy owned instance without duplicates |
| `./preview.sh stop` / `./preview.sh down` | Stop only this repository's owned preview services; succeed when already stopped; preserve database files, caches and persistent volumes |
| `./preview.sh status` | Inspect actual owned service state and health without starting/building anything; distinguish stopped, starting, ready and unhealthy |
| `./preview.sh build` | Explicitly build the configured development image through the same runtime; do not start services |
| `./preview.sh --help` | Explain setup, build/start/status/stop, configuration and data-preserving teardown without starting services |

Ordinary `start` reuses prepared images and installed dependencies. If either
is missing, fail with the actual setup/build command; do not install, build or
run tests implicitly on every start. `dx` currently builds a missing image;
preview startup must check prerequisites before reaching that behavior.
Keep general verification commands usable alongside the preview.

Use deterministic repository-scoped ownership (for example exact container
labels); inspect it before reuse or teardown. Never kill by port/process name
or stop unknown containers. Busy required host ports must fail startup rather
than silently omitting a mapping. Bound readiness waits, detect early service
exit, propagate failures and signals, and clean up only resources created by
the failed attempt. Preserve existing healthy services and persistent data.

After environment/dependency setup, the required first-use sequence is:

```sh
./preview.sh build
./preview.sh start
./preview.sh status
./preview.sh stop  # or down; preserves persistent data
```

Rebuild when `Dockerfile.dev` or image inputs change; restart for
runtime `.env` changes. Keep setup commands in this spec and script help;
README edits require an explicit request.

### Required readiness and access summary

Probe Housou's `/health` and React's `/` using effective configured/published
endpoints and verify they belong to the owned runtime. Emit `System is ready.`
only after both pass; otherwise return nonzero with the failing service,
actionable diagnostics and no success banner. Readiness does not establish
room/media feature acceptance or OAuth availability.

Print every active preview listener, labeled `housou` or `kyoushitsu-react`,
including the container host:port/protocol and internal-only designation when
applicable. Separately print Docker's effective host-to-container mappings;
inspect actual mappings, including dynamically allocated ports. A mapping is
not proof of an active listener: label an absent or unverified listener and
do not advertise it as a working website.

Print directly openable `Website` and `API` HTTP URLs through the actual host
entry points, including localhost when reachable. `0.0.0.0` and `[::]` belong
only in listener/mapping lines. Include admin/docs URLs only after verifying
the real application routes; never assume example paths or protocols.

Trusted-LAN development normally uses all-interface service and host binds;
honor any explicit loopback/network-only constraint and do not change firewall
rules or expose additional ports. LAN URLs need explicit configuration or
relevant host-network evidence, not an arbitrary first interface, Docker
bridge or VPN address. Label an untested address as a candidate; when none is
known, tell the user to use their reachable host address. Do not claim physical
device access from localhost probes. For Docker-network-only operation, show
internal endpoints and the verified Docker network probe command without
publishing ports. Never include credentials or tokens in output/URLs.

### Preview verification requirements

Validate changed shell scripts with `bash -n`, ShellCheck and the project's
shell formatting convention. Exercise the command contract using free test
ports and a temporary `.env` fixture, preserving the user's configuration and
existing services. Verify:

- `build` and `status` do not start services; ordinary `start` does not build,
  install or run tests; help and invocation from another directory work.
- Both services reach readiness; the summary lists all listeners/mappings;
  printed localhost browser URLs actually respond.
- Repeated start reuses ownership; stop/down and repeated stop affect only the
  owned instance and retain a persistence marker/database and unrelated service.
- Missing image/dependency/config, conflicting ports, early service exit and
  readiness timeout fail actionably without the success banner.
- Changing listening/published hosts and ports in the fixture changes the
  actual runtime, React's API connection and reported endpoints consistently.
- Existing custom/empty local values survive configuration updates; rerunning
  missing-key synchronization does not duplicate entries.

Run the focused lifecycle/configuration regression suite and the existing
isolated fixture checks:

```sh
python3 scripts/test-preview.py
bash scripts/test-react-preview.sh
```

The Python suite uses temporary repositories, a stateful Docker stub and real
loopback HTTP probes; execution needs permission to bind local test sockets.
It does not start real containers. Use an isolated source/configuration copy
and disposable test data for real Docker smoke checks; never launch the user's
provider credentials merely to verify the preview lifecycle.

Report stub lifecycle checks, syntax/lint/format checks and real Docker checks
separately. Record unavailable Docker/network/browser execution explicitly;
localhost success does not verify LAN devices or HTTPS/domain access. Keep a
preview running only when requested. A documentation-only policy update needs
link/context/evidence/diff checks, not product tests or service startup.

### Isolated browser fixture

For browser tests needing disposable data and no private configuration, reuse:

```sh
DX_EXTRA_PORTS=3000,5173 ./dx bash scripts/dev-react-preview.sh
```

This starts memory-backed Housou and React, clears provider/credential inputs,
disables Bun/Vite env-file loading and sets the frontend API URL to loopback.
It is a host-local browser fixture, not the LAN preview. Its default ports
3000/5173 differ from the normal preview's configured ports; pass
`DX_EXTRA_PORTS` explicitly so `dx` publishes the fixture listeners. Free-port overrides:

```sh
DX_EXTRA_PORTS=3100,5174 ./dx bash scripts/dev-react-preview.sh --backend-port 3100 --frontend-port 5174
```

Set corresponding Playwright frontend/API variables. Ctrl-C stops owned children.
`scripts/test-react-preview.sh` checks the fixture lifecycle with stub services;
it is not a Docker smoke test. The development image build itself can be
checked with `docker build --file Dockerfile.dev --tag houkago-dev:playwright .`.

## Environment setup and changes

For normal startup, when root `.env` is absent, run `cp .env.example .env`.
Never overwrite an existing file. `scripts/preview-config.py` parses literal
dotenv values without shell execution or variable interpolation, preserves
empty entries, supports quoted values/comments, and rejects duplicate keys.
Precedence is manifest/built-in defaults, root `.env`, explicit process
environment, then `--origin`. Required empty values fail; optional empty
provider/LAN/CORS values retain their documented meaning.

The shell loader exports only declared runtime keys and the application's
`HOUKAGO_*`, `PREVIEW_*`, `VITE_*` namespaces; arbitrary dotenv names cannot
replace orchestration variables or system `HOME`/`PATH`. Backend containers
receive parsed backend values through key-only Docker `-e` arguments; Housou's
package script also uses `bun --env-file=../../.env`, with process inputs
taking precedence. Frontend containers receive only public `VITE_*` inputs and
their listener settings, and run Bun with `--no-env-file` to avoid loading
backend secrets. Vite retains package dotenv conventions, with injected public
process values taking precedence. Ordinary `dx` mounts root `.env` as before;
application commands keep their own loader behavior. Do not source dotenv
files as shell code or print private environment values.

| Key | Requirement and value source |
| --- | --- |
| `HOUKAGO_BAIDU_CLIENT_ID`, `HOUKAGO_BAIDU_CLIENT_SECRET` | Only for real OAuth; obtain from the deployment's Baidu application |
| `HOUKAGO_BAIDU_REDIRECT_URI` | Callback registered for that same application; example uses localhost |
| `HOUKAGO_CREDENTIAL_KEY` | Only for server-saved mode; separate base64-encoded 32-byte encryption key |
| `HOUKAGO_CREDENTIAL_KEY_VERSION` | Positive key version; example defaults to 1 |
| `HOUKAGO_KOMON_USERNAMES` | Optional normalized existing accounts granted site-wide access; never infer from registration order |
| `HOUSOU_DB`, `PORT` | Optional backend path/port; defaults `houkago.db` and 3000; memory preview overrides them |
| `HOUKAGO_CORS_ORIGIN` | Optional trusted frontend origin; `preview.sh --origin` supplies it; open development origins otherwise |
| `VITE_HOUSOU_URL`, `VITE_HOUSOU_PORT` | Optional frontend API base/port; URL takes precedence, otherwise use browser hostname and the preview-supplied backend port (standalone fallback 3000) |

### Required root preview configuration

Root `.env` is the primary normal-preview configuration, loaded
without inline assignments or script edits. Reuse a format-aware dotenv loader;
never source it as shell code. Keep `dx`, the lifecycle and application consumers
synchronized: Docker interpolation, container injection, Bun's env-file loader
and Vite's public inputs are separate paths. Do not inject backend secrets into
the frontend's `VITE_*` namespace.

The safe example also defines the following preview inputs:

| Key | Consumer / example |
| --- | --- |
| `DX_IMAGE` | Docker development image; `houkago-dev:playwright` |
| `DX_BIND_HOST` | Host publication address; `0.0.0.0` for trusted LAN, `127.0.0.1` for host-only use |
| `HOST`, `PORT` | Housou container listener; `0.0.0.0:9998` |
| `PREVIEW_FRONTEND_HOST`, `PREVIEW_FRONTEND_PORT` | React Vite container listener; `0.0.0.0:9999` |
| `PREVIEW_BACKEND_PORT` | Backend published host port; `9998` |
| `PREVIEW_FRONTEND_PUBLISHED_PORT` | Frontend published host port; `9999` |
| `PREVIEW_LAN_HOST` | Optional explicitly known LAN hostname/address; blank by default, device access remains unverified |
| `PREVIEW_READY_TIMEOUT` | Bounded readiness wait in seconds; `60` |
| `HOUSOU_DB` | Persistent SQLite path relative to `packages/housou`; `houkago.db` |
| `HOUKAGO_CORS_ORIGIN` | Optional exact trusted frontend origin; blank allows development origins and retains the restricted default outside development |

Preserve root `package.json`'s `config.ports` as fallback defaults for absent
port keys; root `.env` is the normal configured preview source. Update actual
consumers and `.env.example` together for new keys. Image or mount/toolchain
changes require rebuilding; listening/publishing, database and CORS changes
require stopping and starting the preview. Frontend build-time values require
a React rebuild for production artifacts.

Use blank values for secrets and explain their actual source. Basic preview
does not require real provider credentials or an invented admin account.
Missing required values must block startup/readiness with the key name and
setup action, never its secret value.

Basic local/fixture checks need no provider secrets. Empty/invalid provider
configuration makes that capability unavailable; readiness does not validate
OAuth or server-saved mode. Do not expose secrets through browser variables or
logs. Public site identity is in `config/config.toml`.

When configuration changes, update the real consumer and safe example together.
Compare local key presence without printing values. Append only missing keys
with safe placeholders, preserving comments, quoting, custom/empty values and
line endings; avoid duplicates on rerun. Report ambiguous duplicates and
renamed/removed keys instead of deleting user values. If `.env` is absent,
retain full first-setup instructions rather than creating a partial file.
List newly required values, their sources and restart/rebuild steps.

Root `.env` is ignored; `.env.example` is trackable. Local setup appends only
missing safe preview keys, never overwriting existing secrets, custom values or
empty entries. Keep local settings/permissions local; no new allow rules are
implied. Docker execution remains subject to the active sandbox/approval policy.
