import { expect, test } from "bun:test"
import { Value } from "@sinclair/typebox/value"
import {
  DEFAULT_SITE_CONFIG,
  SiteConfigSchema,
  SiteConfigValidationError,
  normalizeSiteConfig,
} from "../src"

const entry = {
  floorCode: "3F",
  floorLabel: "文化部楼层",
  hint: "沿走廊前行。",
  privacyNote: "只显示你已知的教室。",
  defaultBushitsuName: "动画研究会",
}

test("site config resolves optional public identity values and freezes the result", () => {
  const config = normalizeSiteConfig({ site: { name: "社团活动室" }, entry })

  expect(config).toEqual({
    site: { name: "社团活动室", subtitle: null, browserTitle: "社团活动室" },
    entry,
  })
  expect(Value.Check(SiteConfigSchema, config)).toBe(true)
  expect(Object.isFrozen(config)).toBe(true)
  expect(Object.isFrozen(config.site)).toBe(true)
  expect(Object.isFrozen(config.entry)).toBe(true)
})

test("site config preserves configured subtitle and browser title", () => {
  const config = normalizeSiteConfig({
    site: { name: "第三文化部室", subtitle: "Quiet Club", browserTitle: "今晚的放映室" },
    entry,
  })

  expect(config.site).toEqual({
    name: "第三文化部室",
    subtitle: "Quiet Club",
    browserTitle: "今晚的放映室",
  })
})

test("default site config is a valid immutable transport fallback", () => {
  expect(Value.Check(SiteConfigSchema, DEFAULT_SITE_CONFIG)).toBe(true)
  expect(DEFAULT_SITE_CONFIG.site).toEqual({
    name: "社团活动室",
    subtitle: null,
    browserTitle: "社团活动室",
  })
  expect(Object.isFrozen(DEFAULT_SITE_CONFIG)).toBe(true)
})

test.each([
  ["unknown root field", { site: { name: "活动室" }, entry, extra: true }, "/extra"],
  ["unknown nested field", { site: { name: "活动室", extra: true }, entry }, "/site/extra"],
  [
    "missing field",
    { site: { name: "活动室" }, entry: { ...entry, hint: undefined } },
    "/entry/hint",
  ],
  ["empty field", { site: { name: "" }, entry }, "/site/name"],
  ["untrimmed field", { site: { name: " 活动室" }, entry }, "/site/name"],
  ["multiline field", { site: { name: "活动室\n三楼" }, entry }, "/site/name"],
  ["control field", { site: { name: "活动室\u0007" }, entry }, "/site/name"],
])("site config rejects %s", (_name, value, field) => {
  try {
    normalizeSiteConfig(value)
    throw new Error("expected validation failure")
  } catch (error) {
    expect(error).toBeInstanceOf(SiteConfigValidationError)
    expect((error as SiteConfigValidationError).field).toBe(field)
  }
})
