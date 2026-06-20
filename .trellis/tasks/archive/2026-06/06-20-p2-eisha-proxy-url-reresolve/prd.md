# P2 eisha proxy URL re-resolve

## Goal

Make eisha proxy URLs stable across short-lived upstream media URLs. When a proxied HLS manifest or segment URL expires, the proxy should be able to re-resolve from the original source URL and retry without requiring users to recreate the Enmoku.

## What I Already Know

* P2 parsing/proxy is partially complete: eisha has stable proxy tokens, Range passthrough, m3u8 manifest rewriting, Generic HLS metadata parsing, and housou persists extended Enmoku metadata.
* The design backlog names expired/signed URL handling as the next P2 proxy concern.
* Current `ProxyRef` stores only `{ url, headers }`, so a rewritten segment token cannot recover if that concrete segment URL expires.
* `resolveUrlWithMetadata` already fetches HLS manifests and parses `sources`, `subtitles`, and `live` metadata.
* Existing proxy tests cover Range passthrough, manifest rewriting, response header filtering, and housou route mounting.

## Assumptions

* MVP focuses on HLS because the repo already has manifest parsing and rewriting there.
* Re-resolve should trigger on upstream HTTP expiry-like failures, not on every request.
* The first implementation can keep source identity inside eisha proxy refs; no database migration is required for this slice.

## Requirements

* Extend eisha proxy refs with optional source/origin context that allows a token to re-resolve from the original source URL.
* Preserve backwards compatibility with existing `{ url, headers }` tokens.
* When proxying a manifest, propagate enough source context into rewritten child URI tokens for later recovery.
* On expiry-like upstream statuses, re-fetch the original HLS manifest and retry against the refreshed corresponding URL.
* Preserve existing Range forwarding and response header filtering behavior.
* Keep housou and kyoushitsu contracts stable for existing direct create flows.

## Acceptance Criteria

* [ ] Existing proxy token decode/encode tests still pass for legacy refs.
* [ ] Manifest rewriting emits child proxy refs that retain origin context.
* [ ] A proxied HLS segment request that first returns an expiry-like status can re-resolve via the original manifest and return the refreshed segment.
* [ ] Re-resolve does not run for non-HLS direct media refs without source context.
* [ ] `bun test` and type-check pass for affected packages.

## Definition of Done

* Tests added or updated for the re-resolve path.
* Lint/type-check/test commands pass.
* `design.md` and relevant Trellis spec notes are updated if the behavior changes documented architecture.
* Rollback is straightforward: remove the optional ref fields and retry branch while legacy proxying remains intact.

## Out of Scope

* A full Bilibili or other site parser.
* Persistent refresh metadata in SQLite.
* Scheduled/background refresh.
* DASH/mpd re-resolution.
* UI controls for refresh state.

## Technical Approach

Use a backwards-compatible `ProxyRef` extension. Parent manifest tokens may carry an HLS origin marker. During m3u8 rewrite, child refs include a relative URI or stable path hint plus the original source URL/headers. On an expiry-like upstream response, eisha re-fetches the origin manifest, resolves the same relative URI against the fresh manifest URL, and retries the upstream request once.

## Decision (ADR-lite)

**Context**: Stable proxy endpoints already hide concrete upstream URLs from the frontend, but signed HLS URLs can expire after an Enmoku is queued.

**Decision**: Implement lazy retry-based HLS re-resolution inside eisha proxy refs, scoped to manifests and rewritten child URIs.

**Consequences**: This keeps frontend/server contracts small and avoids new storage, but it only handles resources that can be mapped from a refreshed HLS manifest. Site-specific refresh logic remains a future parser responsibility.

## Technical Notes

* Likely touched files:
  * `packages/eisha/src/proxy.ts`
  * `packages/eisha/src/resolver.ts`
  * `packages/eisha/test/proxy.test.ts`
  * `packages/housou/test/eisha-proxy.e2e.test.ts`
  * `design.md`
* Existing implementation points:
  * `proxyUpstream(ref, request, fetcher)` owns fetch, Range forwarding, response header filtering, and m3u8 rewriting.
  * `rewriteM3u8Manifest` currently resolves each URI against the active upstream manifest URL and encodes a child `{ url, headers }` ref.
  * `resolveUrl` creates the initial `/eisha/proxy/:token` URL used by housou create flows.
