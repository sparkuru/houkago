import { expect, test } from "bun:test"
import { roomConnectionLabel } from "../src/features/room/room-connection-label"

test("room connection copy distinguishes reconnecting, disconnected and failed states", () => {
  expect(roomConnectionLabel("connecting")).toBe("连接中")
  expect(roomConnectionLabel("open")).toBe("正常")
  expect(roomConnectionLabel("closed")).toBe("断开")
  expect(roomConnectionLabel("error")).toBe("异常")
})
