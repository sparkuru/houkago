# Subtitle and audio track UI

## Goal

Let each viewer choose available supported subtitles without changing room
playback authority.

## Confirmed Facts

- `Enmoku.subtitles` is durable room metadata: a named mapping of `{ url, type }`.
  HLS parsing already finds and proxies `EXT-X-MEDIA:TYPE=SUBTITLES`; the room
  currently only displays those names as metadata.
- `EnmokuPlayer` owns the native video, hls.js, dash.js, and all custom
  ArtPlayer controls. Source-quality selection is already local to the viewer
  and must not emit room authority messages.
- HLS manifests can include audio renditions, and Bilibili DASH manifests carry
  audio representations, but neither is currently represented in the `Enmoku`
  contract with user-facing track labels. The existing Bilibili output provides
  one combined manifest per video-quality selection.
- Current scope must retain URL-first source handling, server-authoritative
  playback sync, and the existing owner/member authority rules.

## Requirements

- Subtitle selection is a viewer-local presentation preference: it does not
  enter Pinia room truth or WS messages and does not affect other viewers.
- This slice delivers subtitle selection only. Audio-track metadata and audio
  selection are deferred to a later bounded task.
- A subtitle selection lasts only for the current `Enmoku` in the current page.
  It defaults to off after a refresh or a switch to another `Enmoku`, and is
  never saved in browser storage. Quality/source selection for that same
  `Enmoku` remains independent.
- The controls must be keyboard-accessible, usable in normal and fullscreen
  player layouts, and degrade cleanly when media exposes no selectable track.
- Source-quality switching must remain independent from the new controls.

## Key Decisions

- Subtitle selection uses the existing durable named subtitle metadata.
- Audio tracks are deferred because the current `Enmoku` contract has no named
  selectable audio rendition model.
- Selection defaults to off and is page-local per current `Enmoku`; this avoids
  applying a stale same-named selection to unrelated media.

## Acceptance Criteria

- [ ] When the current supported HLS `Enmoku` has subtitles, every viewer sees
  an accessible player control with “Off” and the available subtitle labels.
- [ ] Selecting a label renders only that viewer's subtitle track; selecting
  “Off” hides it. The action does not send a WS message, mutate Pinia room
  truth, or alter the remote viewer's selection/playback.
- [ ] Selection remains across source-quality changes for the same `Enmoku`,
  but resets to off on page reload or when a different `Enmoku` becomes current.
- [ ] The control is usable by mouse, touch, and keyboard; it remains usable in
  normal, cinema, web fullscreen, and native fullscreen layouts, has visible
  focus, and does not create horizontal overflow at the phone breakpoint.
- [ ] No control is rendered for media without supported subtitle tracks;
  loading or selection failures leave playback working and present a clear
  local fallback state.
- [ ] Unit and responsive browser coverage prove the local-only behavior,
  selection/off/reset behavior, source-quality independence, and no regression
  to room authority or existing player controls.

## Out of Scope

- New media providers, content search/browsing, third-party account/session
  integration, and room-wide synchronized subtitle/audio selection.
