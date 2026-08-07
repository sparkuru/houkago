import type { AdapterRuntime } from "./runtime"
import type { ChromiumAlarms } from "./types"

export const BAIDU_POLL_ALARM = "baidu-pending-poll"
export const BAIDU_POLL_PERIOD_MINUTES = 0.5

export function installChromiumPolling(
  alarms: ChromiumAlarms,
  runtime: Pick<AdapterRuntime, "poll">,
  warn: (message: string) => void = console.warn,
): void {
  const poll = () => {
    void runtime.poll().catch(() => warn("houkago-adapter: pending request poll failed"))
  }
  alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === BAIDU_POLL_ALARM) poll()
  })
  alarms.create(BAIDU_POLL_ALARM, { periodInMinutes: BAIDU_POLL_PERIOD_MINUTES })
  poll()
}
