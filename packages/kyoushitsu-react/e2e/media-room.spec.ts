import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { type Page, expect, test } from "@playwright/test"

const housouUrl = process.env.PLAYWRIGHT_HOUSOU_URL ?? "http://127.0.0.1:3000"
const mediaOrigin = "https://media.example.test/m5"

const mediaTypes: Record<string, string> = {
  "clip.mp4": "video/mp4",
  "clip.m3u8": "application/vnd.apple.mpegurl",
  "master.m3u8": "application/vnd.apple.mpegurl",
  "sub-en.m3u8": "application/vnd.apple.mpegurl",
  "sub-en.vtt": "text/vtt",
  "segment0.mpegts": "video/mp2t",
  "clip.mpd": "application/dash+xml",
  "init-stream0.m4s": "video/iso.segment",
  "chunk-stream0-00001.m4s": "video/iso.segment",
}

async function serveMedia(page: Page): Promise<void> {
  await page.route(`${mediaOrigin}/**`, async (route) => {
    const name = new URL(route.request().url()).pathname.split("/").at(-1) ?? ""
    const contentType = mediaTypes[name]
    if (!contentType) return route.fulfill({ status: 404 })
    const fixtureText: Record<string, string> = {
      "master.m3u8":
        '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en",DEFAULT=NO,AUTOSELECT=YES,URI="sub-en.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=500000,SUBTITLES="subs"\nclip.m3u8\n',
      "sub-en.m3u8":
        "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:12\n#EXTINF:12,\nsub-en.vtt\n#EXT-X-ENDLIST\n",
      "sub-en.vtt": "WEBVTT\n\n00:00.000 --> 00:12.000\nM5 English subtitle\n",
    }
    if (fixtureText[name]) {
      return route.fulfill({
        contentType,
        headers: { "access-control-allow-origin": "*" },
        body: fixtureText[name],
      })
    }
    const asset = await readFile(
      fileURLToPath(new URL(`./fixtures/media/${name}`, import.meta.url)),
    )
    const range = route
      .request()
      .headers()
      .range?.match(/^bytes=(\d+)-(\d*)$/)
    const start = range ? Number(range[1]) : 0
    const end = range?.[2] ? Math.min(Number(range[2]), asset.length - 1) : asset.length - 1
    const partial = Boolean(range) && start < asset.length && end >= start
    await route.fulfill({
      status: partial ? 206 : 200,
      contentType,
      headers: {
        "access-control-allow-origin": "*",
        "accept-ranges": "bytes",
        ...(partial ? { "content-range": `bytes ${start}-${end}/${asset.length}` } : {}),
      },
      body: partial ? asset.subarray(start, end + 1) : asset,
    })
  })
}

async function createAdmittedRoom(page: Page): Promise<string> {
  const username = `m5_${randomUUID().replaceAll("-", "").slice(0, 20)}`
  await page.goto("/")
  await page.getByRole("button", { name: "没有账号？注册" }).click()
  await page.getByLabel("用户名").fill(username)
  await page.getByLabel("密码", { exact: true }).fill("M5-fixture-password")
  await page.getByRole("button", { name: "注册并继续" }).click()
  await page.getByLabel("部室名").fill(`M5 fixture ${username}`)
  await page.getByRole("button", { name: "创建并入部" }).click()
  await expect(page.getByLabel("视频链接")).toBeVisible()
  const roomId = new URL(page.url()).pathname.split("/").at(-1)
  if (!roomId) throw new Error("Room ID is missing")
  return roomId
}

async function registerViewer(page: Page): Promise<void> {
  const username = `m5_guest_${randomUUID().replaceAll("-", "").slice(0, 17)}`
  await page.goto("/")
  await page.getByRole("button", { name: "没有账号？注册" }).click()
  await page.getByLabel("用户名").fill(username)
  await page.getByLabel("密码", { exact: true }).fill("M5-fixture-password")
  await page.getByRole("button", { name: "注册并继续" }).click()
  await expect(page.getByText(username, { exact: true })).toBeVisible()
}

async function addAndSelect(
  page: Page,
  roomId: string,
  type: "direct" | "hls" | "dash",
  metadata: Record<string, unknown> = {},
) {
  const title = `M5 ${type} fixture`
  const extension = type === "direct" ? "mp4" : type === "hls" ? "m3u8" : "mpd"
  const result = await page.context().request.post(`${housouUrl}/bushitsu/${roomId}/enmoku`, {
    headers: { origin: new URL(page.url()).origin },
    data: { title, type, url: `${mediaOrigin}/clip.${extension}`, ...metadata },
  })
  expect(result.status()).toBe(200)
  const row = page.getByRole("listitem").filter({ hasText: title })
  await expect(row).toBeVisible()
  await row.getByRole("button", { name: "设为当前" }).click()
  await expect(page.getByRole("heading", { name: title })).toBeVisible()
  return row
}

test("local MP4, HLS and DASH fixtures play in the React room", async ({ page }) => {
  await serveMedia(page)
  const roomId = await createAdmittedRoom(page)
  for (const type of ["direct", "hls", "dash"] as const) {
    await addAndSelect(page, roomId, type)
    const video = page.locator(".player-screen video")
    await expect(video).toBeVisible()
    await expect
      .poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState))
      .toBeGreaterThanOrEqual(2)
    await page.locator(".player-controls").getByRole("button", { name: "播放" }).click()
    await expect
      .poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime))
      .toBeGreaterThan(0)
  }
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true)
})

test("source, subtitle, seek, rate, cinema and fullscreen controls stay in the player", async ({
  page,
}) => {
  await serveMedia(page)
  const roomId = await createAdmittedRoom(page)
  await addAndSelect(page, roomId, "hls", {
    url: `${mediaOrigin}/master.m3u8`,
    sources: [{ name: "Alternate", url: `${mediaOrigin}/clip.m3u8?alt=1` }],
    subtitles: { English: { type: "hls", url: `${mediaOrigin}/sub-en.m3u8` } },
  })
  const video = page.locator(".player-screen video")
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState))
    .toBeGreaterThanOrEqual(2)
  await page.getByTestId("player-play-toggle").focus()
  await page.keyboard.press("Space")
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(false)

  const subtitleRequest = page.waitForRequest((request) => request.url().includes("sub-en.m3u8"))
  await page.getByTestId("player-subtitle").selectOption({ label: "English" })
  await subtitleRequest
  await page.getByTestId("player-rate").selectOption("1.5")
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.playbackRate))
    .toBe(1.5)

  await page.getByTestId("player-play-toggle").click()
  await page.getByTestId("player-seek").fill("4")
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime))
    .toBeGreaterThan(3.5)
  await page.getByRole("button", { name: "剧场模式" }).click()
  await expect(page.locator(".room-page")).toHaveClass(/room-cinema/)
  await page.getByTestId("player-web-fullscreen").click()
  await expect(page.locator(".player-stage")).toHaveClass(/player-web-fullscreen/)
  await expect(page.locator(".room-page")).not.toHaveClass(/room-cinema/)
  await page.getByTestId("player-web-fullscreen").click()
  await page.getByTestId("player-native-fullscreen").click()
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement?.classList.contains("player-stage")))
    .toBe(true)
  await page.keyboard.press("Escape")

  const alternateRequest = page.waitForRequest((request) => request.url().includes("alt=1"))
  await page.getByTestId("player-source").selectOption({ label: "Alternate" })
  await alternateRequest
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true)
})

test("two admitted viewers share playback authority according to room permission", async ({
  page,
  browser,
}) => {
  await serveMedia(page)
  const roomId = await createAdmittedRoom(page)
  const roomUrl = page.url()
  await addAndSelect(page, roomId, "direct")
  const guestContext = await browser.newContext({ baseURL: new URL(roomUrl).origin })
  const guest = await guestContext.newPage()
  try {
    await serveMedia(guest)
    await registerViewer(guest)
    await guest.goto(roomUrl)
    await expect(guest.getByRole("heading", { name: "M5 direct fixture" })).toBeVisible()
    await expect(guest.getByTestId("player-play-toggle")).toBeDisabled()
    await page.getByTestId("player-play-toggle").click()
    await expect
      .poll(() =>
        page.locator(".player-screen video").evaluate((video: HTMLVideoElement) => video.paused),
      )
      .toBe(false)
    await guest.getByRole("button", { name: "点击参加放映" }).click()
    await expect
      .poll(() =>
        guest
          .locator(".player-screen video")
          .evaluate((video: HTMLVideoElement) => video.currentTime),
      )
      .toBeGreaterThan(0)
    await expect
      .poll(() =>
        guest.locator(".player-screen video").evaluate((video: HTMLVideoElement) => video.paused),
      )
      .toBe(false)
    await page.getByLabel("播放控制").check()
    await expect(guest.getByTestId("player-play-toggle")).toBeEnabled()
    await guest.getByTestId("player-play-toggle").click()
    await expect
      .poll(() =>
        guest.locator(".player-screen video").evaluate((video: HTMLVideoElement) => video.paused),
      )
      .toBe(true)
    await expect
      .poll(() =>
        page.locator(".player-screen video").evaluate((video: HTMLVideoElement) => video.paused),
      )
      .toBe(true)
    await guest.getByTestId("player-rate").selectOption("1.5")
    await expect
      .poll(() =>
        page
          .locator(".player-screen video")
          .evaluate((video: HTMLVideoElement) => video.playbackRate),
      )
      .toBe(1.5)
    await guest.getByTestId("player-seek").fill("4")
    await expect
      .poll(() =>
        page
          .locator(".player-screen video")
          .evaluate((video: HTMLVideoElement) => video.currentTime),
      )
      .toBeGreaterThan(3.5)
    await guest.getByTestId("player-play-toggle").click()
    await expect
      .poll(() =>
        page.locator(".player-screen video").evaluate((video: HTMLVideoElement) => video.paused),
      )
      .toBe(false)
    await page.getByLabel("实时弹幕").fill("M5 live cue")
    await page.getByLabel("弹幕设置").getByRole("button", { name: "发送" }).click()
    await expect(guest.locator(".player-screen .danmaku-live-overlay")).toContainText("M5 live cue")
    await guest.getByTestId("player-web-fullscreen").click()
    await expect(guest.locator(".player-stage")).toHaveClass(/player-web-fullscreen/)
    await expect(guest.locator(".player-stage .danmaku-live-overlay")).toContainText("M5 live cue")
  } finally {
    await guestContext.close()
  }
})
