import { expect, test } from "bun:test"
import type { Enmoku } from "houkago-kousoku"
import { resolveEnmoku } from "../src/lib/enmoku-resolve"

// 上映中の解決の純関数テスト：JOUEI/GENJOU の enmokuId を 番組表 の Enmoku に対応づける。
// store/socket 不要。

const enmoku = (id: string): Enmoku => ({
  id,
  bushitsuId: "rA",
  title: `t-${id}`,
  type: "hls",
  url: `https://x/${id}.m3u8`,
  addedBy: "host",
})

const bangumi = [enmoku("e1"), enmoku("e2")]

test("enmokuId が番組表にあれば対応する Enmoku を返す", () => {
  expect(resolveEnmoku(bangumi, "e2")?.id).toBe("e2")
})

test("enmokuId が null なら null（上映中なし）", () => {
  expect(resolveEnmoku(bangumi, null)).toBeNull()
})

test("番組表に無い enmokuId は null（呼び出し側が再取得して再解決）", () => {
  expect(resolveEnmoku(bangumi, "missing")).toBeNull()
})

test("空の番組表でも安全に null", () => {
  expect(resolveEnmoku([], "e1")).toBeNull()
})
