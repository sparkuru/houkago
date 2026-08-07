import { expect, test } from "bun:test"
import { join } from "node:path"

const packageRoot = join(import.meta.dir, "..")

test("development builds allow HTTP and HTTPS pages and servers", async () => {
  for (const browser of ["firefox", "chromium"] as const) {
    const result = Bun.spawn([process.execPath, "scripts/build.ts", browser], {
      cwd: packageRoot,
      env: developmentEnvironment(),
      stdout: "pipe",
      stderr: "pipe",
    })
    expect(await result.exited).toBe(0)
    const manifest = await Bun.file(join(packageRoot, `dist/${browser}/manifest.json`)).json()
    const permissions = browser === "firefox" ? manifest.permissions : manifest.host_permissions
    expect(manifest.content_scripts[0].matches).toEqual(["http://*/*", "https://*/*"])
    expect(permissions).toContain("http://*/*")
    expect(permissions).toContain("https://*/*")
    expect(permissions).toContain("https://pan.baidu.com/*")
    expect(permissions).toContain("https://*.baidupcs.com/*")
    if (browser === "chromium") {
      expect(manifest.permissions).toContain("webRequest")
      expect(manifest.permissions).toContain("alarms")
      expect(manifest.permissions).not.toContain("webRequestBlocking")
    }
    expect(JSON.stringify(manifest)).toContain('"http://*/*"')
    expect(JSON.stringify(manifest)).toContain('"https://*/*"')
  }
})

test("production build binds separate exact page and server origins", async () => {
  for (const browser of ["firefox", "chromium"] as const) {
    const result = Bun.spawn([process.execPath, "scripts/build.ts", browser], {
      cwd: packageRoot,
      env: {
        ...process.env,
        HOUKAGO_ADAPTER_ORIGIN: "https://watch.houkago.example",
        HOUKAGO_ADAPTER_SERVER_ORIGIN: "https://api.houkago.example",
      },
      stdout: "pipe",
      stderr: "pipe",
    })
    expect(await result.exited).toBe(0)
    const manifest = await Bun.file(join(packageRoot, `dist/${browser}/manifest.json`)).json()
    const permissions = browser === "firefox" ? manifest.permissions : manifest.host_permissions
    expect(manifest.content_scripts[0].matches).toEqual(["https://watch.houkago.example/*"])
    expect(permissions).toContain("https://api.houkago.example/*")
    expect(permissions).not.toContain("http://*/*")
    expect(permissions).not.toContain("https://*/*")
    expect(permissions).toContain("https://pan.baidu.com/*")
    expect(permissions).toContain("https://*.baidupcs.com/*")
    if (browser === "chromium") {
      expect(manifest.permissions).toContain("webRequest")
      expect(manifest.permissions).toContain("alarms")
      expect(manifest.permissions).not.toContain("webRequestBlocking")
    }
    expect(JSON.stringify(manifest)).not.toContain('"http://*/*"')
    expect(JSON.stringify(manifest)).not.toContain('"https://*/*"')
    const background = await Bun.file(join(packageRoot, `dist/${browser}/background.js`)).text()
    expect(background).toContain("https://watch.houkago.example")
    expect(background).toContain("https://api.houkago.example")
  }
})

test("configured loopback HTTP origins remain valid without development wildcards", async () => {
  for (const browser of ["firefox", "chromium"] as const) {
    const result = Bun.spawn([process.execPath, "scripts/build.ts", browser], {
      cwd: packageRoot,
      env: {
        ...process.env,
        HOUKAGO_ADAPTER_ORIGIN: "http://127.0.0.1:5173",
        HOUKAGO_ADAPTER_SERVER_ORIGIN: "http://127.0.0.1:3000",
      },
      stdout: "pipe",
      stderr: "pipe",
    })
    expect(await result.exited).toBe(0)
    const manifest = await Bun.file(join(packageRoot, `dist/${browser}/manifest.json`)).json()
    const permissions = browser === "firefox" ? manifest.permissions : manifest.host_permissions
    expect(manifest.content_scripts[0].matches).toEqual(["http://127.0.0.1/*"])
    expect(permissions).toContain("http://127.0.0.1/*")
    expect(JSON.stringify(manifest)).not.toContain('"http://*/*"')
    expect(JSON.stringify(manifest)).not.toContain('"https://*/*"')
  }
})

function developmentEnvironment(): Record<string, string | undefined> {
  const environment = { ...process.env }
  environment.HOUKAGO_ADAPTER_ORIGIN = undefined
  environment.HOUKAGO_ADAPTER_SERVER_ORIGIN = undefined
  return environment
}

test("build rejects an unsafe or incomplete deployment-origin pair", async () => {
  for (const origins of [
    {
      HOUKAGO_ADAPTER_ORIGIN: "https://watch.houkago.example",
      HOUKAGO_ADAPTER_SERVER_ORIGIN: "http://evil.example",
    },
    {
      HOUKAGO_ADAPTER_ORIGIN: "https://watch.houkago.example",
      HOUKAGO_ADAPTER_SERVER_ORIGIN: undefined,
    },
  ]) {
    const result = Bun.spawn([process.execPath, "scripts/build.ts", "chromium"], {
      cwd: packageRoot,
      env: { ...process.env, ...origins },
      stdout: "pipe",
      stderr: "pipe",
    })
    expect(await result.exited).not.toBe(0)
  }
})
