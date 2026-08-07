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
`HOUKAGO_BAIDU_REDIRECT_URI`. Generate the optional server-saved encryption key
with `openssl rand -base64 32`; this key is deployment-only and must not be put
in the extension or frontend bundle.

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
uses expiring session DNR rules. On an exact active Baidu media grant, both set
the provider UA, preserve Range, and remove the Houkago page Referer; unrelated
requests are unchanged. Firefox is the installed, real-account reference path.
Chromium currently has shared contract tests, manifest checks, and successful
builds, but installed Chromium production support is deliberately not claimed;
its real-browser smoke and hardening are tracked as a separate follow-up. The
completed Firefox evidence and exact Chromium boundary are recorded in the
Baidu adaptor task's `validation.md`.
