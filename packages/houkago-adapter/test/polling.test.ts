import { expect, test } from "bun:test"
import { BAIDU_POLL_ALARM, BAIDU_POLL_PERIOD_MINUTES, installChromiumPolling } from "../src/polling"
import type { ChromiumAlarms } from "../src/types"

test("Chromium alarms wake the service worker for pending polls without sensitive logs", async () => {
  const listeners: Array<(alarm: { name: string }) => void> = []
  const created: Array<{ name: string; periodInMinutes: number }> = []
  const alarms: ChromiumAlarms = {
    create(name, info) {
      created.push({ name, periodInMinutes: info.periodInMinutes })
    },
    onAlarm: {
      addListener(next) {
        listeners.push(next)
      },
    },
  }
  let polls = 0
  const warnings: string[] = []
  installChromiumPolling(
    alarms,
    {
      async poll() {
        polls += 1
        if (polls === 2) throw new Error("sensitive upstream detail")
      },
    },
    (message) => warnings.push(message),
  )
  await tick()
  expect(created).toEqual([{ name: BAIDU_POLL_ALARM, periodInMinutes: BAIDU_POLL_PERIOD_MINUTES }])
  expect(polls).toBe(1)
  listeners[0]?.({ name: "unrelated-alarm" })
  await tick()
  expect(polls).toBe(1)
  listeners[0]?.({ name: BAIDU_POLL_ALARM })
  await tick()
  expect(polls).toBe(2)
  expect(warnings).toEqual(["houkago-adapter: pending request poll failed"])
  expect(JSON.stringify(warnings)).not.toContain("sensitive upstream detail")
})

test("each delayed alarm reconciles durable rules before polling and isolates failures", async () => {
  const listeners: Array<(alarm: { name: string }) => void> = []
  const events: string[] = []
  const warnings: string[] = []
  let reconciliations = 0
  installChromiumPolling(
    {
      create() {},
      onAlarm: {
        addListener(listener) {
          listeners.push(listener)
        },
      },
    },
    {
      async poll() {
        events.push("poll")
      },
    },
    (message) => warnings.push(message),
    async () => {
      events.push("reconcile")
      reconciliations += 1
      if (reconciliations === 2) throw new Error("sensitive rule detail")
    },
  )
  await tick()
  expect(events).toEqual(["reconcile", "poll"])

  listeners[0]?.({ name: BAIDU_POLL_ALARM })
  await tick()
  expect(events).toEqual(["reconcile", "poll", "reconcile", "poll"])
  expect(warnings).toEqual(["houkago-adapter: Chromium rule reconciliation failed"])
  expect(JSON.stringify(warnings)).not.toContain("sensitive rule detail")
})

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
