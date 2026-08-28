# Hybrid danmaku source selection

## Goal

Let deployments order allowed source classes, room owners persist one
room/Enmoku default, and each viewer apply a personal single-track override
without changing playback or another viewer's selection.

## Requirements

- Allow only a `Komon` to change the deployment-wide allowed source classes and
  their default order; room ownership grants no authority over this policy.
- Apply precedence: valid viewer override, valid room default, deterministic
  deployment strategy result, then no timeline track.
- Allow only the owner to change the room/Enmoku default; ordinary viewers may
  change only their personal override.
- Clearing an override returns to the current room default.
- Show source provenance, selection state, loading, empty, failure, disabled,
  and fallback behavior without making playback depend on danmaku.
- Offer a separate explicit proposal action for an eligible confirmed match;
  ordinary track selection must not submit or promote matcher knowledge.
- Extract source candidates, loading, caching, priority, and active-track state
  from `BushitsuView` into a dedicated timeline-danmaku orchestration boundary.
- Activate one historical/timeline track at a time; realtime room danmaku stays
  a separate overlay.

## Acceptance Criteria

- [x] Owner and viewer sessions demonstrate distinct room-default and personal
  override behavior.
- [x] A late joiner receives the persisted room default.
- [x] Candidate failure falls through without rewriting the stored selection or
  interrupting video playback.
- [x] Desktop and phone browser validation covers candidate selection and all
  defined UI states.
- [x] Selection and public-proposal submission are visibly distinct actions,
  with confirmation and stable success/error feedback.

## Dependencies and Boundaries

- Depends on the identity/storage child contracts.
- Does not fetch or parse provider-specific upstream data.
- Does not merge historical tracks.
