import { expect, test } from "bun:test"
import { parseBilibiliXml } from "../src"

test("parses bilibili xml cues into a normalized timeline", () => {
  const cues = parseBilibiliXml(`
    <i>
      <d p="12.34,1,25,16777215,0,0,hash,1">hello &amp; world</d>
      <d p="4.5,5,25,255,0,0,hash,2"><![CDATA[top line]]></d>
      <d p="8,4,25,65280,0,0,hash,3">bottom</d>
    </i>
  `)

  expect(cues).toEqual([
    { time: 4.5, text: "top line", color: "#0000ff", mode: "top" },
    { time: 8, text: "bottom", color: "#00ff00", mode: "bottom" },
    { time: 12.34, text: "hello & world", color: "#ffffff", mode: "scroll" },
  ])
})

test("skips malformed and empty cues without throwing", () => {
  const cues = parseBilibiliXml(`
    <d p="-1,1,25,16777215">negative</d>
    <d p="abc,1,25,16777215">bad time</d>
    <d p="1,1,25,16777215">   </d>
    <not-d p="2,1,25,16777215">ignored</not-d>
  `)

  expect(cues).toEqual([])
})

test("decodes numeric entities and falls back on invalid color", () => {
  const cues = parseBilibiliXml('<d p="1,6,25,999999999">A&#x20;B&#33;</d>')

  expect(cues).toEqual([{ time: 1, text: "A B!", color: "#ffffff", mode: "reverse" }])
})
