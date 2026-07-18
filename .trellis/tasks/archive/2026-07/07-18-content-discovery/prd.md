# Shared URL playback sessions

## Goal

Let an authorized room participant bring a video URL, resolve it into a
playable room item, supply a valid source session only when the source needs
one, and then watch, chat, and share the same playback together.

The longer-term model follows account-bound third-party sessions: a participant
can use their own bound session, deliberately share a trusted session, or act
as the room's media proxy when their upload bandwidth permits.

## Confirmed Facts

- `houkago-eisha` resolves generic direct/HLS/DASH URLs and public Bilibili
  video URLs into stable, metadata-rich `Enmoku` sources.
- `POST /bushitsu/:id/enmoku` already resolves a submitted `sourceUrl`,
  persists the resulting `Enmoku`, and broadcasts the updated `Bangumi`.
- `BushitsuView` already lets an authorized viewer play or delete queue items;
  its remaining source form is explicitly a development direct-link tool.
- There is no platform browse/search REST API or UI today.
- Identity, account login, and account-to-session binding are not implemented
  in the current development-stage product.
- The current REST queue mutation accepts an arbitrary `addedBy` value and has
  no authenticated request identity or server-side `canPlaylist` check;
  `JOUEI` and `SHINKOU` remain server-gated through the WebSocket connection.
- `Enmoku.headers` currently persists in the room data model, so it cannot be
  used as the long-term storage boundary for private third-party sessions.

## Product Decisions

- The product is URL-first. It does not search, index, recommend, or acquire
  third-party content on the user's behalf.
- A source session belongs to a platform account rather than to the URL or to
  the room by default.
- A future room playback request may use one of three explicit modes:
  1. **Personal session** — each participant plays through their own valid
     account-bound session.
  2. **Trusted shared session** — the owner knowingly makes a bound session
     available to room participants; this is high-trust and high-risk.
  3. **Host media proxy** — the requester uses their own bound session and
     relays media from their device to the room; its feasibility is constrained
     by that participant's uplink and availability.
- Credentials and raw session material must never travel in room queue,
  WebSocket, browser-visible media metadata, or chat payloads.
- This task implements the public or otherwise no-private-session URL path as
  a proper room feature. Account identity, personal session binding, trusted
  sharing, and host-device media proxying are follow-on work with their own
  security and lifecycle designs.
- The formal URL composer belongs with the room's `Bangumi` (queue), replacing
  the development-only direct-link form. It is visible only to members whose
  existing WS-derived `canPlaylist` permission permits source selection.
- A successful submission adds an item to the queue by default. It does not
  interrupt current playback. A separate “add and switch to room playback”
  action adds the item and selects it through `JOUEI`; it deliberately does not
  promise autoplay.
- Room source selection (`JOUEI`) remains separate from transport control
  (`SHINKOU`): the former changes the current item and resets it paused; the
  latter starts, pauses, seeks, and synchronizes playback. Other participants
  may still need their own browser gesture to join audible playback.
- Generic media URLs already receive a deterministic fallback title from their
  final path segment or host name when provider metadata is unavailable.
- The preview lets the submitter set an optional room-local display title. By
  default it uses parser metadata or the deterministic URL fallback; an
  override changes neither the original URL nor external provider metadata.
- URL resolution is a two-step flow: a read-only preview resolves and reports
  the candidate source first; only an explicit confirmation writes an `Enmoku`
  to the room queue. A preview that fails or requires a future account session
  cannot create a queue item.
- The initial preview accepts only verifiable HTTP(S) direct media, HLS
  manifests, DASH manifests, and public Bilibili video URLs supported by the
  existing resolver. Unrecognised platform pages are explicitly unsupported;
  they are not guessed to be direct media or queued.
- The initial release accepts public internet origins only. Loopback, private
  network, and link-local targets are rejected before the server proxy can
  request them; future host-device proxying is the deliberate path for
  LAN/private media.
- The composer must preserve the existing warm theme and responsive room
  layout: visible labels, nearby loading/error feedback announced to assistive
  technology, keyboard-operable controls, and mobile touch targets of at least
  44px with spacing between adjacent actions.
- The `Bangumi` header contains an “add link” action. It expands the two-step
  composer inline at the top of the queue rather than opening a dialog, so the
  input, preview, and resulting queue item retain their room context on desktop
  and portrait mobile layouts.

## Requirements

- Provide a room-scoped URL submission path that ends in the existing
  authoritative room queue and playback flow.
- Preserve the current room, WebSocket, resolver, proxy, metadata, and queue
  contracts unless a small additive contract is required.
- Keep the composer aligned with the existing `canPlaylist` UI and the
  server-gated `JOUEI`/`SHINKOU` flows. Authenticated REST queue authorization
  is explicitly deferred to the account-identity foundation.
- When a supported parser can identify that a source needs a future
  account-bound session, report that state clearly; do not attempt to collect
  or persist session material in this task.
- Make source/session limits and unavailable-content states explicit instead
  of presenting failed results as playable; do not leak credentials or source
  session material.

## Acceptance Criteria

- [ ] An authorized viewer can submit a public/no-private-session URL and see
      whether it is resolvable, needs a future account session, or is ready to
      add or switch.
- [ ] Previewing a URL does not mutate the room. Only an explicit queue or
      add-and-switch confirmation creates an `Enmoku` and broadcasts `BANGUMI`.
- [ ] A preview rejects an unrecognised platform page before it can enter the
      queue; it never presents that page as a playable direct video.
- [ ] Preview rejects loopback, private-network, and link-local targets before
      any server-side proxy request.
- [ ] A submitter may optionally set a room-local display title; otherwise the
      resolved metadata or URL fallback is used.
- [ ] Default submission changes only the room queue. The explicit “add and
      switch to room playback” action requires source-selection permission,
      uses `JOUEI`, and communicates that actual transport still follows the
      playback-control and per-browser join rules.
- [ ] A member with the existing UI source-selection permission can add and
      select a newly queued item through `BANGUMI`/`JOUEI`; transport remains
      governed by the existing server-gated `SHINKOU` flow.
- [ ] Participants can share the same video, chat, and receive synchronized
      room playback.
- [ ] Results and failure states communicate source and future-session
      availability clearly and do not expose source credentials or session
      material.
- [ ] Existing direct-link and Bilibili resolver behaviour remains compatible.
- [ ] API, frontend, and browser-flow tests cover the final scope.

## Likely Out of Scope

- Platform keyword search, recommendation feeds, content indexing, crawlers,
  and multi-provider aggregation.
- Platform-specific account login and session-binding UI until the required
  identity and secure-secret foundation is explicitly scheduled.
- Authenticated REST queue authorization: it requires a non-forgeable request
  identity and remains intentionally outside this development-stage task.
- Actual host-device media relay and trusted-session sharing until their
  security, lifecycle, and transport designs are separately approved.
- Playlist reorder/auto-advance, room-level danmaku storage, and theme work.
