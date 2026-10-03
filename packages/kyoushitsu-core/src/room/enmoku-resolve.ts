import type { Enmoku } from "houkago-kousoku"

// 演目解決：map an authoritative enmokuId (from JOUEI/GENJOU) to the Enmoku in
// the room's 番組表. Pure so the source-sync resolution is testable without a
// store/socket. Returns null when the id is absent (caller then re-fetches the
// 番組表 and resolves again).
export function resolveEnmoku(bangumi: Enmoku[], enmokuId: string | null): Enmoku | null {
  if (!enmokuId) return null
  return bangumi.find((e) => e.id === enmokuId) ?? null
}
