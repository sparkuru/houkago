import { useInterfaceMotion } from "./use-interface-motion"

const SIGN_DURATION_MS = 180
const SURFACE_DURATION_MS = 180
const SURFACE_STAGGER_MS = 35
const PANEL_DURATION_MS = 180

export function useEntryMotion() {
  const motion = useInterfaceMotion()

  function enterFloor(
    floorSign: HTMLElement | null,
    surfaces: readonly (HTMLElement | null)[],
  ): void {
    motion.run(floorSign, {
      opacity: [0, 1],
      translateY: [6, 0],
      duration: SIGN_DURATION_MS,
      ease: "out(3)",
    })

    for (const [index, surface] of surfaces.entries()) {
      motion.run(surface, {
        opacity: [0, 1],
        translateX: [8, 0],
        delay: SURFACE_STAGGER_MS * (index + 1),
        duration: SURFACE_DURATION_MS,
        ease: "out(3)",
      })
    }
  }

  function replacePanel(target: HTMLElement | null): void {
    motion.run(target, {
      opacity: [0, 1],
      translateY: [6, 0],
      duration: PANEL_DURATION_MS,
      ease: "out(3)",
    })
  }

  return { cancel: motion.cancel, enterFloor, replacePanel }
}
