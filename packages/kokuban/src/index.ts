export type DanmakuMode = "scroll" | "top" | "bottom" | "reverse" | "special"

export type DanmakuCue = {
  time: number
  text: string
  color?: string
  mode: DanmakuMode
}

const DEFAULT_COLOR = "#ffffff"

function decodeXmlText(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g, (_, entity: string) => {
    switch (entity) {
      case "amp":
        return "&"
      case "lt":
        return "<"
      case "gt":
        return ">"
      case "quot":
        return '"'
      case "apos":
        return "'"
      default: {
        const radix = entity.startsWith("#x") ? 16 : 10
        const raw = entity.startsWith("#x") ? entity.slice(2) : entity.slice(1)
        const codePoint = Number.parseInt(raw, radix)
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : ""
      }
    }
  })
}

function normalizeText(text: string): string {
  const cdata = text.match(/^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/)
  return decodeXmlText(cdata?.[1] ?? text).trim()
}

function normalizeColor(raw: string | undefined): string | undefined {
  if (!raw) return DEFAULT_COLOR
  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value) || value < 0 || value > 0xffffff) return DEFAULT_COLOR
  return `#${value.toString(16).padStart(6, "0")}`
}

function modeFromBilibili(raw: string | undefined): DanmakuMode {
  switch (raw) {
    case "4":
      return "bottom"
    case "5":
      return "top"
    case "6":
      return "reverse"
    case "7":
    case "8":
    case "9":
      return "special"
    default:
      return "scroll"
  }
}

function parseCue(p: string, text: string): DanmakuCue | null {
  const parts = p.split(",")
  const time = Number.parseFloat(parts[0] ?? "")
  if (!Number.isFinite(time) || time < 0) return null

  const normalizedText = normalizeText(text)
  if (!normalizedText) return null

  return {
    time,
    text: normalizedText,
    color: normalizeColor(parts[3]),
    mode: modeFromBilibili(parts[1]),
  }
}

export function parseBilibiliXml(input: string): DanmakuCue[] {
  const lines: DanmakuCue[] = []
  const pattern = /<d\b[^>]*\bp=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/d>/g

  for (const match of input.matchAll(pattern)) {
    const p = match[2]
    const text = match[3]
    if (!p || text === undefined) continue
    const cue = parseCue(p, text)
    if (cue) lines.push(cue)
  }

  return lines.sort((a, b) => a.time - b.time)
}
