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

export type MediaFilenameWarning =
  | "empty-filename"
  | "missing-work"
  | "conflicting-season"
  | "conflicting-episode"
  | "episode-range"

/**
 * Safe, provider-neutral hints extracted from one concrete media filename.
 * `normalized` is derived from the basename only; callers must not use this
 * value as a release identity or as proof of an episode match.
 */
export type ParsedMediaFilename = {
  normalized: string
  work?: string
  season?: number
  episode?: number
  group?: string
  releaseHints: string[]
  warnings: MediaFilenameWarning[]
}

export type FilenameEvidence = {
  kind: "filename"
  work?: string
  season?: number
  episode?: number
  group?: string
}

export type MediaReleaseMatchInput = {
  fileName?: string
  size?: number
  duration?: number
}

export type MediaEpisodeMatchCandidate = {
  id: string
  title: string
  season?: number
  episode?: number
  size?: number
  duration?: number
}

export type MediaMatchField = "work" | "season" | "episode" | "size" | "duration"
export type MediaMatchEvidenceStatus = "matched" | "mismatched" | "missing" | "unavailable"

export type MediaMatchContribution = {
  field: MediaMatchField
  status: MediaMatchEvidenceStatus
  weight: number
  points: number
  detail: string
}

export type MediaMatchConfidence = "suggested" | "ambiguous" | "none"

export type MediaEpisodeMatch = {
  candidateId: string
  score: number
  confidence: MediaMatchConfidence
  requiresConfirmation: true
  contributions: MediaMatchContribution[]
  mismatches: string[]
  warnings: MediaFilenameWarning[]
}

const WORK_WEIGHT = 50
const SEASON_WEIGHT = 15
const EPISODE_WEIGHT = 25
const SIZE_WEIGHT = 5
const DURATION_WEIGHT = 5
const DURATION_TOLERANCE_SECONDS = 2
const MAX_FILENAME_EVIDENCE_TEXT = 256
const MAX_MATCH_DETAIL_TEXT = 512

const TECHNICAL_HINT_PATTERN =
  /^(?:\d{3,4}p|\d{3,4}x\d{3,4}|\d+k|4k|8k|web[ -]?(?:dl|rip)|bluray|bd(?:rip)?|dvdrip|hdtv|x26[45]|h\.?26[45]|hevc|av1|aac|flac|opus|10bit|8bit|hdr|dolby|proper|repack|batch|uncensored|remux|crf\d+)$/i

const TECHNICAL_HINT_TOKEN_PATTERN =
  /\b(?:\d{3,4}p|\d{3,4}x\d{3,4}|\d+k|web[ -]?(?:dl|rip)|bluray|bd(?:rip)?|dvdrip|hdtv|x26[45]|h\.?26[45]|hevc|av1|aac|flac|opus|10bit|8bit|hdr|dolby|proper|repack|batch|uncensored|remux|crf\d+)\b/gi

const SEASON_EPISODE_PATTERN = /(?:^|[\s._-])s(?:eason)?\s*(\d{1,2})\s*(?:e|x)\s*(\d{1,3})(?!\d)/gi
const SEASON_EPISODE_WORD_PATTERN = /(?:^|[\s._-])season\s*(\d{1,2})\s*episode\s*(\d{1,3})(?!\d)/gi
const EPISODE_WORD_PATTERN = /(?:^|[\s._-])e(?:pisode)?\s*(\d{1,3})(?!\d)/gi
const CJK_EPISODE_PATTERN = /第\s*(\d{1,3})\s*[集话話]/gi

type EpisodeToken = {
  season?: number
  episode: number
  rangeEnd?: number
}

/**
 * Parse a noisy media filename without retaining its path. The parser is
 * intentionally conservative around numeric tokens: technical values such as
 * 1080p are release hints, while conflicting or multi-episode tokens are not
 * promoted to a single episode number.
 */
export function parseMediaFilename(fileName: string): ParsedMediaFilename {
  const basename = filenameBasename(fileName)
  if (!basename) {
    return {
      normalized: "",
      releaseHints: [],
      warnings: ["empty-filename", "missing-work"],
    }
  }

  const withoutExtension = removeFilenameExtension(basename)
  const normalizedInput = withoutExtension
    .replace(/[【】]/g, (value) => (value === "【" ? "[" : "]"))
    .replace(/[［］]/g, (value) => (value === "［" ? "[" : "]"))
    .trim()
  const normalized = normalizeTitleText(normalizedInput)
  const bracketTokens = extractBracketTokens(normalizedInput)
  const group = firstGroupHint(normalizedInput, bracketTokens)
  const releaseHints = [...new Set(bracketTokens.flatMap((token) => releaseHintsFrom(token.value)))]
  for (const match of normalizedInput.matchAll(TECHNICAL_HINT_TOKEN_PATTERN)) {
    const hint = canonicalHint(match[0])
    if (hint && !releaseHints.includes(hint)) releaseHints.push(hint)
  }

  const episodeTokens: EpisodeToken[] = []
  collectSeasonEpisodeTokens(normalizedInput, episodeTokens)
  collectWordEpisodeTokens(normalizedInput, episodeTokens)
  collectCjkEpisodeTokens(normalizedInput, episodeTokens)
  collectBracketEpisodeTokens(bracketTokens, episodeTokens)

  const withoutBrackets = normalizedInput.replace(/\[[^\]]*\]|\([^)]*\)/g, " ")
  const rangeMatch = /(?:^|[\s._-])(\d{1,3})\s*[-~]\s*(\d{1,3})\s*$/u.exec(withoutBrackets)
  if (rangeMatch?.[1] && rangeMatch[2]) {
    const start = Number.parseInt(rangeMatch[1], 10)
    const end = Number.parseInt(rangeMatch[2], 10)
    if (isEpisodeNumber(start) && isEpisodeNumber(end)) {
      episodeTokens.push({ episode: start, rangeEnd: end })
    }
  } else {
    const trailingMatch = /(?:^|[\s._-])(\d{1,3})\s*$/u.exec(withoutBrackets)
    if (trailingMatch?.[1]) {
      const episode = Number.parseInt(trailingMatch[1], 10)
      if (isEpisodeNumber(episode)) episodeTokens.push({ episode })
    }
  }

  let workText = withoutBrackets
  workText = workText.replace(SEASON_EPISODE_PATTERN, " ")
  workText = workText.replace(SEASON_EPISODE_WORD_PATTERN, " ")
  workText = workText.replace(EPISODE_WORD_PATTERN, " ")
  workText = workText.replace(CJK_EPISODE_PATTERN, " ")
  if (rangeMatch) workText = workText.replace(rangeMatch[0], " ")
  else {
    const trailingMatch = /(?:^|[\s._-])(\d{1,3})\s*$/u.exec(workText)
    if (trailingMatch) workText = workText.slice(0, trailingMatch.index).trim()
  }
  workText = workText.replace(TECHNICAL_HINT_TOKEN_PATTERN, " ")
  if (group) {
    const groupPattern = new RegExp(`^\\s*${escapeRegExp(group.source)}\\s*`, "iu")
    workText = workText.replace(groupPattern, " ")
  }

  const work = normalizeTitleText(workText)
  const warnings: MediaFilenameWarning[] = []
  const seasons = uniqueNumbers(
    episodeTokens.flatMap((token) => (token.season === undefined ? [] : [token.season])),
  )
  const episodes = uniqueNumbers(episodeTokens.map((token) => token.episode))
  const ranges = episodeTokens.filter((token) => token.rangeEnd !== undefined)
  if (seasons.length > 1) warnings.push("conflicting-season")
  if (episodes.length > 1) warnings.push("conflicting-episode")
  if (ranges.length > 0) warnings.push("episode-range")
  if (!work) warnings.push("missing-work")

  return {
    normalized,
    ...(work ? { work } : {}),
    ...(seasons.length === 1 ? { season: seasons[0] } : {}),
    ...(episodes.length === 1 && ranges.length === 0 ? { episode: episodes[0] } : {}),
    ...(group ? { group: group.value } : {}),
    releaseHints,
    warnings,
  }
}

/** Alias with a name that highlights the privacy-safe normalization boundary. */
export const normalizeMediaFilename = parseMediaFilename

/** Convert parsed filename hints to the shared, persistable evidence shape. */
export function extractFilenameEvidence(fileName: string): FilenameEvidence {
  const parsed = parseMediaFilename(fileName)
  return {
    kind: "filename",
    ...(parsed.work ? { work: parsed.work.slice(0, MAX_FILENAME_EVIDENCE_TEXT) } : {}),
    ...(parsed.season === undefined ? {} : { season: parsed.season }),
    ...(parsed.episode === undefined ? {} : { episode: parsed.episode }),
    ...(parsed.group ? { group: parsed.group.slice(0, MAX_FILENAME_EVIDENCE_TEXT) } : {}),
  }
}

/**
 * Score release candidates using bounded, explainable evidence. A result is
 * never an exact authorization: callers must confirm every unseen release.
 */
export function scoreMediaReleaseCandidate(
  observed: MediaReleaseMatchInput,
  candidate: MediaEpisodeMatchCandidate,
): MediaEpisodeMatch {
  const parsed = parseMediaFilename(observed.fileName ?? "")
  const contributions: MediaMatchContribution[] = [
    compareWork(parsed.work, candidate.title),
    compareNumber("season", parsed.season, candidate.season, SEASON_WEIGHT),
    compareNumber("episode", parsed.episode, candidate.episode, EPISODE_WEIGHT),
    compareSize(observed.size, candidate.size),
    compareDuration(observed.duration, candidate.duration),
  ]
  const score = contributions.reduce((total, item) => total + item.points, 0)
  const mismatches = contributions
    .filter((item) => item.status === "mismatched")
    .map((item) => item.detail)
  const confidence: MediaMatchConfidence =
    parsed.warnings.length > 0 || mismatches.length > 0
      ? score >= 70 && mismatches.length === 0
        ? "ambiguous"
        : "none"
      : score >= 70
        ? "suggested"
        : score >= 30
          ? "ambiguous"
          : "none"
  return {
    candidateId: candidate.id,
    score,
    confidence,
    requiresConfirmation: true,
    contributions,
    mismatches,
    warnings: parsed.warnings,
  }
}

/** Rank candidates deterministically by score, then confidence, then id. */
export function rankMediaReleaseCandidates(
  observed: MediaReleaseMatchInput,
  candidates: readonly MediaEpisodeMatchCandidate[],
): MediaEpisodeMatch[] {
  const confidenceRank: Record<MediaMatchConfidence, number> = {
    suggested: 2,
    ambiguous: 1,
    none: 0,
  }
  return candidates
    .map((candidate) => scoreMediaReleaseCandidate(observed, candidate))
    .sort(
      (left, right) =>
        right.score - left.score ||
        confidenceRank[right.confidence] - confidenceRank[left.confidence] ||
        left.candidateId.localeCompare(right.candidateId),
    )
}

type BracketToken = { value: string; source: string; index: number }

function filenameBasename(value: string): string {
  const normalized = value.normalize("NFKC").replaceAll("\\", "/")
  return (normalized.split("/").pop() ?? "").trim()
}

function removeFilenameExtension(value: string): string {
  return value.replace(/\.[a-z0-9]{1,8}$/iu, "")
}

function extractBracketTokens(value: string): BracketToken[] {
  const tokens: BracketToken[] = []
  const pattern = /\[([^\]]+)\]|\(([^)]+)\)/gu
  for (const match of value.matchAll(pattern)) {
    const token = (match[1] ?? match[2] ?? "").trim()
    if (token && match.index !== undefined) {
      tokens.push({ value: token, source: match[0], index: match.index })
    }
  }
  return tokens
}

function firstGroupHint(value: string, tokens: readonly BracketToken[]): BracketToken | undefined {
  const first = tokens.find((token) => value.slice(0, token.index).trim() === "")
  if (!first || isTechnicalHint(first.value) || isEpisodeTag(first.value)) return undefined
  return first
}

function releaseHintsFrom(value: string): string[] {
  const direct = canonicalHint(value)
  if (isTechnicalHint(value)) return direct ? [direct] : []
  return [...value.matchAll(TECHNICAL_HINT_TOKEN_PATTERN)].flatMap((match) => {
    const hint = canonicalHint(match[0])
    return hint ? [hint] : []
  })
}

function isTechnicalHint(value: string): boolean {
  return TECHNICAL_HINT_PATTERN.test(value.trim())
}

function isEpisodeTag(value: string): boolean {
  return (
    /^\d{1,3}(?:\s*[-~]\s*\d{1,3})?$/.test(value.trim()) ||
    /(?:^|\s)s(?:eason)?\s*\d{1,2}\s*(?:e|x)\s*\d{1,3}(?:$|\s)/i.test(value)
  )
}

function canonicalHint(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[._\s]+/g, "-")
}

function normalizeTitleText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[._]+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
}

function titleKey(value: string): string {
  return normalizeTitleText(value).replace(/[\s\p{P}]+/gu, "")
}

function collectSeasonEpisodeTokens(value: string, output: EpisodeToken[]): void {
  for (const match of value.matchAll(SEASON_EPISODE_PATTERN)) {
    if (match[1] && match[2]) {
      output.push({ season: Number.parseInt(match[1], 10), episode: Number.parseInt(match[2], 10) })
    }
  }
  for (const match of value.matchAll(SEASON_EPISODE_WORD_PATTERN)) {
    if (match[1] && match[2]) {
      output.push({ season: Number.parseInt(match[1], 10), episode: Number.parseInt(match[2], 10) })
    }
  }
}

function collectWordEpisodeTokens(value: string, output: EpisodeToken[]): void {
  for (const match of value.matchAll(EPISODE_WORD_PATTERN)) {
    if (match[1]) output.push({ episode: Number.parseInt(match[1], 10) })
  }
}

function collectCjkEpisodeTokens(value: string, output: EpisodeToken[]): void {
  for (const match of value.matchAll(CJK_EPISODE_PATTERN)) {
    if (match[1]) output.push({ episode: Number.parseInt(match[1], 10) })
  }
}

function collectBracketEpisodeTokens(
  tokens: readonly BracketToken[],
  output: EpisodeToken[],
): void {
  for (const token of tokens) {
    const match = /^(\d{1,3})(?:\s*[-~]\s*(\d{1,3}))?$/.exec(token.value)
    if (!match?.[1]) continue
    const episode = Number.parseInt(match[1], 10)
    const rangeEnd = match[2] ? Number.parseInt(match[2], 10) : undefined
    if (!isEpisodeNumber(episode) || (rangeEnd !== undefined && !isEpisodeNumber(rangeEnd)))
      continue
    output.push({ episode, ...(rangeEnd === undefined ? {} : { rangeEnd }) })
  }
}

function isEpisodeNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 999
}

function uniqueNumbers(values: readonly number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function compareWork(observed: string | undefined, candidateTitle: string): MediaMatchContribution {
  if (!observed) {
    return {
      field: "work",
      status: "missing",
      weight: WORK_WEIGHT,
      points: 0,
      detail: "filename work is missing",
    }
  }
  const expected = normalizeTitleText(candidateTitle)
  if (titleKey(observed) === titleKey(expected)) {
    return {
      field: "work",
      status: "matched",
      weight: WORK_WEIGHT,
      points: WORK_WEIGHT,
      detail: "work title matches",
    }
  }
  return {
    field: "work",
    status: "mismatched",
    weight: WORK_WEIGHT,
    points: 0,
    detail: `work title differs: ${observed} ≠ ${expected}`.slice(0, MAX_MATCH_DETAIL_TEXT),
  }
}

function compareNumber(
  field: "season" | "episode",
  observed: number | undefined,
  expected: number | undefined,
  weight: number,
): MediaMatchContribution {
  if (observed === undefined) {
    return { field, status: "missing", weight, points: 0, detail: `${field} evidence is missing` }
  }
  if (expected === undefined) {
    return {
      field,
      status: "unavailable",
      weight,
      points: 0,
      detail: `candidate ${field} is unavailable`,
    }
  }
  if (observed === expected) {
    return { field, status: "matched", weight, points: weight, detail: `${field} matches` }
  }
  return {
    field,
    status: "mismatched",
    weight,
    points: 0,
    detail: `${field} differs: ${observed} ≠ ${expected}`,
  }
}

function compareSize(
  observed: number | undefined,
  expected: number | undefined,
): MediaMatchContribution {
  if (observed === undefined) {
    return {
      field: "size",
      status: "missing",
      weight: SIZE_WEIGHT,
      points: 0,
      detail: "size evidence is missing",
    }
  }
  if (expected === undefined) {
    return {
      field: "size",
      status: "unavailable",
      weight: SIZE_WEIGHT,
      points: 0,
      detail: "candidate size is unavailable",
    }
  }
  if (isValidNonNegativeNumber(observed) && observed === expected) {
    return {
      field: "size",
      status: "matched",
      weight: SIZE_WEIGHT,
      points: SIZE_WEIGHT,
      detail: "size matches",
    }
  }
  return {
    field: "size",
    status: "mismatched",
    weight: SIZE_WEIGHT,
    points: 0,
    detail: `size differs: ${observed} ≠ ${expected}`,
  }
}

function compareDuration(
  observed: number | undefined,
  expected: number | undefined,
): MediaMatchContribution {
  if (observed === undefined) {
    return {
      field: "duration",
      status: "missing",
      weight: DURATION_WEIGHT,
      points: 0,
      detail: "duration evidence is missing",
    }
  }
  if (expected === undefined) {
    return {
      field: "duration",
      status: "unavailable",
      weight: DURATION_WEIGHT,
      points: 0,
      detail: "candidate duration is unavailable",
    }
  }
  if (
    isValidNonNegativeNumber(observed) &&
    isValidNonNegativeNumber(expected) &&
    Math.abs(observed - expected) <= Math.max(DURATION_TOLERANCE_SECONDS, expected * 0.01)
  ) {
    return {
      field: "duration",
      status: "matched",
      weight: DURATION_WEIGHT,
      points: DURATION_WEIGHT,
      detail: "duration is within tolerance",
    }
  }
  return {
    field: "duration",
    status: "mismatched",
    weight: DURATION_WEIGHT,
    points: 0,
    detail: `duration differs: ${observed} ≠ ${expected}`,
  }
}

function isValidNonNegativeNumber(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}
