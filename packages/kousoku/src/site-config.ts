import { type Static, Type } from "@sinclair/typebox"
import { Value } from "@sinclair/typebox/value"

const SAFE_VISIBLE_TEXT_PATTERN =
  "^(?!\\s)(?!.*\\s$)[^\\u0000-\\u001f\\u007f-\\u009f\\u2028\\u2029]+$"

const VisibleTextSchema = Type.String({
  minLength: 1,
  maxLength: 256,
  pattern: SAFE_VISIBLE_TEXT_PATTERN,
})

export const SiteConfigSourceSchema = Type.Object(
  {
    site: Type.Object(
      {
        name: VisibleTextSchema,
        subtitle: Type.Optional(Type.Union([VisibleTextSchema, Type.Null()])),
        browserTitle: Type.Optional(VisibleTextSchema),
      },
      { additionalProperties: false },
    ),
    entry: Type.Object(
      {
        floorCode: VisibleTextSchema,
        floorLabel: VisibleTextSchema,
        hint: VisibleTextSchema,
        privacyNote: VisibleTextSchema,
        defaultBushitsuName: VisibleTextSchema,
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
)

export const SiteConfigSchema = Type.Object(
  {
    site: Type.Object(
      {
        name: VisibleTextSchema,
        subtitle: Type.Union([VisibleTextSchema, Type.Null()]),
        browserTitle: VisibleTextSchema,
      },
      { additionalProperties: false },
    ),
    entry: Type.Object(
      {
        floorCode: VisibleTextSchema,
        floorLabel: VisibleTextSchema,
        hint: VisibleTextSchema,
        privacyNote: VisibleTextSchema,
        defaultBushitsuName: VisibleTextSchema,
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
)

type DeepReadonly<T> = {
  readonly [Key in keyof T]: T[Key] extends object ? DeepReadonly<T[Key]> : T[Key]
}

export type SiteConfig = DeepReadonly<Static<typeof SiteConfigSchema>>
type SiteConfigSource = Static<typeof SiteConfigSourceSchema>

export class SiteConfigValidationError extends Error {
  readonly field: string

  constructor(field: string) {
    super(`invalid public site configuration at ${field}`)
    this.name = "SiteConfigValidationError"
    this.field = field
  }
}

function isSiteConfigSource(value: unknown): value is SiteConfigSource {
  return Value.Check(SiteConfigSourceSchema, value)
}

function firstInvalidField(value: unknown): string {
  const issue = Value.Errors(SiteConfigSourceSchema, value).First()
  return issue?.path || "/"
}

export function normalizeSiteConfig(value: unknown): SiteConfig {
  if (!isSiteConfigSource(value)) {
    throw new SiteConfigValidationError(firstInvalidField(value))
  }

  const site = Object.freeze({
    name: value.site.name,
    subtitle: value.site.subtitle ?? null,
    browserTitle: value.site.browserTitle ?? value.site.name,
  })
  const entry = Object.freeze({ ...value.entry })
  return Object.freeze({ site, entry })
}

export const DEFAULT_SITE_CONFIG: SiteConfig = normalizeSiteConfig({
  site: { name: "社团活动室" },
  entry: {
    floorCode: "2F",
    floorLabel: "社团活动楼层",
    hint: "沿着安静的走廊，前往你已经约好的教室。",
    privacyNote: "这里不会展示其他教室。请使用收到的教室号码或邀请链接。",
    defaultBushitsuName: "新部室",
  },
})
