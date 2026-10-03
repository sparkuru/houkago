import { expect, test } from "bun:test"
import {
  formatOnlineDuration,
  historicalMembers,
  onlineMembers,
  projectMemberPresence,
} from "../src/room/member-presence"

const labels = { hour: "时", minute: "分", second: "秒" }

test("formatOnlineDuration clamps future join time to zero seconds", () => {
  expect(formatOnlineDuration(2_000, 1_000, labels)).toBe("0秒")
})

test("formatOnlineDuration renders seconds, minutes, and hours compactly", () => {
  expect(formatOnlineDuration(1_000, 46_000, labels)).toBe("45秒")
  expect(formatOnlineDuration(1_000, 126_000, labels)).toBe("2分5秒")
  expect(formatOnlineDuration(1_000, 3_721_000, labels)).toBe("1时2分")
})

test("authoritative presence preserves join times and departure history without mutating prior snapshots", () => {
  const host = { id: "host", nickname: "Host", yakuwari: "buchou" as const }
  const guest = { id: "guest", nickname: "Guest", yakuwari: "kengaku" as const }
  const joined = projectMemberPresence({}, [host], 1_000)
  const together = projectMemberPresence(joined, [guest, host], 5_000)
  expect(onlineMembers(together).map((member) => member.id)).toEqual(["host", "guest"])
  expect(together.host?.joinedAt).toBe(1_000)
  expect(together.guest?.joinedAt).toBe(5_000)
  const departed = projectMemberPresence(together, [host], 10_000)
  expect(historicalMembers(departed)).toEqual([
    { ...guest, joinedAt: 5_000, lastSeenAt: 10_000, online: false },
  ])
  expect(together.guest?.online).toBe(true)
  const later = projectMemberPresence(departed, [], 20_000)
  expect(historicalMembers(later).map((member) => member.id)).toEqual(["host", "guest"])
  expect(later.guest?.lastSeenAt).toBe(10_000)
  const rejoined = projectMemberPresence(later, [{ ...guest, nickname: "Guest again" }], 30_000)
  expect(onlineMembers(rejoined)).toEqual([
    { ...guest, nickname: "Guest again", joinedAt: 30_000, lastSeenAt: 30_000, online: true },
  ])
  expect(historicalMembers(rejoined).map((member) => member.id)).toEqual(["host"])
})
