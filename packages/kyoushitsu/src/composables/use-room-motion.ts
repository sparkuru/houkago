import { useInterfaceMotion } from "./use-interface-motion"

const ROOM_DURATION_MS = 220
const PANEL_DURATION_MS = 180

export { prefersReducedMotion } from "./use-interface-motion"

export function useRoomMotion() {
  const motion = useInterfaceMotion()

  function enterRoom(target: HTMLElement | null): void {
    motion.run(target, {
      opacity: [0, 1],
      translateY: [10, 0],
      duration: ROOM_DURATION_MS,
      ease: "out(3)",
    })
  }

  function enterPanel(target: HTMLElement | null): void {
    motion.run(target, {
      opacity: [0, 1],
      translateY: [8, 0],
      duration: PANEL_DURATION_MS,
      ease: "out(3)",
    })
  }

  function confirm(target: HTMLElement | null): void {
    motion.run(target, {
      opacity: [0.5, 1],
      scale: [0.98, 1],
      duration: PANEL_DURATION_MS,
      ease: "out(3)",
    })
  }

  return { cancel: motion.cancel, confirm, enterPanel, enterRoom }
}
