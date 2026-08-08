# houkago-adapter

`houkago-adapter` is Houkago's versioned desktop capability client. Firefox is
the reference implementation for Baidu user-held credentials, read-only file
access, and source-scoped media request headers.

> [!WARNING]
> Default builds are development-only and intentionally inject into every HTTP
> and HTTPS page while retaining permission to contact every HTTP/HTTPS server.
> This supports LAN IP and hostname testing, but exposes adapter detection and
> protocol surfaces to every visited website. Any page can attempt to re-pair
> the adapter to a server it controls, which clears the previous local Baidu
> authority. Use only in a trusted development browser profile, avoid unrelated
> browsing while it is loaded, and remove it after testing. Never distribute or
> deploy the default build.

A production/deployment build must inject separate, exact page and server
origins at build time:

```sh
HOUKAGO_ADAPTER_ORIGIN=https://watch.houkago.example \
HOUKAGO_ADAPTER_SERVER_ORIGIN=https://api.houkago.example \
bun run build:firefox
```

Both variables must be provided together. Origins must be HTTPS, except for
explicit loopback deployment origins. The production build removes the
development HTTP/HTTPS wildcard permissions and enforces the configured page
and server origins at runtime before every protocol message, including
`HELLO`. The page cannot choose another server at runtime.

## Baidu deployment configuration

Copy the repository `.env.example` to an ignored `.env` and fill the Baidu Open
Platform application values. The registered callback must exactly match
`HOUKAGO_BAIDU_REDIRECT_URI`, including its scheme, host, port, and path, and it
must be reachable from the browser completing OAuth. A loopback host such as
`localhost` or `127.0.0.1` refers to that browser's machine; it reaches a remote
Housou instance only when an explicit OS, IDE, or SSH port forward maps the same
callback port. For LAN testing, register the exact browser-reachable LAN callback
URL and configure Housou with that same value instead of rewriting the callback
host in the popup. Production deployments should use a stable public HTTPS
callback origin that supported clients can reach. The OAuth callback URI is
separate from the adapter page and server origins, but every configured origin
must describe the real deployment. Generate the optional server-saved encryption
key with `openssl rand -base64 32`; this key is deployment-only and must not be
put in the extension or frontend bundle.

If the OAuth variables are incomplete, Baidu integration is disabled without
affecting ordinary Houkago sources. If only the credential key is absent,
user-held mode remains available while server-saved mode is disabled.

Start Houkago from the repository root with `./dev.sh` or the equivalent
`./dx sh -c 'bun run dev:housou & bun run dev:kyoushitsu & wait'`. The Housou
development and `bun run start:housou` scripts explicitly load the ignored
repository-root `.env`; the frontend workspace does not receive the deployment
credentials.

## Local extension build

From the repository root:

```sh
./dx sh -c 'cd packages/houkago-adapter && bun run build:firefox'
./dx sh -c 'cd packages/houkago-adapter && bun run build:chromium'
```

Load `packages/houkago-adapter/dist/firefox/manifest.json` as a temporary
Firefox add-on, or load `packages/houkago-adapter/dist/chromium` as an unpacked
Chromium extension. With no origin variables, these development builds accept
all HTTP/HTTPS page and server origins for LAN testing. Use a separate trusted
browser profile and remove the extension after testing.

Firefox and Chromium share pairing, user-held credentials, file browsing,
permits, refresh, and pending-dlink coordination. Their only implementation
difference is the network port: Firefox uses blocking WebRequest while Chromium
uses expiring session DNR rules. Chromium 120 or newer is required because its
30-second alarm interval is the durable wake-up path for pending requests and
rule cleanup. Active media grants are recorded in trusted `storage.session` and
reconciled with live DNR session rules on worker startup and every polling
alarm. In-memory timers only request prompt cleanup; they are not grant
authority. On an exact active Baidu media grant, both browsers set the provider
UA, preserve Range, and remove the Houkago page Referer; unrelated requests are
unchanged.

## Installed Chromium smoke

Chromium validation must use a separate trusted browser profile with no
unrelated browsing.

### Controlled unpacked-extension target

The repository's existing Playwright runner can load the real unpacked
extension in a temporary persistent profile and exercise a synthetic grant
without real credentials:

```sh
./dx sh -c 'cd packages/houkago-adapter && bun run build:chromium'
node_modules/.bin/playwright test \
  --config packages/kyoushitsu/playwright.chromium-adapter.config.ts \
  --project chromium-adapter-installed
```

The target defaults to Playwright's installed Chrome for Testing/Chromium
executable. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome` to select a
compatible executable, and set `PLAYWRIGHT_HEADED=1` to use a visible browser
instead of headless mode. It creates its profile, certificate, loopback
control/media servers, and HTTPS CONNECT proxy under the system temporary
directory and removes them in `finally`.

This target fails if the extension or service worker is absent. It proves the
real content-script handshake and pairing, transactional DNR grant install,
approved-host redirect, provider UA, Referer removal, Range preservation, 206
response, exact-tab isolation, revoke cleanup, and ordinary-request
non-interference. Its assertions retain only method, header-presence facts,
Range, status, isolation, and cleanup outcomes.

Branded Google Chrome 137 and newer disable command-line `--load-extension`.
Google Chrome 150 in the current validation environment therefore starts but
loads no extension service worker under this automation. The controlled target
uses Chrome for Testing/Chromium; it does not replace the manual unpacked
Google Chrome or Edge gates below.

### Manual real-account matrix

Build `dist/chromium` immediately before testing, then use this reload order:

1. Open `chrome://extensions` in Google Chrome, or `edge://extensions` in
   Microsoft Edge, and enable developer mode.
2. Choose **Load unpacked** and select the complete
   `packages/houkago-adapter/dist/chromium` directory. Do not select an
   individual file.
3. Open the extension's service-worker inspection link and confirm startup has
   no rule-reconciliation error. Close that inspector before lifecycle tests;
   an attached inspector can keep the worker alive.
4. Reload the extension first, then hard-reload the Houkago page. Complete
   pairing and approve the exact server-origin request when prompted.
5. After every rebuild, repeat extension reload, page reload, and pairing in
   that order. If detection remains stale, remove and load the unpacked
   directory again before re-pairing.

Run the full matrix in Google Chrome first: server-saved sustained playback and
seek, user-held owner resolution plus playback by the owner and a separate
admitted viewer, owner offline/reconnect, viewer eviction, source removal,
revoke/reauthorization, exact-tab isolation, and ordinary-source
non-interference. To exercise suspension, close the service-worker inspector,
leave the worker idle for more than 30 seconds, then trigger a pending request
or media-grant action and confirm the worker wakes and completes or safely
terminates the request within the server deadline. Repeat install/pairing,
server-saved playback/seek, user-held resolution/playback, and ordinary-source
non-interference in current Microsoft Edge using the exact same built
directory. Any Edge-specific code or manifest change requires rerunning the
Chrome matrix.

When inspecting requests, record only browser/version, method, approved-host
classification, whether the provider UA is present, whether Referer is absent,
whether Range is present, response status, tab-isolation result, and cleanup
outcome. Do not save or commit HAR files, OAuth tokens, cookies, dlinks, file
ids or paths, pairing values, extension storage dumps, or deployment secrets.
After the smoke, remove the unpacked extension and delete the dedicated test
profile according to the browser's normal profile-removal flow.

Google Chrome is the full installed Chromium reference, and Microsoft Edge is
the compatibility target. The current redacted validation record covers Google
Chrome 150 and Microsoft Edge 151 with the matrix above, in addition to the
controlled Chrome for Testing 149 harness. Chromium 120 remains the declared
minimum because the lifecycle implementation depends on its 30-second alarm
support. This evidence does not claim compatibility outside those tested
versions or publication through either browser's extension store. The completed
Firefox and Chromium evidence is recorded in the Baidu adaptor tasks'
`validation.md` files.
