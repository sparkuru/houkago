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

export function enmokuSourceChoices(enmoku: Enmoku, primaryLabel: string): EnmokuSourceChoice[] {
  return [
    {
      value: PRIMARY_SOURCE_VALUE,
      label: primaryLabel,
      url: enmoku.url,
      sourceIndex: null,
    },
    ...(enmoku.sources ?? []).map((source, index) => ({
      value: sourceValue(index),
      label: source.name.trim() || `Source ${index + 1}`,
      url: source.url,
      sourceIndex: index,
    })),
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
    hasMetadata: sourceCount > 0 || subtitleNames.length > 0 || enmoku.live !== undefined,
  }
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
