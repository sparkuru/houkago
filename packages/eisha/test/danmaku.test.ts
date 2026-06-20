import { expect, test } from "bun:test"
import { decodeDanmakuRef, fetchDanmakuCues } from "../src/danmaku"
import { EishaBadRequest } from "../src/errors"
import type { FetchLike } from "../src/proxy"

test("decodes Bilibili danmaku refs", () => {
  expect(decodeDanmakuRef("bilibili%3A62131")).toEqual({ provider: "bilibili", cid: "62131" })
  expect(() => decodeDanmakuRef("bilibili:nope")).toThrow(EishaBadRequest)
})

test("fetches and parses Bilibili XML danmaku", async () => {
  const seen: string[] = []
  const fetcher: FetchLike = async (input, init) => {
    const url = new URL(String(input))
    seen.push(`${url.hostname}${url.pathname}:${new Headers(init?.headers).get("referer")}`)
    return new Response(
      '<i><d p="1.5,1,25,16711680,0,0,0,0">hello</d><d p="2.5,5,25,255,0,0,0,0">top</d></i>',
    )
  }

  const cues = await fetchDanmakuCues("bilibili:62131", fetcher)

  expect(seen).toEqual(["comment.bilibili.com/62131.xml:https://www.bilibili.com/"])
  expect(cues).toEqual([
    { time: 1.5, text: "hello", color: "#ff0000", mode: "scroll" },
    { time: 2.5, text: "top", color: "#0000ff", mode: "top" },
  ])
})
