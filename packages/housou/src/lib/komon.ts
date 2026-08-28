import type { Seito } from "houkago-kousoku"
import { db } from "../db/client"
import { insertDanmakuAudit } from "../db/queries/danmaku-audit"
import {
  findActiveKomonBySeitoId,
  findKomonBySeitoId,
  insertKomonGrant,
  restoreKomonGrant,
  revokeKomonGrant,
} from "../db/queries/komon"
import { findSeitoById } from "../db/queries/seito"
import { Forbidden, KomonRequired } from "./errors"
import { newId } from "./id"
import { requireTrustedOrigin } from "./origin"
import { seitoFromRequest } from "./seitoshou"

export function isKomon(seitoId: string): boolean {
  return findActiveKomonBySeitoId(seitoId) !== null
}

export function requireKomon(request: Request): Seito
export function requireKomon(seitoId: string): Seito
export function requireKomon(value: Request | string): Seito {
  const seito = typeof value === "string" ? findSeitoById(value) : seitoFromRequest(value)
  if (!seito || !isKomon(seito.id)) {
    throw new KomonRequired("active Komon authority is required")
  }
  return seito
}

export function requireKomonRequest(request: Request): Seito {
  requireTrustedOrigin(request.headers.get("origin"))
  return requireKomon(request)
}

export function grantKomon(actorSeitoId: string, targetSeitoId: string, now = Date.now()): void {
  if (!isKomon(actorSeitoId)) throw new KomonRequired("active Komon authority is required")
  if (!findSeitoById(targetSeitoId)) throw new Forbidden("target account does not exist")
  const existing = findKomonBySeitoId(targetSeitoId)
  if (existing && existing.revokedAt === undefined) return
  db.transaction(() => {
    if (!existing) {
      insertKomonGrant({
        id: newId(),
        seitoId: targetSeitoId,
        grantedAt: now,
        grantedBy: actorSeitoId,
      })
    } else {
      restoreKomonGrant(targetSeitoId)
    }
    insertDanmakuAudit({
      id: newId(),
      action: existing?.revokedAt === undefined ? "komon_granted" : "komon_restored",
      actorSeitoId,
      subjectType: "komon",
      subjectId: targetSeitoId,
      details: { targetSeitoId },
      createdAt: now,
    })
  })()
}

export function revokeKomon(actorSeitoId: string, targetSeitoId: string, now = Date.now()): void {
  if (!isKomon(actorSeitoId)) throw new KomonRequired("active Komon authority is required")
  db.transaction(() => {
    if (!revokeKomonGrant(targetSeitoId, now)) throw new Forbidden("Komon grant is not active")
    insertDanmakuAudit({
      id: newId(),
      action: "komon_revoked",
      actorSeitoId,
      subjectType: "komon",
      subjectId: targetSeitoId,
      details: { targetSeitoId },
      dedupeKey: `komon-revoked:${targetSeitoId}:${now}`,
      createdAt: now,
    })
  })()
}
