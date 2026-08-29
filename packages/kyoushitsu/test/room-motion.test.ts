import { expect, test } from "bun:test"
import { createInterfaceMotionRunner } from "../src/composables/use-interface-motion"
import { prefersReducedMotion } from "../src/composables/use-room-motion"

test("room motion follows the reduced-motion preference", () => {
  const originalMatchMedia = globalThis.matchMedia
  globalThis.matchMedia = () => ({ matches: true }) as MediaQueryList

  try {
    expect(prefersReducedMotion()).toBe(true)
  } finally {
    globalThis.matchMedia = originalMatchMedia
  }
})

test("interface motion skips animation when reduced motion is requested", () => {
  let animationCount = 0
  const runner = createInterfaceMotionRunner({
    animate: () => {
      animationCount += 1
      return { cancel() {} }
    },
    shouldReduceMotion: () => true,
  })

  runner.run({} as HTMLElement, { opacity: [0, 1] })

  expect(animationCount).toBe(0)
})

test("interface motion cancels an existing target when reduced motion takes over", () => {
  let shouldReduceMotion = false
  let cancellationCount = 0
  const runner = createInterfaceMotionRunner({
    animate: () => ({
      cancel: () => {
        cancellationCount += 1
      },
    }),
    shouldReduceMotion: () => shouldReduceMotion,
  })
  const target = {} as HTMLElement

  runner.run(target, { opacity: [0, 1] })
  shouldReduceMotion = true
  runner.run(target, { opacity: [1, 0] })
  runner.cancel()

  expect(cancellationCount).toBe(1)
})

test("interface motion replaces a target animation and cancels the remainder", () => {
  const cancellations: number[] = []
  let animationId = 0
  const runner = createInterfaceMotionRunner({
    animate: () => {
      const id = animationId
      animationId += 1
      return { cancel: () => cancellations.push(id) }
    },
    shouldReduceMotion: () => false,
  })
  const firstTarget = {} as HTMLElement
  const secondTarget = {} as HTMLElement

  runner.run(firstTarget, { opacity: [0, 1] })
  runner.run(firstTarget, { opacity: [1, 0] })
  runner.run(secondTarget, { translateY: [6, 0] })

  expect(cancellations).toEqual([0])
  runner.cancel()
  expect(cancellations).toEqual([0, 1, 2])
})
