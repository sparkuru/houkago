# Baidu OAuth and download research

## Sources

- Baidu OAuth integration guide: <https://openauth.baidu.com/doc/doc.html>
- Baidu Netdisk open platform: <https://yun.baidu.com/open/platform>
- Baidu developer file-operation example:
  <https://developer.baidu.com/question/detail.html?id=179>
- AList Baidu driver reference:
  <https://alist-repo.github.io/docs/guide/drivers/baidu.html>
- AList current Baidu driver implementation:
  <https://github.com/AlistGo/alist/blob/main/drivers/baidu_netdisk/util.go>
- Baidu's official Go SDK download implementation:
  <https://github.com/baidu-netdisk/baidu-drive-sdk-go/tree/master/baidudriver/api>
- Chrome declarativeNetRequest API:
  <https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest>

## Confirmed contracts

- Baidu's authorization-code response carries a one-use code with a documented
  ten-minute lifetime and recommends `state` for CSRF protection.
- Code exchange is documented as a server request requiring `client_id`,
  `client_secret`, the one-use code, and the exact redirect URI.
- Refresh is also documented as requiring `refresh_token`, `client_id`, and
  `client_secret`. The current guide does not document `code_challenge` or
  PKCE, so Houkago must not claim a public-client flow.
- The token response includes `access_token`, `expires_in`, `refresh_token`, and
  the granted `scope`. Refresh tokens are documented as long-lived and must be
  treated as the highest-risk user credential in this adaptor.
- Netdisk examples use REST endpoints for file listing/metadata and return a
  `dlink` when file metadata is requested with download-link output enabled.
- The official Go SDK appends the user's `access_token` to that raw dlink and
  sends the download request with `User-Agent: pan.baidu.com`. The current
  AList driver demonstrates a narrower distribution pattern: perform a private
  manual-redirect `HEAD` against the token-bearing raw dlink, then retain the
  returned `Location` as the short-lived file capability. Houkago adopts this
  pattern without using AList at runtime.
- The AList driver documentation reports that large-file download requests
  require `User-Agent: pan.baidu.com`; it recommends a proxy where a client
  cannot set that request header.
- Chrome Manifest V3 `declarativeNetRequest` can modify request headers before
  they are sent, supports session/dynamic rules, and exposes `media` as a
  resource type. Host permissions are required and must be restricted to the
  Houkago deployment plus verified Baidu download hosts.
- Firefox WebExtensions can synchronously modify `User-Agent` in
  `webRequest.onBeforeSendHeaders` with `webRequestBlocking`; Mozilla documents
  this exact pattern. Firefox is the first implementation/test target because
  it is the user's local test environment. Chromium follows through a thin
  `declarativeNetRequest` adapter around the same core grants and host policy.

## Design consequences

- One Baidu application client ID/secret belongs to the deployment and remains
  server-side. It is unrelated to Houkago account/session secrets.
- **Server-saved** mode encrypts the user's refresh token at rest and rotates
  the stored token atomically when refresh returns a replacement.
- **User-held** mode persists the refresh token only in the desktop adaptor,
  but code exchange and every refresh pass through server memory because the
  client secret is required. Those endpoints must never persist or log the
  token and return it only to the authenticated paired adaptor.
- The adaptor, not ordinary page JavaScript, calls Baidu APIs in user-held mode.
  It returns only sanitized directory entries or the final selected-file
  capability produced after the private raw-dlink HEAD exchange.
- The raw dlink is not viewer-safe: resolving it requires the OAuth access token
  and provider UA. Only the server (server-saved mode) or Alice's adaptor
  (user-held mode) may perform that exchange. The final redirect Location must
  use an approved Baidu download host and contain no access/refresh credential
  before Houkago accepts it for distribution.
- The final dlink is still a bearer capability for one selected file. It is less
  powerful than an OAuth token but may be copied by an authorized viewer until
  expiry.
  Houkago can stop issuance/renewal immediately; it cannot revoke bytes already
  delivered or promise DRM.
- Media bytes travel directly between each viewer and Baidu. Houkago owns the
  control plane, grant checks, and dlink coordination only.
- Keep WebExtension core code browser-neutral. Firefox uses `browser.*` Promise
  APIs; Chromium uses a compatibility wrapper and DNR session rules. Do not
  force the two network engines into one lowest-common-denominator function.

## Unknowns requiring real-platform validation

- Exact production application approval requirements and granted Netdisk
  scope for listing the user's desired root.
- Exact dlink expiry/rotation behavior and whether a fresh filemetas call yields
  viewer-distinct links.
- Redirect host set reached by real dlinks and whether the UA must be preserved
  across every redirect.
- CORS/media behavior and Range/seek behavior in installed Chrome with a real
  account and approved application.

These unknowns do not change the MVP contract; they require a real-credential
human smoke gate before the adaptor is called production-ready.
