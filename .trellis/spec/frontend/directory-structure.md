# Frontend Directory Structure

The application is `houkago-kyoushitsu-react`, built with React, Vite,
TanStack Router/Query, Tailwind and owned UI primitives. Framework-independent
browser/domain code belongs to `houkago-kyoushitsu-core`; Kousoku owns protocol
and domain schemas. The old application was removed after M6 owner acceptance.

```text
packages/kyoushitsu-react/
  src/app/                 identity/runtime, Query and router
  src/routes/              thin entry and room routes
  src/components/ui/       shared presentation primitives
  src/features/            entry, identity, room, player, baidu, danmaku
  src/styles/              application layout and token consumers
  test/                    React runtime/presentation helpers
  e2e/                     Chromium desktop/mobile room contracts
packages/kyoushitsu-core/
  src/api/                 generated SDK and handwritten resources/policies
  src/room/ src/ws/         room/session/permission/presence and transport
  src/playback/ src/media/  pure player port, sync and metadata
  src/provider/ src/danmaku/ portable provider and local cue helpers
  src/config/ src/i18n/ src/theme/
  test/                    pure helper and contract/boundary tests
packages/houkago-adapter/e2e/ installed extension boundary
```

Use package-relative imports inside core and explicit core subpaths from apps.
Keep app aliases inside their own package. Feature files use kebab-case and
export PascalCase React components; hooks use `useXxx`. Domain identifiers use
ASCII romaji from the project dictionary. Do not copy another app's source.

Read [React entry](react-entry-runtime.md),
[room runtime](../houkago-kyoushitsu-react/frontend/room-runtime.md),
[media](../houkago-kyoushitsu-react/frontend/media-provider-danmaku.md) and
[core boundaries](../houkago-kyoushitsu-core/frontend/shared-core.md).
