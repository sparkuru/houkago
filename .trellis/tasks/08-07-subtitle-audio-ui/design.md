# Subtitle selector — design

## Boundary and supported media

This is a frontend-only, viewer-local HLS subtitle slice. `Enmoku.subtitles`
already provides named, proxied HLS subtitle metadata. No database, resolver,
REST, WebSocket, Pinia, or room-authority contract changes are required. Audio
rendition metadata and audio selection are explicitly deferred.

## State and data flow

1. A pure frontend helper maps `Enmoku.subtitles` to stable selector choices:
   `off` plus named tracks. It exposes no provider/parser knowledge.
2. `BushitsuView` owns `selectedSubtitle` as a local ref, starts it at `off`,
   and resets it only when `currentEnmokuId` changes. It remains unchanged when
   source quality changes for that same item.
3. The view passes the choices and selected value to `EnmokuPlayer`; the player
   emits a typed local subtitle-selection event back to the view.
4. `EnmokuPlayer` alone retains the hls.js instance and native media access. It
   maps the selected named choice to the runtime HLS subtitle track, updates
   `subtitleTrack` and `subtitleDisplay`, and uses native text-track modes as
   the fallback for native-HLS browsers. It receives no room/client authority.
5. The player emits a local selection failure state only. Loading errors must
   not pause, seek, switch quality, or emit `SHINKOU`.

## UI and accessibility

- Add a subtitle selector next to the existing source-quality control and before
  danmaku controls, preserving the documented player-control order.
- It contains an explicit Off option and localized named labels. A selected
  label is available to assistive technology; buttons retain keyboard and
  touch support, visible focus, and self-contained fullscreen-safe markup.
- Do not show a subtitle control if `Enmoku` has no supported subtitle choices.
  Selection failure returns to Off with a local, non-blocking notice.

## Compatibility and rollback

- Existing direct/DASH/no-subtitle playback is unchanged because the props
  default to an empty choices list and no custom control is registered.
- HLS selection follows the currently loaded manifest's runtime track list;
  unmatchable legacy metadata degrades to Off without breaking media playback.
- Removing the UI props/control rolls back cleanly without a stored migration
  or stale room state.
