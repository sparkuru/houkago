import { t } from "houkago-kyoushitsu-core/i18n"
import { type ReactNode, type RefObject, useLayoutEffect, useRef } from "react"

export function PlayerPanel({
  id,
  label,
  heading = label,
  className = "",
  open,
  anchor,
  onClose,
  children,
}: {
  id: string
  label: string
  heading?: string
  className?: string
  open: boolean
  anchor: RefObject<HTMLElement | null>
  onClose: () => void
  children: ReactNode
}) {
  const node = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const panel = node.current
    if (!open || !panel || !anchor.current) return
    const position = () => {
      const viewport = window.visualViewport
      const top = (viewport?.offsetTop ?? 0) + 16
      const left = (viewport?.offsetLeft ?? 0) + 16
      const width = (viewport?.width ?? innerWidth) - 32
      const height = (viewport?.height ?? innerHeight) - 32
      panel.style.maxWidth = `${Math.max(0, width)}px`
      panel.style.maxHeight = `min(480px, ${Math.max(0, height)}px, calc(100dvh - 32px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)))`
      const bounds = panel.getBoundingClientRect()
      const target = anchor.current?.getBoundingClientRect()
      if (!target) return
      const x = Math.max(left, Math.min(target.right - bounds.width, left + width - bounds.width))
      const y = Math.max(
        top,
        Math.min(target.top - bounds.height - 8, top + height - bounds.height),
      )
      panel.style.left = `max(env(safe-area-inset-left, 0px), ${x}px)`
      panel.style.top = `max(env(safe-area-inset-top, 0px), ${y}px)`
    }
    const observer = new ResizeObserver(position)
    observer.observe(panel)
    observer.observe(anchor.current)
    window.addEventListener("resize", position)
    window.addEventListener("scroll", position, true)
    window.visualViewport?.addEventListener("resize", position)
    window.visualViewport?.addEventListener("scroll", position)
    position()
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", position)
      window.removeEventListener("scroll", position, true)
      window.visualViewport?.removeEventListener("resize", position)
      window.visualViewport?.removeEventListener("scroll", position)
    }
  }, [open, anchor])
  return (
    <section
      ref={node}
      id={id}
      className={`player-panel ${className}`}
      aria-label={label}
      hidden={!open}
    >
      <div className="player-panel-heading">
        <strong>{heading}</strong>
        <button className="player-panel-close" type="button" onClick={onClose}>
          {t("playerClose")}
        </button>
      </div>
      {children}
    </section>
  )
}
