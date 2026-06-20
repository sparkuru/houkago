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
