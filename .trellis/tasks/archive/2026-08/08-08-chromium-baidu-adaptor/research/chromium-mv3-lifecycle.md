# Chromium MV3 lifecycle and Edge compatibility research

Researched 2026-08-08 from primary browser-vendor documentation.

## Confirmed platform behavior

- Manifest V3 replaces persistent background pages with extension service
  workers that run only when needed. Chrome normally terminates an idle worker
  after about 30 seconds, and explicitly advises persisting state instead of
  relying on globals or ordinary timers.
- Chrome's alarm API is the supported way to wake an extension worker. Chrome
  120 reduced the minimum production alarm interval to 30 seconds, but alarm
  delivery may be delayed; unpacked development extensions can behave more
  permissively and therefore cannot prove production timing by themselves.
- DNR session rules are managed at runtime, survive extension service-worker
  termination, and are cleared when the browser shuts down or a new extension
  version is installed. `getSessionRules()` can enumerate the live rules.
- `chrome.storage.session` survives service-worker termination while the
  extension remains loaded, is cleared on disable/reload/update/browser
  restart, and is not exposed to content scripts by default. It is suitable for
  a minimal trusted-context grant registry, subject to prompt expiry cleanup.
- Microsoft documents Chrome extension APIs and manifest keys as generally
  code-compatible with Edge, but still requires sideloaded testing and checking
  the Edge API support list. Edge MV3 retains observational WebRequest behavior
  while request modification belongs to DNR.

## Design consequence

The current Chromium grant port cannot treat its in-memory map and `setTimeout`
as authoritative. The installed-browser task must reconcile DNR rules with a
minimal session registry on every worker start/wake, use alarms for recovery
and cleanup, and prove cleanup after suspend/restart. Sensitive URLs must stay
inside extension-trusted storage and be removed with the corresponding rule.

The task targets Chromium 120 or newer because its existing 30-second pending
poll cadence depends on the documented Chrome 120 alarm granularity.

## Sources

- Chrome: [Extension service-worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- Chrome: [`chrome.alarms`](https://developer.chrome.com/docs/extensions/reference/api/alarms)
- Chrome: [`chrome.declarativeNetRequest`](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)
- Chrome: [`chrome.storage`](https://developer.chrome.com/docs/extensions/reference/api/storage)
- Microsoft: [Port a Chrome extension to Microsoft Edge](https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/developer-guide/port-chrome-extension)
- Microsoft: [Manifest V3 migration](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/migrate-your-extension-from-manifest-v2-to-v3)
- Microsoft: [Supported Edge extension APIs](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/api-support)
