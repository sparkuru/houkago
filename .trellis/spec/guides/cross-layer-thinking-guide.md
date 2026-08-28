# Cross-Layer Thinking Guide

> **Purpose**: Think through data flow across layers before implementing.

---

## The Problem

**Most bugs happen at layer boundaries**, not within layers.

Common cross-layer bugs:
- API returns format A, frontend expects format B
- Database stores X, service transforms to Y, but loses data
- Multiple layers implement the same logic differently

---

## Before Implementing Cross-Layer Features

### Step 1: Map the Data Flow

Draw out how data moves:

```
Source → Transform → Store → Retrieve → Transform → Display
```

For each arrow, ask:
- What format is the data in?
- What could go wrong?
- Who is responsible for validation?

### Step 2: Identify Boundaries

| Boundary | Common Issues |
|----------|---------------|
| API ↔ Service | Type mismatches, missing fields |
| Service ↔ Database | Format conversions, null handling |
| Backend ↔ Frontend | Serialization, date formats |
| Component ↔ Component | Props shape changes |

### Step 3: Define Contracts

For each boundary:
- What is the exact input format?
- What is the exact output format?
- What errors can occur?

---

## Common Cross-Layer Mistakes

### Mistake 1: Implicit Format Assumptions

**Bad**: Assuming date format without checking

**Good**: Explicit format conversion at boundaries

### Mistake 2: Scattered Validation

**Bad**: Validating the same thing in multiple layers

**Good**: Validate once at the entry point

### Mistake 3: Leaky Abstractions

**Bad**: Component knows about database schema

**Good**: Each layer only knows its neighbors

---

## Checklist for Cross-Layer Features

Before implementation:
- [ ] Mapped the complete data flow
- [ ] Identified all layer boundaries
- [ ] Defined format at each boundary
- [ ] Decided where validation happens

After implementation:
- [ ] Tested with edge cases (null, empty, invalid)
- [ ] Verified error handling at each boundary
- [ ] Checked data survives round-trip

---

## Media Provider / Player / Danmaku Boundary Checklist

Use this checklist before changing player controls, provider parsing, source
selection, or timeline danmaku. The detailed implementation constraints live in
`../frontend/component-guidelines.md` under "Architecture Boundary: Player, Room
View, Danmaku, Parser".

Before implementation:
- [ ] Identify whether the change belongs to provider parsing (`eisha`), room
  orchestration (`housou` / `BushitsuView`), player lifecycle
  (`EnmokuPlayer`), sync authority (`useShinkou`), realtime danmaku
  (`DanmakuOverlay`), or timeline danmaku (`FileDanmakuOverlay` /
  timeline utilities).
- [ ] Confirm provider-specific parsing or upstream fetch behavior is not being
  duplicated in frontend components.
- [ ] Confirm ArtPlayer, hls.js, dash.js, and fullscreen details stay inside
  `EnmokuPlayer`.
- [ ] Confirm playback authority logic reaches the player only through
  `PlayerHandle`, never through an ArtPlayer or `HTMLVideoElement` reference.
- [ ] If `BushitsuView` would gain another provider rule, danmaku source, source
  priority rule, or fetch cache, consider extracting a composable before adding
  more route-level state.
- [ ] Separate a concrete media release/file fingerprint from the canonical
  work/season/episode identity and from the danmaku-track identity. A hash is
  evidence about bytes, not proof that two different encodes are the same
  episode.
- [ ] Record every fingerprint's algorithm and byte scope. For example,
  Dandanplay documents MD5 over the first 16 MiB; a whole-file digest or a
  provider-native digest is not interchangeable with that value.
- [ ] Check where bytes are read. A provider client/adaptor may compute a
  bounded fingerprint from an authorized Range request, but `housou` must not
  pull media bytes merely to fingerprint a source.
- [ ] Treat filename, size, duration, provider reference, fingerprint, and
  third-party results as separately explainable evidence. Filename-only or
  weighted matches must yield candidates rather than silently claiming an
  exact episode.
- [ ] Provide manual search/correction and retain the resulting association's
  trust scope. Personal and room confirmations must not become server-wide
  matcher knowledge without the approved promotion path.

Reference model: the
[Dandanplay open danmaku network guide](https://doc.dandanplay.com/open/)
documents a useful candidate-matching flow: send filename, first-16-MiB MD5,
duration, and size; let the user choose an `episodeId`; persist the
file-to-episode association; and fall back to manual search. Use this as a
reference for evidence and correction flow, not as proof that different
encodes share a fingerprint or as authorization to bulk-copy its database.

After implementation:
- [ ] Verify local file timeline cues still override fetched timeline cues for
  the same `Enmoku.id`.
- [ ] Verify realtime `DANMAKU` overlay behavior is unchanged unless the product
  requirement explicitly targets realtime chat danmaku.
- [ ] Verify provider parser tests cover source/danmaku/provider metadata, and
  frontend tests cover only the consumed domain/view-model behavior.

---

## Cross-Platform Template Consistency

In Trellis, command templates (e.g., `record-session.md`) exist in **multiple platforms** with identical or near-identical content. This is a cross-layer boundary.

### Checklist: After Modifying Any Command Template

- [ ] Find all platforms with the same command: `find src/templates/*/commands/trellis/ -name "<command>.*"`
- [ ] Update all platform copies (Markdown `.md` and TOML `.toml`)
- [ ] For Gemini TOML: adapt line continuations (`\\` vs `\`) and triple-quoted strings
- [ ] Run `/trellis:check-cross-layer` to verify nothing was missed

**Real-world example**: Updated `record-session.md` in Claude to use `--mode record`, but forgot iFlow, Kilo, OpenCode, and Gemini — caught by cross-layer check.

---

## Generated Runtime Template Upgrade Consistency

Some generated files are both documentation and runtime input. In Trellis,
`.trellis/workflow.md` is parsed by `get_context.py`, `workflow_phase.py`,
SessionStart filters, and per-turn hooks. Template changes must be validated
against both fresh init and upgrade paths.

### Checklist: After Modifying A Runtime-Parsed Template

- [ ] Identify every runtime parser that reads the template, not just the file
  writer that installs it
- [ ] Check whether relevant syntax lives outside obvious managed regions
  such as tag blocks
- [ ] Verify fresh `init` output and a versioned `update` scenario that writes
  the older `.trellis/.version`
- [ ] Add an upgrade regression using an older pristine template fixture, then
  assert the installed file reaches the current packaged shape
- [ ] Update the backend spec that owns the runtime contract

**Real-world example**: Codex inline mode changed workflow platform markers from
`[Codex]` / `[Kilo, Antigravity, Windsurf]` to `[codex-sub-agent]` /
`[codex-inline, Kilo, Antigravity, Windsurf]`. Fresh init was correct, but
`trellis update` only merged `[workflow-state:*]` blocks and preserved stale
markers outside those blocks. Result: upgraded projects got new hook scripts
but old workflow routing, so `get_context.py --mode phase --platform codex`
could return empty Phase 2.1 detail.

---

## Mode-Detection Probe Checklist

When a CLI auto-detects a mode by probing a remote resource (e.g., checking if `index.json` exists to decide marketplace vs direct download):

### Before implementing:
- [ ] Probe runs in **ALL** code paths that use the result (interactive, `-y`, `--flag` combos)
- [ ] 404 vs transient error are distinguished — don't treat both as "not found"
- [ ] Transient errors **abort or retry**, never silently switch modes
- [ ] Shared state (caches, prefetched data) is **reset** when context changes (e.g., user switches source)
- [ ] **Shortcut paths** (e.g., `--template` skipping picker) must have the same error-handling quality as the probed path — check that downstream functions don't call catch-all wrappers

### After implementing:
- [ ] Trace every path from probe result to the mode-decision branch — no fallthrough
- [ ] External format contracts (giget URI, raw URLs) are tested or at least documented as comments
- [ ] Metadata reads consume a complete response or use a streaming parser — never parse a fixed-size prefix as full JSON
- [ ] When reconstructing a composite identifier from parsed parts, verify **all** fields are included and in the **correct position** (e.g., `provider:repo/path#ref` not `provider:repo#ref/path`)
- [ ] Verify that **action functions** called after a shortcut don't internally use the old catch-all fetch — they must use the probe-quality variant when error distinction matters

**Real-world example**: Custom registry flow had 8 bugs across 3 review rounds: (1) probe only ran in interactive mode, (2) transient errors fell through to wrong mode, (3) giget URI had `#ref` in wrong position, (4) prefetched templates leaked across source switches, (5) `--template` shortcut bypassed probe but `downloadTemplateById` internally used catch-all `fetchTemplateIndex`, turning timeouts into "Template not found".

**Real-world example**: Agent-session update hints fetched npm `latest` metadata with `response.read(4096)` and then parsed it as complete JSON. The `@mindfoldhq/trellis` package metadata exceeded 4 KB, so the JSON was truncated, parse failed silently, and the first session injection showed no update hint. Fix: read the complete response before parsing, and add a regression where `version` is followed by an 8 KB metadata tail.

---

## When to Create Flow Documentation

Create detailed flow docs when:
- Feature spans 3+ layers
- Multiple teams are involved
- Data format is complex
- Feature has caused bugs before
