# React Frontend Guidelines

The React package owns the local entry and room interface. Read these contracts before changing its runtime, routes, or features:

| Guide | Scope |
| --- | --- |
| [React Entry Runtime](../../frontend/react-entry-runtime.md) | Identity restoration, Query cache, routing, lifecycle, and local startup |
| [React Room Runtime](./room-runtime.md) | Admission, WebSocket authority, room commands, and media boundary |
| [HTTP Contract and Resources](../../frontend/http-contract-resources.md) | Generated SDK adapters, request errors, cancellation, and private data |
| [Public Site Configuration](../../frontend/site-configuration.md) | Shared public identity and configuration |

This index names the React package explicitly for Trellis context discovery. The Vue package guidelines still apply to shared `houkago-kyoushitsu` code, not React components.
