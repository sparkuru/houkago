import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { type Page, expect, test } from "@playwright/test"

const housouUrl = process.env.PLAYWRIGHT_HOUSOU_URL ?? "http://127.0.0.1:3000"
const mediaUrl = "https://media.example.test/m5/clip.mp4"
const evidence = [{ kind: "filename", work: "fixture", episode: 1 }]

async function serveMedia(page: Page) {
  const clip = await readFile(fileURLToPath(new URL("./fixtures/media/clip.mp4", import.meta.url)))
  await page.route(mediaUrl, async (route) => {
    const range = route
      .request()
      .headers()
      .range?.match(/^bytes=(\d+)-(\d*)$/)
    const start = range ? Number(range[1]) : 0
    const end = range?.[2] ? Math.min(Number(range[2]), clip.length - 1) : clip.length - 1
    const partial = Boolean(range) && start < clip.length && end >= start
    await route.fulfill({
      status: partial ? 206 : 200,
      contentType: "video/mp4",
      headers: {
        "access-control-allow-origin": "*",
        "accept-ranges": "bytes",
        ...(partial ? { "content-range": `bytes ${start}-${end}/${clip.length}` } : {}),
      },
      body: partial ? clip.subarray(start, end + 1) : clip,
    })
  })
}

async function createRoom(page: Page) {
  const username = `m5_dm_${randomUUID().replaceAll("-", "").slice(0, 20)}`
  await page.goto("/")
  await page.getByRole("button", { name: "没有账号？注册" }).click()
  await page.getByLabel("用户名").fill(username)
  await page.getByLabel("密码", { exact: true }).fill("M5-fixture-password")
  await page.getByRole("button", { name: "注册并继续" }).click()
  await page.getByLabel("部室名").fill(`Danmaku ${username}`)
  await page.getByRole("button", { name: "创建并入部" }).click()
  await expect(page.getByLabel("视频链接")).toBeVisible()
  const roomId = new URL(page.url()).pathname.split("/").at(-1)
  if (!roomId) throw new Error("room id missing")
  return roomId
}

async function addItem(page: Page, roomId: string, title: string) {
  const response = await page.context().request.post(`${housouUrl}/bushitsu/${roomId}/enmoku`, {
    headers: { origin: new URL(page.url()).origin },
    data: { title, type: "direct", url: mediaUrl },
  })
  expect(response.status()).toBe(200)
  const item: { id: string } = await response.json()
  const row = page.getByRole("listitem").filter({ hasText: title })
  await expect(row).toBeVisible()
  return { id: item.id, row }
}

function resolution(roomId: string, itemId: string) {
  return {
    bushitsuId: roomId,
    enmokuId: itemId,
    policy: {
      allowedClasses: ["server-stored", "provider-official", "local", "third-party"],
      order: ["server-stored", "provider-official", "local", "third-party"],
      updatedAt: 0,
    },
    candidates: [
      {
        id: `stored:${itemId}`,
        sourceClass: "server-stored",
        name: `存储弹幕 ${itemId}`,
        provenance: { provider: "fixture", label: "测试存储" },
        availability: "available",
        releaseId: `release:${itemId}`,
        trackId: `stored:${itemId}`,
        evidence,
        cues: [{ time: 0.1, text: "stored cue", mode: "scroll" }],
      },
      {
        id: `official:${itemId}`,
        sourceClass: "provider-official",
        name: `官方弹幕 ${itemId}`,
        provenance: { provider: "fixture", label: "测试官方" },
        availability: "available",
        releaseId: `release:${itemId}`,
        trackId: `official:${itemId}`,
        evidence,
        cues: [{ time: 0.1, text: "official cue", mode: "scroll" }],
      },
    ],
    matchContext: { releaseId: `release:${itemId}`, evidence },
    roomDefault: {
      enmokuId: itemId,
      trackId: `stored:${itemId}`,
      revisionId: null,
      availability: "available",
      updatedAt: 1,
    },
  }
}

async function captureRoomSocket(page: Page) {
  await page.addInitScript(() => {
    const OriginalWebSocket = window.WebSocket
    window.WebSocket = class extends OriginalWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols)
        if (new URL(String(url)).pathname === "/ws")
          (window as Window & { __m5DanmakuSocket?: WebSocket }).__m5DanmakuSocket = this
      }
    }
  })
}

async function emitRoomDefault(page: Page, roomId: string, itemId: string, trackId: string) {
  await page.evaluate(
    ({ roomId, itemId, trackId }) => {
      const socket = (window as Window & { __m5DanmakuSocket?: WebSocket }).__m5DanmakuSocket
      if (!socket) throw new Error("room socket missing")
      socket.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "DANMAKU_DEFAULT",
            senderId: "server",
            ts: Date.now(),
            payload: {
              bushitsuId: roomId,
              defaults: [
                {
                  enmokuId: itemId,
                  trackId,
                  revisionId: null,
                  availability: "available",
                  updatedAt: Date.now(),
                },
              ],
            },
          }),
        }),
      )
    },
    { roomId, itemId, trackId },
  )
}

test("timeline precedence, local XML overlay, proposal and manual correction", async ({ page }) => {
  await captureRoomSocket(page)
  await serveMedia(page)
  let itemId = ""
  let proposalBody: unknown = null
  let matchBody: unknown = null
  await page.route("**/danmaku/bushitsu/*/enmoku/*", async (route) => {
    const url = new URL(route.request().url())
    const id = decodeURIComponent(url.pathname.split("/").at(-1) ?? "")
    const roomId = decodeURIComponent(url.pathname.split("/").at(-3) ?? "")
    await route.fulfill({ json: resolution(roomId, id) })
  })
  await page.route("**/danmaku/episodes?*", (route) =>
    route.fulfill({
      json: [{ id: "episode-manual", title: "Fixture manual episode", createdAt: 0, updatedAt: 0 }],
    }),
  )
  await page.route("**/danmaku/proposals", async (route) => {
    proposalBody = route.request().postDataJSON()
    await route.fulfill({ json: { id: "proposal-fixture", status: "pending" } })
  })
  await page.route("**/danmaku/matches", async (route) => {
    matchBody = route.request().postDataJSON()
    await route.fulfill({ json: { id: "match-fixture", trustScope: "personal" } })
  })

  const roomId = await createRoom(page)
  const item = await addItem(page, roomId, "M5 danmaku fixture")
  itemId = item.id
  await item.row.getByRole("button", { name: "设为当前" }).click()
  await expect(page.getByRole("heading", { name: "M5 danmaku fixture" })).toBeVisible()
  const panel = page.locator(".danmaku-source-panel")
  await panel.locator("summary").click()
  const stored = panel.getByRole("button", { name: new RegExp(`存储弹幕 ${itemId}`) })
  const official = panel.getByRole("button", { name: new RegExp(`官方弹幕 ${itemId}`) })
  await expect(stored).toBeVisible()
  await expect(stored).toHaveAttribute("aria-pressed", "true")

  await emitRoomDefault(page, roomId, itemId, `official:${itemId}`)
  await expect(official).toHaveAttribute("aria-pressed", "true")
  await stored.click()
  await expect(stored).toHaveAttribute("aria-pressed", "true")
  await emitRoomDefault(page, roomId, itemId, `official:${itemId}`)
  await expect(stored).toHaveAttribute("aria-pressed", "true")

  await panel.getByRole("button", { name: "提交公共建议" }).click()
  await expect(panel).toContainText("公共建议已提交")
  expect(proposalBody).toMatchObject({ releaseId: `release:${itemId}`, evidence })
  const searchLabel = panel.locator('label[for="danmaku-manual-search"]')
  await searchLabel.scrollIntoViewIfNeeded()
  await searchLabel.click()
  await expect(panel.getByLabel("剧集名称或关键词")).toBeFocused()
  await panel.getByLabel("剧集名称或关键词").fill("Fixture manual")
  await panel.getByRole("button", { name: "搜索", exact: true }).click()
  await expect(panel).toContainText("Fixture manual episode")
  await panel.getByRole("button", { name: "确认此剧集" }).click()
  await expect(panel).toContainText("已确认，正在加载该剧集的弹幕")
  expect(matchBody).toMatchObject({
    releaseId: `release:${itemId}`,
    episodeId: "episode-manual",
    trustScope: "personal",
  })

  await panel.locator('input[type="file"]').setInputFiles({
    name: "local.xml",
    mimeType: "text/xml",
    buffer: Buffer.from('<i><d p="0.1,1,25,16777215">local cue</d></i>'),
  })
  await expect(panel.getByRole("button", { name: /local.xml/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await panel.getByRole("button", { name: "弹幕 OFF" }).click()
  await page.getByTestId("player-play-toggle").click()
  await expect(page.locator(".player-screen .danmaku-timeline-overlay")).toContainText("local cue")
  await page.getByTestId("player-web-fullscreen").click()
  await expect(page.locator(".player-stage .danmaku-timeline-overlay")).toContainText("local cue")
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true)
})

test("a late candidate response cannot repaint an older selected item", async ({ page }) => {
  await serveMedia(page)
  let releaseLate = () => {}
  const late = new Promise<void>((resolve) => {
    releaseLate = resolve
  })
  let pendingItem = ""
  let delayed = false
  let lateSettled = false
  await page.route("**/danmaku/bushitsu/*/enmoku/*", async (route) => {
    const url = new URL(route.request().url())
    const id = decodeURIComponent(url.pathname.split("/").at(-1) ?? "")
    const roomId = decodeURIComponent(url.pathname.split("/").at(-3) ?? "")
    if (id === pendingItem) {
      delayed = true
      await late
    }
    try {
      await route.fulfill({ json: resolution(roomId, id) })
    } catch {
      /* aborted on item switch */
    } finally {
      if (id === pendingItem) lateSettled = true
    }
  })
  const roomId = await createRoom(page)
  const first = await addItem(page, roomId, "Danmaku first")
  const second = await addItem(page, roomId, "Danmaku second")
  pendingItem = second.id
  await first.row.getByRole("button", { name: "设为当前" }).click()
  const panel = page.locator(".danmaku-source-panel")
  await panel.locator("summary").click()
  await expect(
    panel.getByRole("button", { name: new RegExp(`存储弹幕 ${first.id}`) }),
  ).toBeVisible()
  await second.row.getByRole("button", { name: "设为当前" }).click()
  await expect.poll(() => delayed).toBe(true)
  await first.row.getByRole("button", { name: "设为当前" }).click()
  await expect(page.getByRole("heading", { name: "Danmaku first" })).toBeVisible()
  releaseLate()
  await expect.poll(() => lateSettled).toBe(true)
  await expect(
    panel.getByRole("button", { name: new RegExp(`存储弹幕 ${first.id}`) }),
  ).toBeVisible()
  await expect(
    panel.getByRole("button", { name: new RegExp(`存储弹幕 ${second.id}`) }),
  ).toHaveCount(0)
})
