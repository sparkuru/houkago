# Framework-Neutral Frontend Core

Package: `houkago-kyoushitsu-core` at `packages/kyoushitsu-core`.
Read these contracts before changing retained shared browser/domain modules.

| Guide | Scope |
| --- | --- |
| [Core ownership and exports](shared-core.md) | Package dependency/import boundary, module groups, tests and migration ownership |
| [HTTP contract and resources](../../frontend/http-contract-resources.md) | Generated SDK, typed errors/cancellation, resource keys and contract pipeline |
| [Public site configuration](../../frontend/site-configuration.md) | Pure public-config loader, normalization and value-free failure handling |
| [React room runtime](../../houkago-kyoushitsu-react/frontend/room-runtime.md) | Consumer admission, WS authority and command ownership |
| [React media/provider/danmaku](../../houkago-kyoushitsu-react/frontend/media-provider-danmaku.md) | Consumer player/provider lifecycle and local overlay choices |

The core owns no application entry or framework bindings. React UI/hooks stay
in the React package. M6 owner acceptance retired the old application; core
is the retained shared implementation, with no application fallback.
