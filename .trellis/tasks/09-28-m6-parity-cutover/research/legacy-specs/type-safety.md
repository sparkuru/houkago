# Type Safety

> Type safety patterns in this project.

---

## Overview

- TypeScript **strict** everywhere. The whole stack shares one type source:
  `houkago-kousoku`（校則）defines WS protocol envelopes, the `Enmoku` model, and
  domain entities; both housou and kyoushitsu import from it (design §6, §13).
- The REST surface is typed **end-to-end at compile time** via Eden Treaty:
  the frontend's `treaty<App>()` consumes housou's exported `App` type, so a
  backend contract change becomes a frontend compile error (Elysia spike P6 —
  compile-time only, no runtime cost).

---

## Type Organization

- **Shared domain + protocol types live in `kousoku`.** WS message types
  (`Shinkou`, `Oshaberi`, `Danmaku` payloads), `Enmoku`, `Bushitsu`, `Buin`,
  roles. Never redefine these in the frontend — import them.
- **Component-local types** (a view-model, a prop combo with no domain meaning)
  may live next to the component. The moment a type describes a domain concept,
  move it to `kousoku`.
- One word, one type: the §13 dictionary maps a concept to exactly one type name
  across both packages. No `Member` alias for `Buin`.

---

## Validation

- The **WS envelope and REST bodies are validated by TypeBox on the server**
  (single source of runtime truth). The frontend trusts the contract types and
  does not re-implement schema validation for server-originated messages.
- For genuinely untrusted *client-side* input that is not covered by the
  server's TypeBox schema (e.g. a user-uploaded danmaku file before it is sent to
  kokuban), validate shape explicitly before use; do not assume.
- Keep TypeBox `Static<typeof Schema>` types and the kousoku TS types aligned —
  the envelope type the frontend sends must be the one the server validates.

---

## Common Patterns

- Use `Static<>` to derive TS types from TypeBox schemas where the schema is the
  source; otherwise hand-written interfaces in `kousoku`.
- **Discriminated union on the WS envelope `type` field** so handling a message
  narrows the payload:
  ```ts
  function handle(msg: KousokuMessage) {
    switch (msg.type) {
      case "SHINKOU": apply(msg.payload); break   // payload narrowed to Shinkou
      case "GENJOU":  catchUp(msg.payload); break  // 現状：authority state
    }
  }
  ```
- Prefer `type` guards and exhaustive `switch` (with a `never` default) so a new
  envelope type added in kousoku surfaces as a compile error here.

---

## Forbidden Patterns

- **`any`** — use `unknown` + narrowing, or fix the contract type in kousoku.
- **Type assertions (`as`) to silence the Eden/TypeBox contract.** If the client
  call does not type-check, the contract changed; update kousoku, do not cast.
- **Redefining shared types locally** instead of importing from `kousoku`.
- **`@ts-ignore` / `@ts-expect-error`** to ship — fix the type. (A documented,
  justified `@ts-expect-error` around a known third-party gap is the only
  exception, with a comment saying why.)
- **CJK identifiers** in type names; 汉字 stays in comments (design §12).
