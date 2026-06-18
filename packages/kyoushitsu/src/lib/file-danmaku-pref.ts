const KEY = "houkago:file-danmaku-enabled"

export function loadFileDanmakuEnabled(): boolean {
  return localStorage.getItem(KEY) === "1"
}

export function saveFileDanmakuEnabled(enabled: boolean): void {
  localStorage.setItem(KEY, enabled ? "1" : "0")
}
