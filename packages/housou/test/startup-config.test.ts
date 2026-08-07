import { expect, test } from "bun:test"
import { rm } from "node:fs/promises"
import { fileURLToPath } from "node:url"

type PackageManifest = {
  scripts?: Record<string, string>
}

const housouManifest = (await Bun.file(
  new URL("../package.json", import.meta.url),
).json()) as PackageManifest
const rootManifest = (await Bun.file(
  new URL("../../../package.json", import.meta.url),
).json()) as PackageManifest
const housouDirectory = fileURLToPath(new URL("..", import.meta.url))
const repositoryDirectory = fileURLToPath(new URL("../../..", import.meta.url))

async function probeEnvFile(envFile: string, variable: string) {
  const subprocess = Bun.spawn(
    [
      process.execPath,
      `--env-file=${envFile}`,
      "-e",
      `process.stdout.write(JSON.stringify(process.env[${JSON.stringify(variable)}] ?? null))`,
    ],
    {
      cwd: housouDirectory,
      stdout: "pipe",
      stderr: "pipe",
    },
  )
  const [exitCode, stdout, stderr] = await Promise.all([
    subprocess.exited,
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
  ])
  return { exitCode, stdout, stderr }
}

test("root Housou startup loads the repository environment", () => {
  expect(housouManifest.scripts?.dev).toBe(
    "NODE_ENV=development bun --env-file=../../.env --watch src/index.ts",
  )
  expect(housouManifest.scripts?.start).toBe("bun --env-file=../../.env src/index.ts")
  expect(rootManifest.scripts?.["dev:housou"]).toBe("bun run --filter houkago-housou dev")
  expect(rootManifest.scripts?.["start:housou"]).toBe("bun run --filter houkago-housou start")
})

test("Housou resolves an explicit environment file from its package directory", async () => {
  const variable = `HOUKAGO_STARTUP_CONFIG_TEST_${crypto.randomUUID().replaceAll("-", "")}`
  const fixtureName = `.env.startup-config-${crypto.randomUUID()}.local`
  const fixturePath = `${repositoryDirectory}/${fixtureName}`
  await Bun.write(fixturePath, `${variable}=loaded\n`)

  try {
    const result = await probeEnvFile(`../../${fixtureName}`, variable)
    expect(result).toEqual({ exitCode: 0, stdout: '"loaded"', stderr: "" })
  } finally {
    await rm(fixturePath, { force: true })
  }
})

test("Housou startup keeps a missing optional environment file safe", async () => {
  const variable = `HOUKAGO_STARTUP_CONFIG_TEST_${crypto.randomUUID().replaceAll("-", "")}`
  const result = await probeEnvFile(`../../.env.missing-${crypto.randomUUID()}`, variable)
  expect(result).toEqual({ exitCode: 0, stdout: "null", stderr: "" })
})
