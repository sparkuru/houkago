import { expect, test } from "bun:test"
import {
  type BaiduFetcher,
  baiduAuthorizationUrl,
  exchangeBaiduCode,
  fetchBaiduDlink,
  fetchBaiduFileMetadata,
  isApprovedBaiduDlink,
  isApprovedBaiduRawDlink,
  listBaiduDirectory,
  refreshBaiduToken,
} from "../src/baidu"

const config = {
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "https://houkago.example/baidu/oauth/callback",
}

test("builds official authorization URL with exact redirect and CSRF state", () => {
  const url = new URL(baiduAuthorizationUrl(config, "state-value"))
  expect(url.origin + url.pathname).toBe("https://openapi.baidu.com/oauth/2.0/authorize")
  expect(url.searchParams.get("client_id")).toBe(config.clientId)
  expect(url.searchParams.get("redirect_uri")).toBe(config.redirectUri)
  expect(url.searchParams.get("state")).toBe("state-value")
})

test("parses code exchange and refresh without putting secrets in errors", async () => {
  const requests: string[] = []
  const fetcher: BaiduFetcher = async (input, init) => {
    requests.push(String(input))
    expect(init?.method).toBe("GET")
    return Response.json({
      access_token: "access-secret",
      refresh_token: "refresh-secret",
      expires_in: 3600,
      scope: "basic netdisk",
    })
  }
  const exchanged = await exchangeBaiduCode(config, "one-use-code", fetcher, 1_000)
  const refreshed = await refreshBaiduToken(config, exchanged.refreshToken, fetcher, 2_000)
  expect(exchanged).toEqual({
    accessToken: "access-secret",
    refreshToken: "refresh-secret",
    expiresAt: 3_601_000,
    scope: ["basic", "netdisk"],
  })
  expect(refreshed.expiresAt).toBe(3_602_000)
  expect(requests[0]).toContain("code=one-use-code")

  const failing: BaiduFetcher = async () => new Response("access-secret", { status: 401 })
  await expect(exchangeBaiduCode(config, "one-use-code", failing)).rejects.toThrow(
    "Baidu token request failed",
  )
})

test("sanitizes directory entries and marks supported video files", async () => {
  const fetcher: BaiduFetcher = async () =>
    Response.json({
      errno: 0,
      list: [
        { fs_id: 1, server_filename: "Anime", path: "/Anime", isdir: 1, server_mtime: 10 },
        {
          fs_id: 2,
          server_filename: "episode.mp4",
          path: "/Anime/episode.mp4",
          isdir: 0,
          size: 42,
          server_mtime: 20,
          category: 1,
          dlink: "must-not-leak",
        },
        { fs_id: 3, server_filename: "notes.txt", path: "/notes.txt", isdir: 0 },
      ],
    })
  const page = await listBaiduDirectory("access-secret", "/", undefined, fetcher)
  expect(page.entries).toEqual([
    {
      id: "1",
      name: "Anime",
      path: "/Anime",
      isDirectory: true,
      modifiedAt: 10_000,
      mediaType: "unsupported",
    },
    {
      id: "2",
      name: "episode.mp4",
      path: "/Anime/episode.mp4",
      isDirectory: false,
      size: 42,
      modifiedAt: 20_000,
      mediaType: "video",
    },
    {
      id: "3",
      name: "notes.txt",
      path: "/notes.txt",
      isDirectory: false,
      mediaType: "unsupported",
    },
  ])
  expect(JSON.stringify(page)).not.toContain("must-not-leak")
  expect(JSON.stringify(page)).not.toContain("access-secret")
  await expect(listBaiduDirectory("access-secret", "/", "NaN", fetcher)).rejects.toThrow(
    "Baidu directory request failed",
  )
})

test("advances pagination by raw upstream rows even when malformed rows are filtered", async () => {
  const fetcher: BaiduFetcher = async () =>
    Response.json({ errno: 0, list: Array.from({ length: 1000 }, () => ({ malformed: true })) })
  const page = await listBaiduDirectory("access-secret", "/", "2000", fetcher)
  expect(page.entries).toEqual([])
  expect(page.cursor).toBe("3000")
})

test("exchanges a private raw dlink for a token-free bounded capability", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = []
  const fetcher: BaiduFetcher = async (input, init) => {
    requests.push({ url: String(input), init })
    if (init?.method === "HEAD") {
      return new Response(null, {
        status: 302,
        headers: { location: "https://cdn.baidupcs.com/final?cap=1" },
      })
    }
    return Response.json({
      errno: 0,
      list: [{ fs_id: 2, dlink: "https://d.pcs.baidu.com/file?cap=1" }],
    })
  }
  expect(await fetchBaiduDlink("access-secret", "2", fetcher, 5_000)).toEqual({
    dlink: "https://cdn.baidupcs.com/final?cap=1",
    expiresAt: 305_000,
  })
  expect(requests[1]?.init).toEqual({
    method: "HEAD",
    headers: { "user-agent": "pan.baidu.com" },
    redirect: "manual",
  })
  expect(requests[1]?.url).toContain("access_token=access-secret")
  expect(requests[0]?.url).toContain("https://pan.baidu.com/rest/2.0/xpan/multimedia")
  expect(requests[0]?.url).toContain("access_token=access-secret")
  expect(new URL(requests[0]?.url ?? "").searchParams.get("fsids")).toBe("[2]")
  expect(new URL(requests[0]?.url ?? "").searchParams.get("dlink")).toBe("1")
  expect(JSON.stringify(requests.slice(2))).not.toContain("access-secret")

  const unsafe: BaiduFetcher = async () =>
    Response.json({ errno: 0, list: [{ fs_id: 2, dlink: "javascript:alert(1)" }] })
  await expect(fetchBaiduDlink("access-secret", "2", unsafe)).rejects.toThrow(
    "Baidu download link request failed",
  )
  expect(isApprovedBaiduDlink("https://d.pcs.baidu.com/file")).toBe(true)
  expect(isApprovedBaiduDlink("https://cdn.baidupcs.com/file")).toBe(true)
  expect(isApprovedBaiduDlink("https://evil.example/file")).toBe(false)
  expect(isApprovedBaiduRawDlink("https://d.pcs.baidu.com/private?access_token=raw")).toBe(true)
  for (const capability of [
    "https://user@cdn.baidupcs.com/file",
    "https://user:pass@cdn.baidupcs.com/file",
    "https://cdn.baidupcs.com/file?ACCESS_TOKEN=leak",
    "https://cdn.baidupcs.com/file?Refresh_Token=leak",
    "https://cdn.baidupcs.com/file#credential",
  ]) {
    expect(isApprovedBaiduDlink(capability)).toBe(false)
  }
  const wrongHost: BaiduFetcher = async () =>
    Response.json({ errno: 0, list: [{ fs_id: 2, dlink: "https://evil.example/file" }] })
  await expect(fetchBaiduDlink("access-secret", "2", wrongHost)).rejects.toThrow(
    "Baidu download link request failed",
  )

  for (const location of [
    "https://evil.example/file",
    "https://cdn.baidupcs.com/final?access_token=leak",
    "https://cdn.baidupcs.com/final?cap=access-secret",
    "https://cdn.baidupcs.com/final?cap=access%2Dsecret",
  ]) {
    const malicious: BaiduFetcher = async (_input, init) =>
      init?.method === "HEAD"
        ? new Response(null, { status: 302, headers: { location } })
        : Response.json({
            errno: 0,
            list: [{ fs_id: 2, dlink: "https://d.pcs.baidu.com/private" }],
          })
    await expect(fetchBaiduDlink("access-secret", "2", malicious)).rejects.toThrow(
      "Baidu download link request failed",
    )
  }

  for (const list of [
    [],
    [{ fs_id: 3, dlink: "https://d.pcs.baidu.com/private" }],
    [
      { fs_id: 2, dlink: "https://d.pcs.baidu.com/private" },
      { fs_id: 2, dlink: "https://d.pcs.baidu.com/duplicate" },
    ],
  ]) {
    const malformed: BaiduFetcher = async () => Response.json({ errno: 0, list })
    await expect(fetchBaiduDlink("access-secret", "2", malformed)).rejects.toThrow(
      "Baidu file metadata request failed",
    )
  }
})

test("uses the official filemetas request and response shapes", async () => {
  const valid: BaiduFetcher = async (input) => {
    const url = new URL(String(input))
    expect(url.searchParams.get("fsids")).toBe("[42]")
    expect(url.searchParams.get("dlink")).toBe("1")
    return Response.json({
      errno: 0,
      list: [
        {
          fs_id: 42,
          filename: "episode.mp4",
          path: "/Anime/episode.mp4",
          isdir: 0,
          size: 100,
          server_mtime: 20,
          category: 1,
          dlink: "must-not-leak",
          thumbs: { url1: "must-not-leak" },
        },
      ],
    })
  }
  expect(await fetchBaiduFileMetadata("access-secret", "42", valid)).toEqual({
    id: "42",
    name: "episode.mp4",
    path: "/Anime/episode.mp4",
    isDirectory: false,
    size: 100,
    modifiedAt: 20_000,
    mediaType: "video",
  })

  const largeFsid = "9223372036854775807"
  const large: BaiduFetcher = async (input) => {
    expect(new URL(String(input)).searchParams.get("fsids")).toBe(`[${largeFsid}]`)
    return new Response(
      `{"errno":0,"list":[{"fs_id":${largeFsid},"filename":"large.mp4","path":"/large.mp4","isdir":0,"category":1}]}`,
      { headers: { "content-type": "application/json" } },
    )
  }
  expect((await fetchBaiduFileMetadata("access-secret", largeFsid, large)).id).toBe(largeFsid)

  const largeDlink: BaiduFetcher = async (input, init) => {
    if (init?.method === "HEAD") {
      return new Response(null, {
        status: 302,
        headers: { location: "https://cdn.baidupcs.com/final?cap=large" },
      })
    }
    expect(new URL(String(input)).searchParams.get("fsids")).toBe(`[${largeFsid}]`)
    return new Response(
      `{"errno":0,"list":[{"fs_id":${largeFsid},"dlink":"https://d.pcs.baidu.com/private"}]}`,
      { headers: { "content-type": "application/json" } },
    )
  }
  expect((await fetchBaiduDlink("access-secret", largeFsid, largeDlink)).dlink).toBe(
    "https://cdn.baidupcs.com/final?cap=large",
  )

  for (const invalidFsid of ["0", "42.0", "-1", "9223372036854775808"]) {
    await expect(
      fetchBaiduFileMetadata("access-secret", invalidFsid, async () => {
        throw new Error("invalid fsid must fail before fetch")
      }),
    ).rejects.toThrow("Baidu file metadata request failed")
  }

  for (const row of [
    {
      fs_id: 43,
      server_filename: "episode.mp4",
      path: "/episode.mp4",
      isdir: 0,
      category: 1,
    },
    { fs_id: 42, server_filename: "Anime", path: "/Anime", isdir: 1 },
    { fs_id: 42, server_filename: "notes.txt", path: "/notes.txt", isdir: 0, category: 4 },
    { fs_id: 42, path: "/missing-name.mp4", isdir: 0, category: 1 },
  ]) {
    const invalid: BaiduFetcher = async () => Response.json({ errno: 0, list: [row] })
    await expect(fetchBaiduFileMetadata("access-secret", "42", invalid)).rejects.toThrow(
      "Baidu file metadata request failed",
    )
  }
})

test("keeps filemetas diagnostics useful without retaining provider secrets", async () => {
  const sensitiveBody = {
    errno: 31034,
    access_token: "access-secret",
    dlink: "https://d.pcs.baidu.com/private?cap=secret",
    path: "/private/episode.mp4",
    fs_id: 9223372036854775807n.toString(),
  }
  let httpError: unknown
  try {
    await fetchBaiduFileMetadata("access-secret", "42", async () =>
      Response.json(sensitiveBody, { status: 502 }),
    )
  } catch (error) {
    httpError = error
  }
  expect(httpError).toMatchObject({
    message: "Baidu file metadata request failed",
    diagnostic: {
      provider: "baidu",
      operation: "file metadata",
      kind: "http",
      status: 502,
      upstreamCode: 31034,
    },
  })
  const serializedHttpError = JSON.stringify(httpError)
  for (const secret of [
    "access-secret",
    "cap=secret",
    "/private/episode.mp4",
    sensitiveBody.fs_id,
  ]) {
    expect(serializedHttpError).not.toContain(secret)
  }

  let providerError: unknown
  try {
    await fetchBaiduFileMetadata("access-secret", "42", async () => Response.json(sensitiveBody))
  } catch (error) {
    providerError = error
  }
  expect(providerError).toMatchObject({
    diagnostic: {
      provider: "baidu",
      operation: "file metadata",
      kind: "provider",
      upstreamCode: 31034,
    },
  })
  expect(JSON.stringify(providerError)).not.toContain("access-secret")
})
