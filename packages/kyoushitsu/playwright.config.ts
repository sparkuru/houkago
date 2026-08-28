import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : undefined,
  },
  projects: [
    {
      name: "phone-375",
      testMatch: /mobile-room\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "ipad-mini",
      testMatch: /mobile-room\.spec\.ts/,
      use: { ...devices["iPad Mini"], browserName: "chromium" },
    },
    {
      name: "desktop-short",
      testMatch: /desktop-room\.spec\.ts/,
      use: { browserName: "chromium", viewport: { width: 1280, height: 640 } },
    },
    {
      name: "desktop-tall",
      testMatch: /desktop-room\.spec\.ts/,
      use: { browserName: "chromium", viewport: { width: 1280, height: 1200 } },
    },
    {
      name: "subtitle-phone",
      testMatch: /subtitle-phone\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "subtitle-desktop",
      testMatch: /subtitle-desktop\.spec\.ts/,
      use: { browserName: "chromium", viewport: { width: 1280, height: 900 } },
    },
    {
      name: "governance-phone",
      testMatch: /room-governance\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "governance-desktop",
      testMatch: /room-governance\.spec\.ts/,
      use: { browserName: "chromium", viewport: { width: 1280, height: 900 } },
    },
    {
      name: "danmaku-phone",
      testMatch: /danmaku-source\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "danmaku-desktop",
      testMatch: /danmaku-source\.spec\.ts/,
      use: { browserName: "chromium", viewport: { width: 1280, height: 900 } },
    },
  ],
})
