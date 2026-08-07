# Userscript capability boundary

Researched 2026-08-07 from official browser and Tampermonkey documentation.
This file preserves a rejected-alternative analysis; it does not add a
userscript client, fallback, installation option, or future product item.

## Findings

### What a userscript can do

- Modify the Houkago page, add controls, observe page events, and exchange
  deliberately exposed page messages.
- Persist script-owned values through `GM_setValue` / `GM_getValue`.
- Make explicit cross-origin requests through `GM_xmlhttpRequest` when declared
  with `@connect`.
- Set request headers including `user-agent` on those script-owned requests,
  subject to browser/platform exceptions. Tampermonkey says some special
  headers are not supported by Safari and Android browsers.
- Start an OAuth navigation and assist with page-level setup UX.

### Why it cannot implement Baidu playback reliably

- Setting `user-agent` on `GM_xmlhttpRequest` does not rewrite requests created
  later by a `<video>` element or ArtPlayer after receiving a dlink.
- Tampermonkey's experimental `GM_webRequest` offers cancel/redirect actions,
  not arbitrary request-header changes. Its documented request types are
  `sub_frame`, `script`, `xhr`, and `websocket`, not `media`.
- `GM_webRequest` and `@webRequest` are unavailable in Tampermonkey 5.2+
  Manifest V3 releases on Chrome and derivatives.
- Replacing native media loading with `GM_xmlhttpRequest` would require the
  script to own Range scheduling, buffering, cancellation, seeking, container
  parsing/remuxing, and Media Source behavior. That is a different streaming
  client and not a safe fallback for arbitrary selected videos.
- A userscript runs through a third-party manager and its API/support matrix;
  it cannot provide the owned, versioned permission and update contract of
  `houkago-adapter`.

### Why a WebExtension fits

- Firefox WebExtensions can modify request headers in
  `webRequest.onBeforeSendHeaders` with blocking and host permissions; MDN's
  official example rewrites `User-Agent`.
- Chromium Manifest V3 extensions can use declarative network request rules to
  redirect requests and modify request headers. Session rules can be installed
  and removed dynamically.
- Extension background code can receive narrow messages from a content script
  and use privileged APIs which page or user-script worlds cannot directly use.

## Recorded decision

Use an owned WebExtension named `houkago-adapter` for privileged capabilities.
Model Baidu UA injection as its first network capability, not as the extension's
identity. Do not ship or advertise a userscript client, fallback, or optional
installation path.

## Sources

- Tampermonkey `GM_xmlhttpRequest`:
  https://www.tampermonkey.net/documentation.php?locale=en&q=GM_xmlhttpRequest
- Tampermonkey `GM_webRequest`:
  https://www.tampermonkey.net/documentation.php?locale=en&q=GM_webRequest
- Tampermonkey `@webRequest`:
  https://www.tampermonkey.net/documentation.php?locale=en&q=webRequest
- Tampermonkey browser compatibility overview:
  https://www.tampermonkey.net/index.php?browser=firefox&locale=en
- MDN `webRequest.onBeforeSendHeaders`:
  https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onBeforeSendHeaders
- MDN WebExtension content scripts and privileged background messaging:
  https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts
- Chrome `declarativeNetRequest`:
  https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest
