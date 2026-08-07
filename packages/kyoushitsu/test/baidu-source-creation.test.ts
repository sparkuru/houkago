import { expect, test } from "bun:test"
import type { Enmoku } from "houkago-kousoku"
import { permitCreatedUserHeldSource } from "../src/lib/baidu-source-creation"

const enmoku = {
  id: "enmoku-created-now",
  bushitsuId: "room-1",
  title: "movie.mp4",
  url: "/baidu/source/source-1",
  addedAt: 1,
  provider: {
    kind: "baidu",
    sourceId: "source-1",
    retentionMode: "user-held",
    fileName: "movie.mp4",
  },
} satisfies Enmoku

test("keeps a newly created user-held source when extension permission succeeds", async () => {
  const rollbacks: string[] = []
  await permitCreatedUserHeldSource(enmoku, "room-1", "upstream-1", {
    permit: async (sourceId, bushitsuId, upstreamHandle) => {
      expect({ sourceId, bushitsuId, upstreamHandle }).toEqual({
        sourceId: "source-1",
        bushitsuId: "room-1",
        upstreamHandle: "upstream-1",
      })
    },
    rollback: async (enmokuId) => rollbacks.push(enmokuId),
  })

  expect(rollbacks).toEqual([])
})

test("rolls back only the just-created enmoku when extension permission fails", async () => {
  const permitError = new Error("extension rejected source")
  const rollbacks: string[] = []
  await expect(
    permitCreatedUserHeldSource(enmoku, "room-1", "upstream-1", {
      permit: async () => {
        throw permitError
      },
      rollback: async (enmokuId) => rollbacks.push(enmokuId),
    }),
  ).rejects.toBe(permitError)

  expect(rollbacks).toEqual(["enmoku-created-now"])
})

test("preserves the permission error when best-effort rollback also fails", async () => {
  const permitError = new Error("extension rejected source")
  await expect(
    permitCreatedUserHeldSource(enmoku, "room-1", "upstream-1", {
      permit: async () => {
        throw permitError
      },
      rollback: async () => {
        throw new Error("rollback unavailable")
      },
    }),
  ).rejects.toBe(permitError)
})
