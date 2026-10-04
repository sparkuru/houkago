import { defineConfig } from "@playwright/test"

for (const key of [
  "PLAYWRIGHT_BASE_URL",
  "PLAYWRIGHT_HOUSOU_URL",
  "PLAYWRIGHT_MEDIA_URL",
  "PLAYWRIGHT_PUBLIC_MEDIA_URL",
]) {
  const value = process.env[key]
  if (!value) throw new Error(`${key} is required for real-environment acceptance`)
  const url = new URL(value)
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error(`${key} must be an HTTP(S) endpoint without credentials`)
  }
}

export default defineConfig({
  testDir: "./e2e",
  testMatch: /real-environment\.spec\.ts/,
  outputDir: process.env.PLAYWRIGHT_REAL_OUTPUT ?? "/tmp/houkago-real-environment-results",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    browserName: "chromium",
    viewport: { width: 1280, height: 900 },
    actionTimeout: 15_000,
    trace: "off",
    screenshot: "off",
    video: "off",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : undefined,
  },
})
