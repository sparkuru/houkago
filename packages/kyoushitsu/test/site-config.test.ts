import { expect, test } from "bun:test"
import { DEFAULT_SITE_CONFIG } from "houkago-kousoku"
import { applySiteConfigTitle, createSiteConfigLoader } from "../src/lib/site-config"

const customConfig = {
  site: {
    name: "第三文化部室",
    subtitle: "Quiet Club",
    browserTitle: "今晚的放映室",
  },
  entry: {
    floorCode: "3F",
    floorLabel: "文化部楼层",
    hint: "沿走廊前行。",
    privacyNote: "只显示已知教室。",
    defaultBushitsuName: "动画研究会",
  },
}

test("frontend loader normalizes one successful request and memoizes it", async () => {
  let requests = 0
  const load = createSiteConfigLoader(async () => {
    requests += 1
    return { data: customConfig, error: null }
  })

  const [first, second] = await Promise.all([load(), load()])
  expect(first).toEqual(customConfig)
  expect(second).toBe(first)
  expect(requests).toBe(1)
  expect(Object.isFrozen(first)).toBe(true)
})

test("frontend loader uses the shared fallback and emits a value-free warning", async () => {
  const warnings: string[] = []
  const load = createSiteConfigLoader(
    async () => {
      throw new Error("secret transport detail")
    },
    (message) => warnings.push(message),
  )

  expect(await load()).toBe(DEFAULT_SITE_CONFIG)
  expect(warnings).toEqual(["Public site configuration is unavailable; using built-in defaults."])
  expect(warnings.join(" ")).not.toContain("secret transport detail")
})

test("frontend loader rejects an invalid response instead of silently defaulting", async () => {
  const warnings: string[] = []
  const load = createSiteConfigLoader(
    async () => ({ data: { site: { name: "partial" } }, error: null }),
    (message) => warnings.push(message),
  )

  expect(load()).rejects.toThrow("/entry")
  expect(warnings).toEqual([])
})

test("browser title follows the loaded public config", () => {
  const target = { title: "old title" }
  applySiteConfigTitle(customConfig, target)
  expect(target.title).toBe("今晚的放映室")
})
