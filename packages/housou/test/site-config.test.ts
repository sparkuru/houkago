import { afterEach, expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DEFAULT_SITE_CONFIG } from "houkago-kousoku"
import { app } from "../src"
import { SITE_CONFIG_PATH, loadSiteConfig } from "../src/lib/site-config"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

async function fixture(contents: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "houkago-site-config-"))
  temporaryDirectories.push(directory)
  const source = join(directory, "config.toml")
  await writeFile(source, contents, "utf8")
  return source
}

const validToml = `
[site]
name = "第三文化部室"
subtitle = "Quiet Club"

[entry]
floorCode = "3F"
floorLabel = "文化部楼层"
hint = "沿着走廊前行。"
privacyNote = "这里只显示已知教室。"
defaultBushitsuName = "动画研究会"
`

test("tracked config uses the shared production default", () => {
  expect(SITE_CONFIG_PATH.endsWith("/config/config.toml")).toBe(true)
  expect(loadSiteConfig()).toEqual(DEFAULT_SITE_CONFIG)
})

test("loader parses, normalizes, and freezes an explicit TOML source", async () => {
  const source = await fixture(validToml)
  const config = loadSiteConfig(source)

  expect(config.site).toEqual({
    name: "第三文化部室",
    subtitle: "Quiet Club",
    browserTitle: "第三文化部室",
  })
  expect(config.entry.defaultBushitsuName).toBe("动画研究会")
  expect(Object.isFrozen(config)).toBe(true)
  expect(Object.isFrozen(config.site)).toBe(true)
  expect(Object.isFrozen(config.entry)).toBe(true)
})

test.each([
  ["malformed", '[site\nname = "secret-value"', "/: malformed TOML"],
  ["duplicate", `${validToml}\n[site]\nname = "secret-value"`, "/: malformed TOML"],
  [
    "unknown",
    validToml.replace('name = "第三文化部室"', 'name = "第三文化部室"\nsecret = "secret-value"'),
    "/site/secret",
  ],
  ["missing", validToml.replace('hint = "沿着走廊前行。"\n', ""), "/entry/hint"],
  ["empty", validToml.replace('name = "第三文化部室"', 'name = ""'), "/site/name"],
  ["untrimmed", validToml.replace('name = "第三文化部室"', 'name = " 第三文化部室"'), "/site/name"],
  [
    "multiline",
    validToml.replace('name = "第三文化部室"', 'name = """第三文化部室\n三楼"""'),
    "/site/name",
  ],
])("loader rejects %s configuration without echoing values", async (_name, contents, field) => {
  const source = await fixture(contents)

  expect(() => loadSiteConfig(source)).toThrow(source)
  expect(() => loadSiteConfig(source)).toThrow(field)
  expect(() => loadSiteConfig(source)).not.toThrow("secret-value")
})

test("loader reports a missing source without leaking filesystem contents", () => {
  const source = join(tmpdir(), `missing-site-config-${crypto.randomUUID()}.toml`)
  expect(() => loadSiteConfig(source)).toThrow(`${source} at /: unable to read source`)
})

test("public route returns only the normalized config and disables HTTP caching", async () => {
  const previousSecret = process.env.HOUKAGO_BAIDU_CLIENT_SECRET
  const previousKey = process.env.HOUKAGO_CREDENTIAL_KEY
  process.env.HOUKAGO_BAIDU_CLIENT_SECRET = "site-config-secret-sentinel"
  process.env.HOUKAGO_CREDENTIAL_KEY = "site-config-key-sentinel"

  try {
    const response = await app.handle(new Request("http://localhost/site-config"))
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(JSON.parse(text)).toEqual(DEFAULT_SITE_CONFIG)
    expect(text).not.toContain("site-config-secret-sentinel")
    expect(text).not.toContain("site-config-key-sentinel")
    expect(text).not.toContain("HOUKAGO_BAIDU_CLIENT_SECRET")
  } finally {
    if (previousSecret === undefined)
      Reflect.deleteProperty(process.env, "HOUKAGO_BAIDU_CLIENT_SECRET")
    else process.env.HOUKAGO_BAIDU_CLIENT_SECRET = previousSecret
    if (previousKey === undefined) Reflect.deleteProperty(process.env, "HOUKAGO_CREDENTIAL_KEY")
    else process.env.HOUKAGO_CREDENTIAL_KEY = previousKey
  }
})
