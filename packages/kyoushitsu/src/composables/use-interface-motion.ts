import { waapi } from "animejs"
import { onBeforeUnmount } from "vue"

export type InterfaceMotionParameters = Parameters<typeof waapi.animate>[1]

export interface InterfaceMotionAnimation {
  cancel(): void
}

export type InterfaceMotionAnimate = (
  target: HTMLElement,
  parameters: InterfaceMotionParameters,
) => InterfaceMotionAnimation

interface InterfaceMotionOptions {
  animate?: InterfaceMotionAnimate
  shouldReduceMotion?: () => boolean
}

export function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
}

export function createInterfaceMotionRunner(options: InterfaceMotionOptions = {}) {
  const animate: InterfaceMotionAnimate =
    options.animate ?? ((target, parameters) => waapi.animate(target, parameters))
  const shouldReduceMotion = options.shouldReduceMotion ?? prefersReducedMotion
  const animations = new Map<HTMLElement, InterfaceMotionAnimation>()

  function run(target: HTMLElement | null, parameters: InterfaceMotionParameters): void {
    if (!target) return

    animations.get(target)?.cancel()
    animations.delete(target)
    if (shouldReduceMotion()) return

    animations.set(target, animate(target, parameters))
  }

  function cancel(target?: HTMLElement | null): void {
    if (target) {
      animations.get(target)?.cancel()
      animations.delete(target)
      return
    }

    for (const animation of animations.values()) animation.cancel()
    animations.clear()
  }

  return { cancel, run }
}

export function useInterfaceMotion() {
  const motion = createInterfaceMotionRunner()
  onBeforeUnmount(() => motion.cancel())
  return motion
}
