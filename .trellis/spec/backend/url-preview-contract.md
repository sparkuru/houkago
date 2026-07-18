# Public URL Preview Contract

## Scenario: room-scoped public media preview

### 1. Scope / Trigger

- Trigger: `POST /bushitsu/:id/enmoku/preview` is a cross-layer REST contract
  used by the Bangumi URL composer before it creates an `Enmoku`.
- Purpose: reject unsupported public URLs without mutating the room, then let a
  deliberate second request use the existing queue-and-`BANGUMI` flow.
- Boundary: this is a public/no-private-session product entry. It does not add
  account identity, third-party credentials, trusted sharing, or device media
  proxying.

### 2. Signatures

```text
POST /bushitsu/:id/enmoku/preview
body: { sourceUrl: string, title?: string }

POST /bushitsu/:id/enmoku
body: { sourceUrl: string, title?: string, addedBy: string }
```

`previewPublicUrlWithMetadata(input, { proxyBase })` in `houkago-eisha` owns
the public-source preview. `housou` only checks that the room exists, calls it,
and maps its result to a browser-safe summary.

### 3. Contracts

- Preview accepts only HTTP(S) URL strings, an optional room-local title, and
  no `headers`, cookies, authorization, proxy URLs, or session material.
- A successful response is currently:

  ```ts
  {
    state: "ready"
    title: string
    type: "direct" | "hls" | "dash"
    provider?: { kind: "bilibili"; ownerName?: string }
    sourceCount?: number
    subtitleCount?: number
    live?: boolean
  }
  ```

- Preview is read-only: it must not call `addEnmoku`, write persistence, or
  publish `BANGUMI`.
- The composer locks its URL and title after `ready`; “edit” clears that
  preview. Only then may it call the existing create endpoint. The parent view
  sends `JOUEI` only after create returns an `Enmoku`.
- The existing create route remains a legacy-compatible REST endpoint. Until
  authentication and full SSRF hardening exist, do not represent it as a
  server-enforced replacement for the preview flow.

### 4. Validation & Error Matrix

| Condition | Error code / HTTP | Queue effect |
| --- | --- | --- |
| Room does not exist | `BUSHITSU_NOT_FOUND` / 404 | None |
| Invalid or non-HTTP(S) URL | `EISHA_BAD_REQUEST` / 400 | None |
| Literal localhost, loopback, RFC1918, link-local, CGNAT, multicast, or IPv4-mapped IPv6 | `EISHA_PRIVATE_UPSTREAM` / 400 | None |
| HTML page or media MIME/type not recognised | `EISHA_UNSUPPORTED_SOURCE` / 422 | None |
| Upstream fetch failure or non-success response | `EISHA_UPSTREAM_ERROR` / 502 | None |
| Verified direct/HLS/DASH or supported public Bilibili source | 200 `ready` | None until explicit create |

The literal-host policy is deliberately **not** complete SSRF protection. DNS
A/AAAA validation, bounded redirect handling, proxy-token/HLS-child runtime
checks, and deployment egress rules belong to the separate SSRF hardening task.
Preview rejects redirects rather than following them.

### 5. Good / Base / Bad Cases

- Good: `https://media.example/video.mp4` returns `video/*`; preview returns a
  title/type summary, then an explicit create broadcasts the normal `BANGUMI`
  snapshot.
- Base: the optional title is absent; resolver/provider metadata or the URL
  fallback becomes the room display title.
- Bad: `http://192.168.1.2/movie.mp4` fails with 400 before an upstream preview
  request; `https://example.test/watch` returning `text/html` fails with 422.

### 6. Tests Required

- `packages/eisha/test/resolver.test.ts`: direct preview exposes no proxy URL,
  rejects ordinary HTML, and rejects localhost/private IPv4/IPv6/link-local or
  IPv4-mapped literal targets.
- `packages/housou/test/rest.test.ts`: a ready preview creates no queue entry;
  its response contains no source URL or headers; a private literal returns 400.
- `packages/kyoushitsu/e2e/mobile-room.spec.ts`: a permitted member can open
  the inline composer at 375px and iPad portrait sizes, close it, and preserve a
  draft with Escape.

### 7. Wrong vs Correct

#### Wrong

```ts
// A preview route persists first, then tells the browser whether it worked.
const enmoku = await createEnmoku(bushitsuId, body, proxyBase)
return { state: "ready", url: enmoku.url, headers: enmoku.headers }
```

This mutates the queue during inspection and leaks browser-unsafe source data.

#### Correct

```ts
const source = await previewPublicUrlWithMetadata(
  { title: body.title, url: body.sourceUrl },
  { proxyBase },
)
return { state: "ready" as const, title: source.title, type: source.type }
```

Keep source URL resolution and proxy/header details inside `eisha`; return only
display-safe metadata from `housou`.
