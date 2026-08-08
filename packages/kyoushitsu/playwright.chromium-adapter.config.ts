import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  projects: [
    {
      name: "chromium-adapter-installed",
      testMatch: /chromium-adapter-installed\.spec\.ts/,
    },
  ],
})
