import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../../..", import.meta.url))

async function runExportProbe(source: string, env: NodeJS.ProcessEnv = {}) {
  const child = Bun.spawn([process.execPath, "--no-env-file", "-e", source], {
    cwd: root,
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  return { exitCode, stdout, stderr }
}

test("export ignores production DB and credentials without upstream calls or listeners", async () => {
  const directory = await mkdtemp(join(tmpdir(), "houkago-contract-export-"))
  const database = join(directory, "production.db")
  const output = join(directory, "openapi.json")
  await Bun.write(database, "production database must remain untouched")
  try {
    const result = await runExportProbe(
      `
      globalThis.fetch = () => { throw new Error("export made an upstream request") }
      Bun.serve = () => { throw new Error("export started a listener") }
      await import("./packages/housou/src/export-openapi.ts")
      const { app } = await import("./packages/housou/src/index.ts")
      const unexpected = await app.handle(new Request("http://contract.local/eisha/danmaku/%25"))
      if (unexpected.status !== 500 || (await unexpected.json()).error.code !== "INTERNAL")
        throw new Error("existing Eisha unexpected-error behavior changed")
      const { db } = await import("./packages/housou/src/db/client.ts")
      if (process.env.HOUSOU_DB !== ":memory:") throw new Error("non-disposable DB")
      if (process.env.HOUKAGO_BAIDU_CLIENT_SECRET || process.env.HOUKAGO_CREDENTIAL_KEY)
        throw new Error("production credentials leaked into export")
      if (db.query("SELECT COUNT(*) AS count FROM seito").get().count !== 0)
        throw new Error("export unexpectedly initialized accounts")
    `,
      {
        HOUSOU_DB: database,
        HOUKAGO_OPENAPI_OUTPUT: output,
        HOUKAGO_BAIDU_CLIENT_SECRET: "contract-test-secret",
        HOUKAGO_CREDENTIAL_KEY: "invalid-production-key",
        HOUKAGO_KOMON_USERNAMES: "missing-production-admin",
      },
    )
    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe("")
    expect(await Bun.file(database).text()).toBe("production database must remain untouched")
    const document = await Bun.file(output).json()
    expect(document.components.securitySchemes.cookieSession).toEqual({
      type: "apiKey",
      in: "cookie",
      name: "houkago_seitoshou",
    })
    expect(document.paths["/seitoshou/me"].get.security).toEqual([{ cookieSession: [] }])
    expect(document.paths["/baidu/adaptor/heartbeat"].post.security).toEqual([
      { adaptorBearer: [] },
    ])
    expect(document.paths["/baidu/adaptor/pair"].post.security).toEqual([])
    expect(document.paths["/site-config"].get.security).toEqual([])
    expect(document.paths["/seitoshou/sign-out"].post.security).toEqual([{}, { cookieSession: [] }])
    expect(document.paths["/seitoshou/sign-out"].post.parameters[0].required).toBe(false)
    expect(document.paths["/eisha/danmaku/{ref}"].get.responses["500"]).toBeDefined()
    const enmoku =
      document.paths["/bushitsu/{id}/bangumi"].get.responses["200"].content["application/json"]
        .schema.items
    expect(enmoku.properties.headers.additionalProperties).toEqual({ type: "string" })
    expect(enmoku.properties.headers.patternProperties).toBeUndefined()
    expect(enmoku.properties.subtitles.additionalProperties.properties.type).toEqual({
      type: "string",
    })
    expect(
      document.paths["/baidu/oauth/callback"].get.responses["200"].content["text/html"],
    ).toBeDefined()
    expect(
      document.paths["/eisha/dash/{token}"].get.responses["200"].content["application/dash+xml"],
    ).toBeDefined()
    expect(document.paths["/baidu/media/{grantId}"].get.responses["200"]).toBeUndefined()
    expect(document.paths["/ws"].get.responses["101"]).toBeDefined()
    expect(document.paths["/ws"].ws).toBeUndefined()
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test.each([false, true])(
  "export rejects missing classification or hidden runtime routes (hidden=%s)",
  async (hidden) => {
    const result = await runExportProbe(`
    process.env.HOUSOU_DB = ":memory:"
    process.env.HOUKAGO_OPENAPI = "1"
    delete process.env.HOUKAGO_KOMON_USERNAMES
    const { app } = await import("./packages/housou/src/index.ts")
    app.get("/contract-missing-route", () => ({ ok: true }), ${
      hidden
        ? '{ detail: { hide: true, operationId: "contractMissingRoute", tags: ["browser-json"] } }'
        : "{}"
    })
    await import("./packages/housou/src/export-openapi.ts")
  `)
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain(
      hidden ? "missing: get /contract-missing-route" : "lacks HTTP contract classification",
    )
  },
)

test("drift checks reject stale checked artifacts even when two generations agree", async () => {
  const directory = await mkdtemp(join(tmpdir(), "houkago-contract-drift-"))
  const artifactPaths = ["packages/housou/openapi.json", "packages/kyoushitsu/openapi.json"]
  const generatedPath = "packages/kyoushitsu/src/api/generated/client.gen.ts"
  const generated =
    "// This file is auto-generated by @hey-api/openapi-ts\nexport const stable = true\n"
  try {
    for (const path of artifactPaths) await Bun.write(join(directory, path), "{}\n")
    await Bun.write(join(directory, generatedPath), generated)
    await Bun.write(
      join(directory, "package.json"),
      JSON.stringify({
        scripts: { "contract:generate": "bun regenerate.ts" },
      }),
    )
    await Bun.write(
      join(directory, "regenerate.ts"),
      `
      for (const path of ${JSON.stringify(artifactPaths)}) await Bun.write(path, "{}\\n")
      await Bun.write(${JSON.stringify(generatedPath)}, ${JSON.stringify(generated)})
    `,
    )
    const probe = async () => {
      const child = Bun.spawn([process.execPath, join(root, "scripts/check-contract-drift.ts")], {
        cwd: directory,
        stdout: "pipe",
        stderr: "pipe",
      })
      const [exitCode, stderr] = await Promise.all([
        child.exited,
        new Response(child.stderr).text(),
      ])
      return { exitCode, stderr }
    }
    expect((await probe()).exitCode).toBe(0)
    await Bun.write(join(directory, artifactPaths[0] ?? ""), '{"stale":true}\n')
    const stale = await probe()
    expect(stale.exitCode).not.toBe(0)
    expect(stale.stderr).toContain("checked contract artifacts are stale")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("page transform refuses a newly unclassified JSON operation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "houkago-page-contract-"))
  const input = join(directory, "full.json")
  const output = join(directory, "page.json")
  try {
    await Bun.write(
      input,
      JSON.stringify({
        paths: {
          "/new-route": { get: { operationId: "newRoute", tags: [], responses: { "200": {} } } },
        },
      }),
    )
    const child = Bun.spawn([process.execPath, join(root, "scripts/prepare-page-openapi.ts")], {
      cwd: root,
      env: { ...process.env, HOUKAGO_OPENAPI_INPUT: input, HOUKAGO_PAGE_OPENAPI_OUTPUT: output },
      stdout: "pipe",
      stderr: "pipe",
    })
    const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()])
    expect(exitCode).not.toBe(0)
    expect(stderr).toContain("unclassified OpenAPI operation get /new-route")
    expect(await Bun.file(output).exists()).toBe(false)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
