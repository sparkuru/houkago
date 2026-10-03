import { expect, test } from "bun:test"
import type { Enmoku } from "houkago-kousoku"
import { renderToStaticMarkup } from "react-dom/server"
import { DanmakuFeature } from "../src/features/danmaku/danmaku-feature"

const current: Enmoku = {
  id: "item-1",
  bushitsuId: "room-1",
  title: "Fixture video",
  type: "direct",
  url: "https://example.test/video.mp4",
  addedBy: "host",
}

test("danmaku controls expose source and display settings without starting room reads during render", () => {
  const originalFetch = globalThis.fetch
  let reads = 0
  globalThis.fetch = Object.assign(
    async () => {
      reads++
      throw new Error("unexpected network read")
    },
    { preconnect: originalFetch.preconnect },
  )
  try {
    const html = renderToStaticMarkup(
      <DanmakuFeature
        roomId="room-1"
        identityId="viewer"
        current={current}
        roomDefaults={{}}
        defaultsAuthoritative={false}
        isHost={false}
        canManageRoomDefault={false}
        chat={[]}
        names={{}}
        mediaTime={0}
        overlayContainer={null}
      />,
    )
    expect(reads).toBe(0)
    expect(html).toContain("时间轴弹幕来源")
    expect(html).toContain("弹幕设置")
    expect(html).not.toContain('id="room-live-danmaku"')
    expect(html).not.toContain("手动搜索与修正")
  } finally {
    globalThis.fetch = originalFetch
  }
})
