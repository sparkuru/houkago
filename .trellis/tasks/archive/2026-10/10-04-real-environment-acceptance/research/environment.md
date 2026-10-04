# Configuration A planning evidence — 2026-10-04

## Authority

The owner supplied `/home/wkyuu/cargo/try/try.txt`, configuration A: local tools,
Debian `wkyuu@192.168.9.3`, and every device returned by local `adb devices -l`.
Only the configuration A section and automation guidance apply; unrelated init,
architecture and configuration B examples are not task instructions.

## Executed discovery

- Workspace was clean before task creation, on `k-on`, HEAD `1a0764e`.
- Local tools: `/usr/bin/adb`, SSH, Node, Docker, FFmpeg and rsync exist.
- `node_modules/.bin/playwright --version`: 1.61.1.
- `docker image inspect houkago-dev:playwright --format '{{.Id}}'`: existing
  image `sha256:ff253503eaa7867413ebf8948c2782c7678ef758e7a1d33167b24e532924428f`.
- `docker ps --filter label=houkago.repo=/home/wkyuu/cargo/repo/07-houkago
  --format '{{.Names}} {{.Ports}}'`: no running containers matching that label
  at discovery time. This does not prove chosen ports are free; recheck on start.
- Initial `adb devices -l` failed inside the sandbox: local listener operation
  not permitted. The approved out-of-sandbox retry passed and returned exactly
  `192.168.9.9:41207 device product:PLR110 model:PLR110 device:OP6117L1`.
- Device read-only properties: Android 16, SDK 36, screen 1272×2800, device curl
  and su present. No privileged device action was run.
- Browser discovery returned Tor Browser, Android WebView, Firefox and HeyTap
  browser. HTTP VIEW resolves to `mark.via.gp/mark.via.Trampoline` (Via).
  No `com.android.chrome`/`org.chromium` package was returned. Exact browser
  version, viewport and debug transport still need execution-time inspection.
- Normal SSH failed locally on permissions of
  `/etc/ssh/ssh_config.d/20-systemd-ssh-proxy.conf`. Readable user config exists;
  selected fallback is `-F "$HOME/.ssh/config"` for all subsequent SSH/transfers.
  A sandbox retry then failed at socket creation. The approved network-context
  key-only connection to `wkyuu@192.168.9.3` succeeded.
- A direct `-F /dev/null` remote tool probe also succeeded; it omitted user/system
  config and must not replace the selected user-config fallback in execution.
- Remote tools: Docker, Node, ADB, curl and Python are present; no Bun, Chromium
  or Google Chrome was returned by the targeted command lookup. Inspecting the
  exact development image did not return an image ID. Do not assume a prepared
  remote browser/runtime. Node is v20.20.2; Python 3.11.2; curl 7.88.1.
- Root `.env` exists. Value-withheld line checks found nonempty Baidu client ID
  and secret literals. This is not parsed credential validation, a successful
  OAuth authorization or evidence of an available test-account video.

All successful SSH/ADB/Docker discovery was read-only. No application runtime,
device UI interaction, remote upload, media download or acceptance test ran.

## Reuse and coverage gaps

- `packages/kyoushitsu-react/e2e/real-cookie.spec.ts` already exercises two
  cookie-isolated clients with real Housou HTTP/WS, but media preview is routed
  in the shared-room case and additional error responses are synthetic.
- `media-room.spec.ts` intercepts `media.example.test` and serves MP4/HLS/DASH
  bytes using `page.route`. Reuse its assets and state assertions, but the new
  acceptance path must actually fetch bytes over HTTP without interception.
- `baidu-room.spec.ts` supplies adapter/API fixtures. The adapter-owned installed
  Chromium test loads a real extension but uses controlled provider/control
  servers. These are regression evidence, not live Baidu acceptance.
- `scripts/dev-react-preview.sh` clears provider inputs and forces
  `VITE_HOUSOU_URL=http://127.0.0.1:<port>`. It is suitable for host-local
  regression, not an unchanged Android LAN target.
- Normal `preview.sh` derives browser API host when no explicit URL is set and
  supports isolated configured ports. Use it from a temporary source copy with
  memory-backed data and no copied root `.env` for LAN acceptance.
- Archived M6 evidence establishes the baseline; prior real Baidu acceptance
  in `archive/2026-08/08-08-chromium-baidu-adaptor/validation.md` is historical,
  on Windows/private accounts. Do not reuse it as new React/device evidence.

## Deferred execution preconditions

Recheck device transport, browser version, free ports and listeners. Establish
actual Android-to-preview and preview/backend-to-media reachability. Probe
existing browser debug support before choosing CDP; if unavailable, use ADB
UI hierarchy/touch/input and device screenshots. No browser/debug package
installation, device setting change or persistent remote setup is assumed.
