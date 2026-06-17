import type { Bushitsu, Enmoku } from "houkago-kousoku"
import { getBushitsu, insertBushitsu } from "../db/queries/bushitsu"
import { deleteEnmoku, insertEnmoku, listEnmoku } from "../db/queries/enmoku"
import { BushitsuNotFound, EnmokuNotFound } from "../lib/errors"
import { newId } from "../lib/id"

// BushitsuKanri（部室管理）: room lifecycle + enmoku metadata. Pure orchestration;
// validation happens at the transport edge, I/O lives in db/.

// 部室を作る：create a room. The creator's buin id becomes 部長 (design §5).
export function createBushitsu(name: string, buchouId: string): Bushitsu {
  const bushitsu: Bushitsu = {
    id: newId(),
    name,
    buchouId,
    createdAt: Date.now(),
  }
  insertBushitsu(bushitsu)
  return bushitsu
}

// 部室を取る：fetch a room or throw BushitsuNotFound.
export function fetchBushitsu(id: string): Bushitsu {
  const bushitsu = getBushitsu(id)
  if (!bushitsu) throw new BushitsuNotFound(id)
  return bushitsu
}

// 部長 id without throwing: the WS hub needs the host id to label roles + gate
// permissions on every message, but a connection may target a room that does not
// exist in the DB (scaffold / direct WS). Returning null there keeps the hub
// alive (no host → everyone is a guest, default kengen applies) instead of
// killing the message with a thrown BushitsuNotFound.
export function buchouIdOf(id: string): string | null {
  return getBushitsu(id)?.buchouId ?? null
}

// 演目を投稿する：add a direct-link enmoku to a room.
export function addEnmoku(
  bushitsuId: string,
  input: { title: string; type: Enmoku["type"]; url: string; addedBy: string },
): Enmoku {
  fetchBushitsu(bushitsuId) // ensure the room exists
  const enmoku: Enmoku = {
    id: newId(),
    bushitsuId,
    title: input.title,
    type: input.type,
    url: input.url,
    addedBy: input.addedBy,
  }
  insertEnmoku(enmoku, Date.now())
  return enmoku
}

// 番組表：a room's enmoku queue.
export function fetchBangumi(bushitsuId: string): Enmoku[] {
  fetchBushitsu(bushitsuId)
  return listEnmoku(bushitsuId)
}

// 演目を消す：delete a queued Enmoku from a room.
export function removeEnmoku(bushitsuId: string, enmokuId: string): { ok: true } {
  fetchBushitsu(bushitsuId)
  if (!deleteEnmoku(bushitsuId, enmokuId)) throw new EnmokuNotFound(enmokuId)
  return { ok: true }
}
