# Room control policy — design

## Scope

This slice turns the existing room-wide `Kengen` booleans into a durable,
understandable policy. The wire shape stays `{ playback, chat, playlist }`; no
new role or client-supplied authority is introduced.

The three host-facing presets are:

| Preset | chat | playback | playlist |
| --- | --- | --- | --- |
| Only chat | true | false | false |
| Shared playback | true | true | false |
| Shared source selection | true | true | true |

Any other three-boolean combination is a custom policy. Reorder and
clear-pending do not map to a `Kengen` action and remain exact owner checks.

## Persistence and server authority

Add nullable `kengen_json` to `bushitsu`. New and legacy null rows resolve to
`{ playback: false, chat: true, playlist: false }` until the owner saves a
policy; malformed JSON takes the same safe fallback.

A dedicated query boundary reads and writes the record. `getKengen(roomId)` may
use a process cache, but its cache miss must read durable storage; `setKengen`
writes durable storage before returning the new authoritative snapshot. A cache
clear simulates a restarted process and must still return the stored value.

`SETTEI` remains owner-only and unchanged on the wire. After persistence it
broadcasts exactly one server-stamped `KENGEN` snapshot through the admitted
room topic and echoes it to the sender. All existing WS and REST gates continue
to call `canDo`; queue move/clear keep their separate exact-owner REST gate.

## Client model and interaction

`KengenPanel` remains the shared room-information panel. Every admitted viewer
gets a concise read-only policy summary. The owner additionally sees a labelled
three-option preset radio group and a collapsed advanced `<details>` section
containing the existing three switch buttons.

- Selecting a preset or changing a switch sends the full existing `SETTEI`
  payload; the UI waits for `KENGEN` rather than committing a local policy.
- The preset group derives selected state by equality with the three constants;
  a non-matching policy announces and labels itself as custom.
- Keep controls as real buttons/radio semantics, visible focus, 44px touch
  targets, text labels for state, and document-order keyboard navigation.
- On portrait phones presets stack before advanced settings; no hover-only or
  drag interaction is introduced.

## Migration and rollback

`schema.sql` creates `kengen_json` for fresh databases; `db/client.ts` performs
the same guarded additive column upgrade for existing authenticated databases.
Null legacy rows retain the existing safe only-chat behaviour. Rolling back to
the previous release ignores the nullable column; the persisted policy becomes
effective again once this release returns.

## Risks and test plan

The main risk is confusing client visibility with authority. Tests must assert
the database fallback/restart path, owner-only SETTEI, one snapshot convergence,
member server rejection, queue-management non-delegation, and desktop/phone
keyboard-visible UI states. The browser suite must exercise a persisted policy
after reconnect/reload using real authenticated sessions.
