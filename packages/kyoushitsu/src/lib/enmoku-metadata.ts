import type { Enmoku } from "houkago-kousoku"

const PRIMARY_SOURCE_VALUE = "primary"
const SOURCE_VALUE_PREFIX = "source:"

export type EnmokuSourceChoice = {
  value: string
  label: string
  url: string
  sourceIndex: number | null
}

export type EnmokuMetadataSummary = {
  sourceCount: number
  subtitleNames: string[]
  live: boolean | undefined
  hasMetadata: boolean
}

export type ProviderStatKey = "view" | "danmaku" | "reply" | "favorite" | "coin" | "share" | "like"

export type ProviderStatItem = {
  key: ProviderStatKey
  value: number
}

const PROVIDER_STAT_ORDER: ProviderStatKey[] = [
  "view",
  "danmaku",
  "reply",
  "favorite",
  "coin",
  "like",
  "share",
]

export function enmokuSourceChoices(enmoku: Enmoku, primaryLabel: string): EnmokuSourceChoice[] {
  const seen = new Set<string>()
  return [
    {
      value: PRIMARY_SOURCE_VALUE,
      label: primaryLabel,
      url: enmoku.url,
      sourceIndex: null,
    },
    ...(enmoku.sources ?? []).flatMap((source, index) => {
      const label = source.name.trim() || `Source ${index + 1}`
      if (!isBrowserPlayableSourceChoice(label)) return []
      const key = sourceChoiceKey(label)
      if (seen.has(key)) return []
      seen.add(key)
      return [
        {
          value: sourceValue(index),
          label,
          url: source.url,
          sourceIndex: index,
        },
      ]
    }),
  ]
}

export function enmokuPlayableUrl(enmoku: Enmoku, selectedSourceIndex: number | null): string {
  if (selectedSourceIndex === null) return enmoku.url
  return enmoku.sources?.[selectedSourceIndex]?.url ?? enmoku.url
}

export function enmokuMetadataSummary(enmoku: Enmoku): EnmokuMetadataSummary {
  const sourceCount = enmoku.sources?.length ?? 0
  const subtitleNames = Object.keys(enmoku.subtitles ?? {})
  return {
    sourceCount,
    subtitleNames,
    live: enmoku.live,
    hasMetadata:
      sourceCount > 0 || subtitleNames.length > 0 || enmoku.live !== undefined || !!enmoku.provider,
  }
}

export function bilibiliProvider(enmoku: Enmoku): NonNullable<Enmoku["provider"]> | null {
  return enmoku.provider?.kind === "bilibili" ? enmoku.provider : null
}

export function providerStatItems(provider: Enmoku["provider"] | undefined): ProviderStatItem[] {
  const stats = provider?.stats
  if (!stats) return []
  return PROVIDER_STAT_ORDER.flatMap((key) => {
    const value = stats[key]
    return typeof value === "number" ? [{ key, value }] : []
  })
}

export function sourceValue(index: number | null): string {
  return index === null ? PRIMARY_SOURCE_VALUE : `${SOURCE_VALUE_PREFIX}${index}`
}

export function sourceIndexFromValue(value: string): number | null {
  if (value === PRIMARY_SOURCE_VALUE) return null
  if (!value.startsWith(SOURCE_VALUE_PREFIX)) return null

  const index = Number(value.slice(SOURCE_VALUE_PREFIX.length))
  return Number.isInteger(index) && index >= 0 ? index : null
}

function sourceChoiceKey(label: string): string {
  return label
    .replace(/\s+·\s+(avc1|av01|hev1|hvc1|vp09)(?:\.[\w.-]+)?$/i, "")
    .trim()
    .toLowerCase()
}

function isBrowserPlayableSourceChoice(label: string): boolean {
  const codec = label.match(/\s+·\s+([a-z0-9]+)(?:\.[\w.-]+)?$/i)?.[1]?.toLowerCase()
  return codec === undefined || codec === "avc1"
}
