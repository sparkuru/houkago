export function isCurrentEnmoku(enmokuId: string, currentEnmokuId: string | null): boolean {
  return enmokuId === currentEnmokuId
}

export function canPlayBangumiItem(canPlaylist: boolean): boolean {
  return canPlaylist
}

export function canCancelBangumiItem(
  canPlaylist: boolean,
  enmokuId: string,
  currentEnmokuId: string | null,
): boolean {
  return canPlaylist && isCurrentEnmoku(enmokuId, currentEnmokuId)
}

export function canDeleteBangumiItem(
  canPlaylist: boolean,
  enmokuId: string,
  currentEnmokuId: string | null,
): boolean {
  return canPlaylist && !isCurrentEnmoku(enmokuId, currentEnmokuId)
}

export function canMoveBangumiItem(
  isBuchou: boolean,
  index: number,
  count: number,
  direction: "up" | "down",
): boolean {
  if (!isBuchou) return false
  return direction === "up" ? index > 0 : index < count - 1
}

export function canClearPendingBangumi(isBuchou: boolean, pendingCount: number): boolean {
  return isBuchou && pendingCount > 0
}
