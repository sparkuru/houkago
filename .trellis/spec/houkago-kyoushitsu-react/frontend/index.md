# React Frontend Guidelines

The React package owns the local entry and room interface. Read these contracts before changing its runtime, routes, or features:

| Guide | Scope |
| --- | --- |
| [React Entry Runtime](../../frontend/react-entry-runtime.md) | Identity restoration, Query cache, routing, lifecycle, and local startup |
| [React Room Runtime](./room-runtime.md) | Admission, WebSocket authority, room commands, and media boundary |
| [React Media, Baidu and Danmaku](./media-provider-danmaku.md) | Player lifecycle, authorized sync, provider grants and overlays |
| [HTTP Contract and Resources](../../frontend/http-contract-resources.md) | Generated SDK adapters, request errors, cancellation, and private data |
| [Public Site Configuration](../../frontend/site-configuration.md) | Shared public identity and configuration |

Shared browser/domain modules now belong to
[`houkago-kyoushitsu-core`](../../houkago-kyoushitsu-core/frontend/index.md).
The retired application's binding specs are historical M6 evidence. Shared
conventions remain in [directory structure](../../frontend/directory-structure.md),
[components](../../frontend/component-guidelines.md),
[hooks](../../frontend/hook-guidelines.md),
[state](../../frontend/state-management.md),
[quality](../../frontend/quality-guidelines.md) and
[type safety](../../frontend/type-safety.md).
