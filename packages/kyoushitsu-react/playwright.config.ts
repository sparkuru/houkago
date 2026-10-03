import { defineConfig } from "@playwright/test"
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
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
      name: "entry-desktop",
      testMatch: /entry\.spec\.ts/,
      use: { browserName: "chromium", viewport: { width: 1280, height: 900 } },
    },
    {
      name: "entry-phone",
      testMatch: /entry\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "real-cookie",
      testMatch: /real-cookie\.spec\.ts/,
      use: { browserName: "chromium", viewport: { width: 1280, height: 900 } },
    },
    {
      name: "real-cookie-phone",
      testMatch: /real-cookie\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "media-desktop",
      testMatch: /media-room\.spec\.ts/,
      use: { browserName: "chromium", viewport: { width: 1280, height: 900 } },
    },
    {
      name: "media-phone",
      testMatch: /media-room\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "room-controls-desktop",
      testMatch: /room-controls\.spec\.ts/,
      use: { browserName: "chromium", viewport: { width: 1280, height: 900 } },
    },
    {
      name: "room-controls-phone",
      testMatch: /room-controls\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "danmaku-desktop",
      testMatch: /danmaku-room\.spec\.ts/,
      use: { browserName: "chromium", viewport: { width: 1280, height: 900 } },
    },
    {
      name: "danmaku-phone",
      testMatch: /danmaku-room\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "baidu-desktop",
      testMatch: /baidu-room\.spec\.ts/,
      use: { browserName: "chromium", viewport: { width: 1280, height: 900 } },
    },
    {
      name: "baidu-phone",
      testMatch: /baidu-room\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      },
    },
  ],
})
