import { waapi } from "animejs"
import { onBeforeUnmount } from "vue"

const DURATION_MS = 220

export function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
}

export function useRoomMotion() {
  const animations: Array<ReturnType<typeof waapi.animate>> = []

  function run(target: HTMLElement | null, parameters: Parameters<typeof waapi.animate>[1]): void {
    if (!target || prefersReducedMotion()) return

    const animation = waapi.animate(target, parameters)
    animations.push(animation)
  }

  function enterRoom(target: HTMLElement | null): void {
    run(target, {
      opacity: [0, 1],
      translateY: [10, 0],
      duration: DURATION_MS,
      ease: "out(3)",
    })
  }

  function enterPanel(target: HTMLElement | null): void {
    run(target, {
      opacity: [0, 1],
      translateY: [8, 0],
      duration: 180,
      ease: "out(3)",
    })
  }

  function confirm(target: HTMLElement | null): void {
    run(target, {
      opacity: [0.5, 1],
      scale: [0.98, 1],
      duration: 180,
      ease: "out(3)",
    })
  }

  function cancel(): void {
    for (const animation of animations) animation.cancel()
    animations.length = 0
  }

  onBeforeUnmount(cancel)

  return { cancel, confirm, enterPanel, enterRoom }
}
