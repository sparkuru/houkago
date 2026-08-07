import { type Page, expect } from "@playwright/test"

export async function registerAndCreateRoom(page: Page, suffix: string): Promise<void> {
  const username = `subtitle_${Date.now()}_${suffix}`.replaceAll(/[^a-zA-Z0-9_]/g, "_").slice(0, 32)
  await page.goto("/")
  await page.getByRole("button", { name: "没有账号？注册" }).click()
  await page.getByLabel("用户名").fill(username)
  await page.getByRole("textbox", { name: "密码", exact: true }).fill("abcdefgh")
  await page.getByRole("button", { name: "注册并继续" }).click()
  await expect(page.getByText(`已登录为 ${username}`)).toBeVisible()
  await page.getByRole("button", { name: "创建并入部" }).click()
  await expect(page).toHaveURL(/\/bushitsu\//)
}

export async function startSubtitleFixture(page: Page): Promise<void> {
  const roomId = new URL(page.url()).pathname.split("/").at(-1)
  const response = await page.evaluate(async (id) => {
    const base = `http://${location.hostname}:3000`
    const result = await fetch(`${base}/bushitsu/${id}/enmoku`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "字幕测试",
        type: "direct",
        url: "https://media.example.test/subtitle-fixture.mp4",
      }),
    })
    return { status: result.status, body: await result.json() }
  }, roomId)
  expect(response.status).toBe(200)

  await page.route("https://media.example.test/**", (route) => {
    const path = new URL(route.request().url()).pathname
    const headers = { "access-control-allow-origin": "*" }
    if (path === "/subtitle-fixture.m3u8" || path === "/subtitle-fixture-720.m3u8") {
      return route.fulfill({
        contentType: "application/vnd.apple.mpegurl",
        headers,
        body: `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en",DEFAULT=NO,AUTOSELECT=YES,URI="subtitle-en.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Japanese",LANGUAGE="ja",DEFAULT=NO,AUTOSELECT=YES,URI="subtitle-ja.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=100000,SUBTITLES="subs"
video.m3u8
`,
      })
    }
    if (path === "/video.m3u8") {
      return route.fulfill({
        contentType: "application/vnd.apple.mpegurl",
        headers,
        body: "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:2\n#EXT-X-ENDLIST\n",
      })
    }
    if (path === "/subtitle-en.m3u8" || path === "/subtitle-ja.m3u8") {
      return route.fulfill({
        contentType: "application/vnd.apple.mpegurl",
        headers,
        body: `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:2
#EXTINF:2,
${path.slice(1, -5)}.vtt
#EXT-X-ENDLIST
`,
      })
    }
    if (path.endsWith(".vtt")) {
      return route.fulfill({
        contentType: "text/vtt",
        headers,
        body: `WEBVTT

00:00.000 --> 00:02.000
${path.includes("-en") ? "English subtitle" : "Japanese subtitle"}
`,
      })
    }
    return route.fulfill({ status: 404, headers })
  })

  await page.route(`**/bushitsu/${roomId}/bangumi`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        {
          ...response.body,
          type: "hls",
          url: "https://media.example.test/subtitle-fixture.m3u8",
          sources: [{ name: "720p", url: "https://media.example.test/subtitle-fixture-720.m3u8" }],
          subtitles: {
            English: { type: "hls", url: "https://media.example.test/subtitle-en.m3u8" },
            Japanese: { type: "hls", url: "https://media.example.test/subtitle-ja.m3u8" },
          },
        },
      ]),
    }),
  )
  await page.reload()
  const bangumi = page.locator(".bangumi-disclosure")
  if (!(await bangumi.evaluate((element) => element.hasAttribute("open")))) {
    await bangumi.locator("summary").click()
  }
  await page.getByRole("button", { name: "播放", exact: true }).click()
  await expect(page.locator(".art-control-houkagoSubtitle")).toBeVisible()
}
