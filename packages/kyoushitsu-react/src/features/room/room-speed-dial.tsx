import type { CSSProperties, ReactNode, PointerEvent as ReactPointerEvent, RefObject } from "react"
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  ROOM_FLOATING_POSITION_INSET,
  type RoomFloatingBounds,
  type RoomFloatingPosition,
  clampRoomFloatingPosition,
  loadRoomFloatingPosition,
  roomFloatingPositionFromPixels,
  roomFloatingPositionToPixels,
  saveRoomFloatingPosition,
} from "./room-floating-position"

export type RoomSpeedDialAction = {
  id: string
  label: string
  icon: ReactNode
  onActivate: () => void
  selected?: boolean
  opensDialog?: boolean
}

type RoomSpeedDialProps = {
  actions: RoomSpeedDialAction[]
  launcherRef: RefObject<HTMLButtonElement | null>
  launcherLabel: string
  closeLabel: string
  cinemaMode?: boolean
  hidden?: boolean
}

type DragState = {
  pointerId: number
  startX: number
  startY: number
  startLeft: number
  startTop: number
  moved: boolean
}

const LAUNCHER_SIZE = 52
const DRAG_THRESHOLD = 4
const DRAG_KEY_STEP = 16
const DRAG_CLICK_SUPPRESSION_MS = 250
const MENU_GAP = 12
const MENU_MIN_HEIGHT = 52

function initialBounds(): RoomFloatingBounds {
  return {
    viewportWidth: typeof window === "undefined" ? 1024 : window.innerWidth,
    viewportHeight: typeof window === "undefined" ? 768 : window.innerHeight,
    elementWidth: LAUNCHER_SIZE,
    elementHeight: LAUNCHER_SIZE,
  }
}

function parseInset(value: string | undefined): number {
  const parsed = Number.parseFloat(value ?? "")
  return Number.isFinite(parsed) ? parsed : ROOM_FLOATING_POSITION_INSET
}

function isFixedDock(element: Element | null): element is HTMLElement {
  return Boolean(element && getComputedStyle(element).position === "fixed")
}

export function RoomSpeedDial({
  actions,
  launcherRef,
  launcherLabel,
  closeLabel,
  cinemaMode = false,
  hidden = false,
}: RoomSpeedDialProps) {
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [position, setPosition] = useState<RoomFloatingPosition>(() => loadRoomFloatingPosition())
  const [bounds, setBounds] = useState<RoomFloatingBounds>(initialBounds)
  const [menuPlacement, setMenuPlacement] = useState<"above" | "below">(() =>
    position.y < 0.45 ? "below" : "above",
  )
  const [menuDockOffset, setMenuDockOffset] = useState(0)
  const [menuMaxHeight, setMenuMaxHeight] = useState<number | null>(null)
  const actionsId = useId()
  const dragHintId = useId()
  const firstActionRef = useRef<HTMLButtonElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const speedDialRef = useRef<HTMLDivElement>(null)
  const wasOpen = useRef(false)
  const dragRef = useRef<DragState | null>(null)
  const positionRef = useRef(position)
  const boundsRef = useRef(bounds)
  const suppressClickRef = useRef(false)
  const suppressClickTimerRef = useRef<number | null>(null)

  boundsRef.current = bounds
  positionRef.current = position

  const dismiss = useCallback(() => setOpen(false), [])

  const updatePosition = useCallback((next: RoomFloatingPosition) => {
    const clamped = clampRoomFloatingPosition(next, boundsRef.current)
    positionRef.current = clamped
    setPosition(clamped)
    saveRoomFloatingPosition(clamped)
  }, [])

  const measureViewport = useCallback(() => {
    if (typeof window === "undefined") return
    const launcher = launcherRef.current
    if (!launcher) return

    const layerStyle = layerRef.current ? getComputedStyle(layerRef.current) : null
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight
    const launcherRect = launcher.getBoundingClientRect()
    const dock = document.querySelector<HTMLElement>(".room-chat-rail")
    const dockRect = dock?.getBoundingClientRect()
    const dockRightInset =
      isFixedDock(dock) && dockRect && dockRect.width > 0
        ? Math.max(ROOM_FLOATING_POSITION_INSET, viewportWidth - dockRect.left + 32)
        : ROOM_FLOATING_POSITION_INSET

    const nextBounds: RoomFloatingBounds = {
      viewportWidth,
      viewportHeight,
      elementWidth: launcherRect.width || LAUNCHER_SIZE,
      elementHeight: launcherRect.height || LAUNCHER_SIZE,
      safeArea: {
        top: parseInset(layerStyle?.paddingTop),
        right: Math.max(parseInset(layerStyle?.paddingRight), dockRightInset),
        bottom: parseInset(layerStyle?.paddingBottom),
        left: parseInset(layerStyle?.paddingLeft),
      },
    }
    boundsRef.current = nextBounds
    setBounds(nextBounds)
    updatePosition(positionRef.current)
  }, [launcherRef, updatePosition])

  // biome-ignore lint/correctness/useExhaustiveDependencies: cinema changes the dock from static to fixed through CSS, so re-measure after the class update.
  useLayoutEffect(() => {
    if (hidden) return
    measureViewport()
    let resizeFrame: number | null = null
    const onViewportResize = () => {
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame)
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = null
        measureViewport()
      })
    }
    window.addEventListener("resize", onViewportResize)
    window.visualViewport?.addEventListener("resize", onViewportResize)
    const observer =
      typeof ResizeObserver === "undefined" || !layerRef.current
        ? null
        : new ResizeObserver(onViewportResize)
    if (observer && layerRef.current) observer.observe(layerRef.current)
    return () => {
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame)
      window.removeEventListener("resize", onViewportResize)
      window.visualViewport?.removeEventListener("resize", onViewportResize)
      observer?.disconnect()
    }
  }, [cinemaMode, hidden, measureViewport])

  useLayoutEffect(() => {
    if (hidden || typeof window === "undefined") {
      setMenuDockOffset(0)
      return
    }
    const speedDial = speedDialRef.current
    if (!speedDial) return
    const launcher = launcherRef.current
    const dock = document.querySelector<HTMLElement>(".room-chat-rail")
    const launcherRect = launcher?.getBoundingClientRect()
    const dockRect = dock?.getBoundingClientRect()
    const menuDockOffset =
      isFixedDock(dock) && launcherRect && dockRect && launcherRect.right > dockRect.left
        ? Math.max(0, launcherRect.right - dockRect.left + 8)
        : 0
    setMenuDockOffset(menuDockOffset)
    const rect = speedDial.getBoundingClientRect()
    const topInset = Math.max(ROOM_FLOATING_POSITION_INSET, bounds.safeArea?.top ?? 0)
    const bottomInset = Math.max(ROOM_FLOATING_POSITION_INSET, bounds.safeArea?.bottom ?? 0)
    const aboveAvailable = Math.max(0, rect.top - topInset - MENU_GAP)
    const belowAvailable = Math.max(0, window.innerHeight - rect.bottom - bottomInset - MENU_GAP)
    const preferredPlacement = position.y < 0.45 ? "below" : "above"
    const placement =
      preferredPlacement === "above" &&
      aboveAvailable < MENU_MIN_HEIGHT &&
      belowAvailable > aboveAvailable
        ? "below"
        : preferredPlacement === "below" &&
            belowAvailable < MENU_MIN_HEIGHT &&
            aboveAvailable > belowAvailable
          ? "above"
          : preferredPlacement
    setMenuPlacement(placement)
    setMenuMaxHeight(
      Math.max(MENU_MIN_HEIGHT, placement === "above" ? aboveAvailable : belowAvailable),
    )
  }, [bounds, hidden, launcherRef, position])

  useEffect(() => {
    if (!hidden) return
    dragRef.current = null
    setDragging(false)
    setOpen(false)
  }, [hidden])

  useEffect(() => {
    if (!open || hidden) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        dismiss()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [dismiss, hidden, open])

  useEffect(() => {
    if (hidden) return
    if (open) {
      wasOpen.current = true
      firstActionRef.current?.focus()
      return
    }
    if (wasOpen.current) {
      wasOpen.current = false
      launcherRef.current?.focus()
    }
  }, [hidden, launcherRef, open])

  useEffect(
    () => () => {
      if (suppressClickTimerRef.current !== null) {
        window.clearTimeout(suppressClickTimerRef.current)
      }
    },
    [],
  )

  const suppressNextClick = useCallback(() => {
    suppressClickRef.current = true
    if (suppressClickTimerRef.current !== null) {
      window.clearTimeout(suppressClickTimerRef.current)
    }
    suppressClickTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false
      suppressClickTimerRef.current = null
    }, DRAG_CLICK_SUPPRESSION_MS)
  }, [])

  const beginDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    const pixels = roomFloatingPositionToPixels(positionRef.current, boundsRef.current)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: pixels.left,
      startTop: pixels.top,
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [])

  const moveDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      const deltaX = event.clientX - drag.startX
      const deltaY = event.clientY - drag.startY
      if (!drag.moved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return
      drag.moved = true
      setDragging(true)
      updatePosition(
        roomFloatingPositionFromPixels(
          { left: drag.startLeft + deltaX, top: drag.startTop + deltaY },
          boundsRef.current,
        ),
      )
    },
    [updatePosition],
  )

  const endDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      dragRef.current = null
      setDragging(false)
      if (drag.moved) suppressNextClick()
    },
    [suppressNextClick],
  )

  const nudge = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const delta = DRAG_KEY_STEP * (event.shiftKey ? 2 : 1)
      const changes: Record<string, { left: number; top: number }> = {
        ArrowLeft: { left: -delta, top: 0 },
        ArrowRight: { left: delta, top: 0 },
        ArrowUp: { left: 0, top: -delta },
        ArrowDown: { left: 0, top: delta },
      }
      const change = changes[event.key]
      if (!change) return
      event.preventDefault()
      const pixels = roomFloatingPositionToPixels(positionRef.current, boundsRef.current)
      updatePosition(
        roomFloatingPositionFromPixels(
          { left: pixels.left + change.left, top: pixels.top + change.top },
          boundsRef.current,
        ),
      )
    },
    [updatePosition],
  )

  const pixels = roomFloatingPositionToPixels(position, bounds)
  const visibilityDelay = `${Math.max(0, actions.length - 1) * 45 + 260}ms`
  const menuSide = position.x < 0.3 ? "right" : "left"
  const speedDialStyle = {
    left: `${pixels.left}px`,
    top: `${pixels.top}px`,
    right: "auto",
    bottom: "auto",
    "--room-speed-dial-action-count": actions.length,
    "--room-speed-dial-hide-delay": visibilityDelay,
    "--room-speed-dial-action-max-height":
      menuMaxHeight === null ? undefined : `${menuMaxHeight}px`,
    "--room-speed-dial-menu-right-offset": `${menuDockOffset}px`,
  } as CSSProperties

  if (hidden || typeof document === "undefined" || !document.body) return null

  return createPortal(
    <div ref={layerRef} className="room-speed-dial-layer">
      <div
        aria-hidden="true"
        data-open={open ? "true" : "false"}
        className="room-speed-dial-backdrop"
        onPointerDown={(event) => {
          event.preventDefault()
          dismiss()
        }}
      />
      <div
        ref={speedDialRef}
        className="room-speed-dial"
        data-dragging={dragging ? "true" : "false"}
        data-menu-placement={menuPlacement}
        data-menu-side={menuSide}
        data-open={open ? "true" : "false"}
        style={speedDialStyle}
      >
        <ul
          id={actionsId}
          className="room-speed-dial-actions"
          aria-label={launcherLabel}
          aria-hidden={!open}
          inert={!open}
        >
          {actions.map((action, index) => (
            <li key={action.id}>
              <button
                ref={index === 0 ? firstActionRef : undefined}
                type="button"
                className="room-speed-dial-action"
                style={{ "--room-speed-dial-action-index": index } as CSSProperties}
                aria-label={action.label}
                aria-pressed={action.selected}
                aria-haspopup={action.opensDialog ? "dialog" : undefined}
                onClick={() => {
                  action.onActivate()
                  dismiss()
                }}
              >
                <span className="room-speed-dial-label" aria-hidden="true">
                  {action.label}
                </span>
                <span className="room-speed-dial-icon" aria-hidden="true">
                  {action.icon}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <span id={dragHintId} className="room-speed-dial-hint">
          使用方向键移动按钮；按 Enter 打开快捷菜单。
        </span>
        <button
          ref={launcherRef}
          type="button"
          className="room-speed-dial-launcher"
          data-dragging={dragging ? "true" : "false"}
          aria-label={open ? closeLabel : launcherLabel}
          aria-describedby={dragHintId}
          aria-controls={actionsId}
          aria-expanded={open}
          onClick={(event) => {
            if (suppressClickRef.current) {
              event.preventDefault()
              suppressClickRef.current = false
              return
            }
            setOpen((current) => !current)
          }}
          onKeyDown={nudge}
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
    </div>,
    document.body,
  )
}
