# M5 repository boundary inventory (2026-09-28)

- M4 React room: `packages/kyoushitsu-react/src/features/room/room-runtime.ts`
  and `room-contents.tsx`. The runtime handles `GENJOU` current ID but not
  playback state or `DANMAKU_DEFAULT`; media is a visible placeholder.
- M1 seams: `packages/kyoushitsu/src/lib/player.ts` defines `PlayerHandle`;
  `shinkou-controller.ts` holds drift/echo/catch-up and uses `@/lib` imports;
  `room-session.ts` applies messages before `onAfterMessage`. Vue binds it in
  `src/composables/useShinkou.ts`.
- Vue behavior: `src/components/player/EnmokuPlayer.vue` owns ArtPlayer,
  HLS/DASH, pending seek, subtitles, fullscreen, time and cleanup.
  `src/views/BushitsuView.vue` composes player/Baidu/danmaku after admission.
  `src/composables/useBaiduPlayback.ts`, `useBaiduSource.ts` and
  `useTimelineDanmaku.ts` are Vue-bound; reuse pure helpers and behavior.
- HTTP: `src/api/resources/http.ts` already has Baidu status/files,
  availability, grant preparation and danmaku candidate/search reads.
  `src/api/generated/sdk.gen.ts` has pairing/OAuth/revoke/source-create and
  room-default/proposal/match operations. `src/api/baidu.ts` and
  `src/api/danmaku.ts` still use Eden for Vue.
- Browser reference: Vue `e2e/subtitle-*.spec.ts`,
  `e2e/danmaku-source.spec.ts`, `e2e/desktop-room.spec.ts`,
  `e2e/mobile-room.spec.ts` and `e2e/chromium-adapter-installed.spec.ts`;
  React has entry/real-cookie room tests. Archived M4 `validation.md` records
  the most recent full gates.
- Contract anchors: archived migration `spec.md` S1–S6;
  `.trellis/spec/houkago-kyoushitsu-react/frontend/room-runtime.md` and
  `.trellis/spec/frontend/http-contract-resources.md`. The Baidu-specific
  permission, revoke, OAuth and grant rules live in
  `.trellis/spec/frontend/baidu-adapter-contract.md`.
