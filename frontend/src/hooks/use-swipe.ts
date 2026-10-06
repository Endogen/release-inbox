import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react"

export type SwipeDirection = "left" | "right"
type SwipePhase = "idle" | "dragging" | "leaving"

interface SwipeOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
}

interface Gesture {
  pointerId: number
  startX: number
  startY: number
  width: number
  engaged: boolean
}

/** Movement before a gesture is recognised as either a horizontal swipe or a scroll. */
const SLOP_PX = 10
/** A swipe triggers once it covers this share of the element's width (capped below). */
const TRIGGER_RATIO = 0.35
const MAX_TRIGGER_PX = 140
/** How far an element can be pulled in a direction that has no action. */
const BLOCKED_MAX_PX = 24
const LEAVE_MS = 180

/**
 * Horizontal swipe gestures for a list row, using pointer events (touch, pen and mouse).
 * Vertical movement is left to the browser so the list still scrolls; give the element
 * `touch-action: pan-y`.
 */
export function useSwipe({ onSwipeLeft, onSwipeRight }: SwipeOptions) {
  const [offset, setOffset] = useState(0)
  const [phase, setPhase] = useState<SwipePhase>("idle")
  const [armed, setArmed] = useState(false)
  const gesture = useRef<Gesture | null>(null)
  const offsetRef = useRef(0)
  const triggeredRef = useRef(false)
  const suppressClick = useRef(false)
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(leaveTimer.current), [])

  const enabled = Boolean(onSwipeLeft || onSwipeRight)
  const handlerFor = (dx: number) => (dx < 0 ? onSwipeLeft : onSwipeRight)
  const triggerDistance = (width: number) => Math.min(MAX_TRIGGER_PX, width * TRIGGER_RATIO)

  const moveTo = useCallback((value: number) => {
    offsetRef.current = value
    setOffset(value)
  }, [])

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    // A touch drag fires no click, so a stale flag from the previous gesture must not
    // swallow this one.
    suppressClick.current = false
    if (!enabled || phase === "leaving" || (event.pointerType === "mouse" && event.button !== 0)) {
      return
    }
    gesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      width: event.currentTarget.getBoundingClientRect().width,
      engaged: false,
    }
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId) return
    const dx = event.clientX - current.startX
    const dy = event.clientY - current.startY

    if (!current.engaged) {
      if (Math.abs(dy) > SLOP_PX && Math.abs(dy) > Math.abs(dx)) {
        gesture.current = null
        return
      }
      if (Math.abs(dx) < SLOP_PX) return
      current.engaged = true
      event.currentTarget.setPointerCapture(event.pointerId)
      setPhase("dragging")
    }

    const next = handlerFor(dx) ? dx : Math.sign(dx) * Math.min(Math.abs(dx) * 0.2, BLOCKED_MAX_PX)
    const triggered = Boolean(handlerFor(dx)) && Math.abs(next) >= triggerDistance(current.width)
    if (triggered && !triggeredRef.current) navigator.vibrate?.(10)
    triggeredRef.current = triggered
    setArmed(triggered)
    moveTo(next)
  }

  function finish(event: PointerEvent<HTMLElement>, completed: boolean) {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId) return
    gesture.current = null
    if (!current.engaged) return

    // Swallow the click the browser may fire right after the drag (mouse), but don't let
    // the flag outlive this gesture (touch drags fire no click at all).
    suppressClick.current = true
    setTimeout(() => {
      suppressClick.current = false
    }, 0)
    const dx = offsetRef.current
    const handler = handlerFor(dx)
    triggeredRef.current = false

    if (completed && handler && Math.abs(dx) >= triggerDistance(current.width)) {
      setPhase("leaving")
      moveTo(Math.sign(dx) * current.width)
      leaveTimer.current = setTimeout(() => {
        handler()
        setArmed(false)
        setPhase("idle")
        moveTo(0)
      }, LEAVE_MS)
    } else {
      setArmed(false)
      setPhase("idle")
      moveTo(0)
    }
  }

  /** Swallows the click that follows a swipe, so it doesn't also select the row. */
  function onClickCapture(event: MouseEvent<HTMLElement>) {
    if (!suppressClick.current) return
    suppressClick.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  const direction: SwipeDirection | null = offset < 0 ? "left" : offset > 0 ? "right" : null

  return {
    offset,
    phase,
    direction,
    armed,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (event: PointerEvent<HTMLElement>) => finish(event, true),
      onPointerCancel: (event: PointerEvent<HTMLElement>) => finish(event, false),
      onClickCapture,
    },
  }
}
