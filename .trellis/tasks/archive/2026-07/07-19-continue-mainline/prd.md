# Continue product mainline

## Goal

Advance the product from the completed public, URL-first room-playback path to
a trustworthy account-and-authorization foundation. This makes room mutations
non-forgeable without adding any Bilibili browse/search work, other third-party
platform expansion, or third-party source-session capability.

## Review of 2026-07-18 Work

- The warm club-room theme and responsive room shell were completed while
  preserving playback, WebSocket, danmaku, and chat ownership boundaries.
- The portrait room experience made chat a touch- and keyboard-accessible
  bottom sheet, with compact room and playlist disclosures; desktop and
  landscape remained stable.
- The room now has a formal public-URL composer: a URL is previewed without
  mutation, then explicitly queued or queued-and-selected. It accepts public
  direct media, HLS, DASH, and supported public Bilibili URLs only.
- The new flow deliberately rejects private/local upstreams and keeps
  credentials and raw third-party session material out of room data, WebSocket
  payloads, and browser-visible media metadata.
- Playwright desktop and portrait coverage plus a reusable validation workflow
  were established. The completed task also resolved the room-stage scrolling,
  high-window workbench sizing, and initial-room-entry latency issues found in
  browser review.

## Confirmed Mainline Direction

- The product remains **URL-first**. Platform browse/search, recommendation,
  indexing, crawlers, and multi-provider aggregation are not part of this
  mainline.
- The public-source flow is complete for its intended scope. A real Bilibili
  smoke test remains useful regression coverage, but is not the next product
  milestone.
- The next dependency is a non-forgeable user identity. Today, REST queue
  mutation accepts a caller-supplied `addedBy` value and has no server-side
  `canPlaylist` authorization; the existing WebSocket permission gate does
  not secure REST.
- Identity does not itself approve a third-party source-session integration.
  That integration, trusted session sharing, and host-device media proxying are
  all separate, higher-risk initiatives requiring explicit future approval.

## Confirmed Implementation Facts

- Browser identity is currently a locally generated UUID (`houkago.buinId`),
  sent as both REST `buchouId`/`addedBy` values and the WebSocket `senderId`
  query parameter. A caller can forge each of these values.
- The server persists `bushitsu.buchou_id` and `enmoku.added_by`, but has no
  user-account or authenticated-session table. Existing `buin` rows are not an
  account identity system.
- Room permissions are enforced for WebSocket actions, but REST preview,
  enqueue, and delete routes do not authenticate an actor or enforce
  `canPlaylist`.
- The project design already chooses a Houkago-issued `Seitoshou` JWT/token
  before OAuth. No authentication library is currently installed.

## Proposed Delivery Sequence

1. **Identity and room authorization foundation** — establish a stable,
   server-verified actor for REST and WebSocket room membership; enforce room
   permissions for queue mutation without trusting client-supplied identity.
2. **Room-governance follow-ups** — evaluate member management, queue
   management, subtitle/audio controls, or control-rights policy only as
   separately approved URL-first work.

## Requirements

- Provide open, self-hosted username-and-password registration, sign-in,
  sign-out, and expiring Houkago sessions. Email verification, password reset,
  administrators, and invitations are out of scope.
- Preserve the current public URL queue, proxy, player, sync, chat, and
  responsive room behavior.
- Never expose, persist, broadcast, or log third-party credentials/raw session
  material through `Enmoku`, room data, WebSocket, REST responses, or browser
  media URLs.
- Retain URL-first product scope; do not add provider browsing or search.
- Do not add Bilibili or any other third-party platform integration, account
  session binding, trusted session sharing, or host-device media proxying.
- Specify the identity, REST authorization, session lifecycle, migration, and
  rollback boundaries before code is written.

## Acceptance Criteria

- [ ] A new visitor can register, sign in, refresh their session, and sign out
      with a self-hosted username/password account; expired or revoked sessions
      cannot authenticate a REST or WebSocket request.
- [ ] Passwords and raw session tokens never appear in database logs, API JSON,
      room data, WebSocket envelopes, or browser-readable storage; persistent
      password and session data are one-way hashes/digests only.
- [ ] New room ownership and queue attribution are derived from the
      authenticated server actor. Mutation bodies and WebSocket query/envelope
      fields cannot assign another account's authority.
- [ ] Preview, enqueue, delete, source selection, transport, admission, and
      permission settings reject unauthenticated or impersonating actors; REST
      queue mutation also requires admission and the current room permission.
- [ ] Existing public URL playback, synchronization, chat, responsive layouts,
      and URL-first source boundary continue to work for authenticated users.
- [ ] Legacy UUID-owned development data is not migrated, claimed, silently
      deleted, or treated as authenticated ownership; startup gives an explicit
      reset instruction when it detects that legacy boundary.
- [ ] Backend, shared-contract, frontend, and desktop/phone Playwright tests
      cover the account, session, authorization, impersonation, and regression
      paths.

## Product Decisions

- V1 uses open, self-hosted username-and-password registration.
- V1 has no email verification, password reset, administrator bootstrap, or
  invitation lifecycle.
- OAuth and every third-party media-platform integration remain out of scope.
- Existing UUID-owned rooms and queues will not be migrated. Before running the
  authenticated version, the operator resets the development database and starts
  again; the application must not silently claim or retain legacy ownership.
