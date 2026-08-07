# Baidu Netdisk direct adaptor

## Goal

Let an authenticated Houkago user authorize their Baidu Netdisk through the
official application flow, then add and play files from that user's Netdisk
without routing through AList or relaying media bytes through Houkago. A
general desktop client named `houkago-adapter` supplies the narrowly authorized
client capabilities this requires; its first capability adds
`User-Agent: pan.baidu.com` only on an authorized Baidu download request chain.

## Confirmed Facts

- Houkago is URL-first: `housou` resolves an Enmoku through `eisha`, whose
  stable proxy carries only the upstream URL and request headers; media bytes
  are never stored locally.
- Baidu media must not be relayed through Houkago servers in normal playback.
  Houkago is the authorization/control plane only; each viewer's client makes
  the media request directly to Baidu with the required provider-specific UA.
- Sources that do not require a client-side transport adaptor keep their
  current browser-only playback path. A missing Baidu adaptor must affect only
  that Baidu Enmoku: room entry, chat, and unrelated sources remain usable.
- The first release supports Firefox first, then Chromium-family desktop
  browsers through shared WebExtension core logic and browser-specific request
  adapters. Mobile users may enter rooms and play ordinary sources, but Baidu
  Enmoku playback is explicitly unavailable; a mobile companion is a mainline
  follow-up rather than an unreliable browser-specific fallback.
- The current public provider contract supports Bilibili only. No per-user
  third-party credential store or OAuth callback exists yet.
- Current provider headers are server-proxied, but that path would make
  Houkago carry Baidu media bandwidth. The Baidu adaptor therefore introduces
  a client-side, source-scoped header boundary while preserving Range/seek.
- The cited AList documentation says that Baidu API download links for files
  over roughly 20 MB require `User-Agent: pan.baidu.com`, and recommends a
  proxy when the requester cannot set it. Baidu's open-platform pages describe
  OAuth authorization, access tokens, and refresh tokens for account-bound
  Netdisk access.
- Baidu's platform advertises file-management and account-authorization
  capabilities. Its published Netdisk examples use REST endpoints for file
  listing and file metadata/download links; a platform SDK exists for some
  partner/NAS scenarios, but no JavaScript/Bun SDK has been established as the
  supported dependency for this project. The adaptor will therefore own a
  small, tested REST client for its read-only contract.

## Requirements

- Use Baidu's official client ID / client secret and OAuth authorization; do
  not integrate AList, scrape web sessions, or accept Baidu account passwords.
- Ship the desktop client as `houkago-adapter`, with a versioned capability
  registry and browser-specific transport ports. Baidu UA injection and
  user-held Baidu credentials are capabilities of that client, not the identity
  or permanent architectural limit of the client.
- Configure one Baidu application client ID/secret per Houkago deployment on
  the server. Each Houkago user authorizes that application separately and
  receives only their own account-bound token record; users never submit or
  receive the Baidu application secret.
- Offer two explicit per-user credential-retention modes at connection time:
  **server-saved** keeps the user's refresh token encrypted at rest for
  server-side playback, while **user-held** never persists the refresh token
  server-side and only permits the source while its connector is online.
- The user-held mode must bind every playable capability to a live connector
  session and invalidate it on connector disconnect. The room UI must show the
  source unavailable and disable its playback action whenever that live
  capability is absent; it must never silently fall back to another user's
  saved authorization.
- In user-held mode, Houkago remains the sole playback-policy and dlink
  distribution coordinator, but an online connector adaptor performs the final
  Baidu API call. The server sends it a nonce-bound request for an already
  selected source; the adaptor verifies its local source/room permit, uses its
  local token to obtain that file's dlink, and returns only the dlink. No user
  action is required at play time.
- Selecting a file in the Netdisk browser and adding it to a room is Alice's
  single explicit file/room permit in user-held mode. While Alice's connector
  remains online, it may automatically fulfill nonce-bound dlink requests for
  that exact source; it must prompt again only when the file or room changes.
- A connector's Baidu refresh/access token is never delivered to viewers,
  embedded in Enmoku/room/WebSocket data, or used as a media URL. Direct
  playback may deliver an expiring, selected-file download capability to an
  authorized viewer; it must be treated as sensitive, expire promptly, and
  cannot promise copy prevention while direct media playback is allowed.
- Apply least possession: separate the deployment's Baidu client secret, a
  connector's OAuth tokens, and a viewer's selected-file playback grant. Keep
  the first two out of browser page/room data and never send OAuth tokens to a
  viewer. Make each direct-file grant short lived, room/file/viewer scoped, and
  revocable at the Houkago adaptor boundary.
- Bind the resulting authorization to the authenticated Houkago user, keep it
  out of room/Enmoku/WebSocket data, and provide a way to revoke it.
- A private Baidu file added by its connector may be played directly from
  Baidu by that room's admitted members. Stop issuing and renewing grants
  immediately when the Enmoku is removed, the connector revokes/disconnects
  Baidu authorization, or a viewer loses room admission. An already issued
  dlink may remain usable until Baidu expires it; OAuth tokens never reach
  viewers.
- Resolve an authorized Baidu Netdisk file into an Enmoku served through the
  existing Enmoku flow without relaying media bytes. A client-side Baidu
  request boundary must inject `User-Agent: pan.baidu.com` only for authorized
  Baidu download URLs and their redirects, including Range requests; never
  apply it to arbitrary URLs.
- Provide a modal, read-only browser for the connected user's Netdisk:
  navigate directories, show file metadata, and choose a supported media file
  to add through the existing Enmoku flow. The browser is not a general file
  manager.
- Reuse the existing room playlist permissions for adding the resolved Enmoku;
  do not change room control policy.
- Record filename-based danmaku lookup as a future mainline item, but exclude
  it from this adaptor delivery.

## Acceptance Criteria

- [ ] An authenticated user can start Baidu authorization, complete the
  callback, see that their own account is connected, and revoke it without
  exposing tokens to page JavaScript or other users; user-held tokens are
  delivered only to the paired extension.
- [ ] A connected user can resolve a selected/identified Baidu Netdisk video
  through Houkago's existing Enmoku flow without AList.
- [ ] The connected user can browse their own Netdisk directories in a modal;
  directories are navigable and choosing a supported media file produces the
  normal Enmoku preview/add flow.
- [ ] The client-side Baidu request boundary sends `User-Agent: pan.baidu.com`
  and forwards Range only for the Baidu media request chain without routing
  media through Houkago; non-Baidu playback behavior and headers remain
  unchanged.
- [ ] A viewer without the required Baidu client adaptor can still enter the
  room and play unrelated sources; Baidu playback is visibly unavailable with
  a concise setup explanation rather than a failed player request.
- [ ] Expired or revoked authorization fails safely, never leaks token values,
  and tells the owner to reconnect rather than substituting another user's
  authorization.
- [ ] An admitted member can play a connector's queued Baidu file, while an
  evicted member, a removed Enmoku, or a disconnected user-held connector can
  no longer obtain or renew a playback grant.
- [ ] The connection UI explains the distinct retention/security properties of
  server-saved and user-held modes before authorization, and the selected mode
  is visible without exposing credentials.
- [ ] Tests prove that viewer-facing REST, WebSocket, Enmoku, and player data
  never contain a connector's Baidu refresh/access token; only a bounded,
  expiring selected-file playback capability may reach an eligible client.
- [ ] In user-held mode, the server cannot ask the connector adaptor to list
  arbitrary Netdisk files or create a dlink for an unselected file; a live,
  nonce-bound request succeeds only for a source Alice explicitly selected for
  that room.
- [ ] The connector auto-fulfills a valid request for a file Alice already
  permitted in that room, while a new file or a different room requires an
  explicit selection in the Netdisk browser.
- [ ] Automated tests cover OAuth state/callback ownership, credential
  isolation/revocation, Firefox and Chromium header-rule behavior, and the
  existing room playlist authorization boundary.
- [ ] The page negotiates a versioned `houkago-adapter` capability set and
  disables only the feature whose capability is absent or incompatible;
  ordinary playback and unrelated present/future capabilities remain usable.
- [ ] Firefox is the reference implementation and passes the installed,
  real-account gate for direct media, redirects, UA injection, and Range
  requests. This delivery includes Chromium's shared implementation, automated
  transport contracts, manifest validation, and builds, but does not claim
  installed Chromium production support; that smoke/hardening gate is a
  separate follow-up task.
- [ ] On mobile, Baidu sources are visibly desktop-only while room entry, chat,
  queue visibility, and ordinary source playback continue to work.

## Explicitly Out of Scope

- AList integration, shared-link scraping, reverse-engineered client APIs, or
  speed-limit bypassing.
- Filename-based danmaku search or automatic danmaku matching for Baidu files.
- General platform browsing/search, bulk file management, upload, or download
  manager UI; including rename, move, and delete operations.
- Mobile Baidu playback or a mobile companion application.

## Technical Constraints

- User-held mode is implemented by the desktop browser extension. Houkago is
  the policy/dlink coordinator; the extension owns the token and performs the
  final Baidu API call. The server may see the resulting short-lived dlink but
  does not relay media bytes.
- If Baidu's confidential-client OAuth flow requires the server to exchange
  the authorization code, user-held mode may let the token pass through server
  memory once before delivery to the extension, but it must never be persisted
  or logged. A stronger "server never observes token" claim is not made unless
  official PKCE/public-client support is established.

## Technical Note

- Baidu's application client secret is distinct from Houkago's account
  password/session secret. The deployment operator registers the Baidu
  application once and keeps its credentials server-side. The later browser
  redirect is a per-user OAuth consent flow using that already-registered
  application; it returns a user authorization code/token rather than a Baidu
  application secret.
