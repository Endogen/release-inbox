import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react"

export type SwipeDirection = "left" | "right"
type SwipePhase = "idle" | "dragging" | "leaving"

interface RowGestureOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  /** Holding a finger (or pen) on the row without moving it. Not for mouse buttons. */
  onLongPress?: () => void
}

interface Gesture {
  pointerId: number
  startX: number
  startY: number
  width: number
  /** Moved far enough horizontally to be a swipe. */
  engaged: boolean
  /** Held long enough without moving to be a long press. */
  held: boolean
}

/** Movement before a gesture is recognised as a swipe, a scroll, or no long press. */
const SLOP_PX = 10
/** A swipe triggers once it covers this share of the element's width (capped below). */
const TRIGGER_RATIO = 0.35
const MAX_TRIGGER_PX = 140
/** How far an element can be pulled in a direction that has no action. */
const BLOCKED_MAX_PX = 24
const LEAVE_MS = 180
const LONG_PRESS_MS = 500

/**
 * Swipes and long presses on a list row, using pointer events. Vertical movement is left to
 * the browser so the list still scrolls; give the element `touch-action: pan-y`.
 *
 * A long press acts when the finger lifts: browsers only allow some actions, like writing to
 * the clipboard, in response to that.
 */
export function useRowGestures({ onSwipeLeft, onSwipeRight, onLongPress }: RowGestureOptions) {
  const [offset, setOffset] = useState(0)
  const [phase, setPhase] = useState<SwipePhase>("idle")
  const [armed, setArmed] = useState(false)
  const [held, setHeld] = useState(false)
  const gesture = useRef<Gesture | null>(null)
  const offsetRef = useRef(0)
  const triggeredRef = useRef(false)
  const suppressClick = useRef(false)
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(
    () => () => {
      clearTimeout(leaveTimer.current)
      clearTimeout(holdTimer.current)
    },
    []
  )

  const canSwipe = Boolean(onSwipeLeft || onSwipeRight)
  const handlerFor = (dx: number) => (dx < 0 ? onSwipeLeft : onSwipeRight)
  const triggerDistance = (width: number) => Math.min(MAX_TRIGGER_PX, width * TRIGGER_RATIO)

  const moveTo = useCallback((value: number) => {
    offsetRef.current = value
    setOffset(value)
  }, [])

  function cancelHold() {
    clearTimeout(holdTimer.current)
    setHeld(false)
  }

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    // A touch drag fires no click, so a stale flag from the previous gesture must not
    // swallow this one.
    suppressClick.current = false
    const mouse = event.pointerType === "mouse"
    const canLongPress = Boolean(onLongPress) && !mouse
    if ((!canSwipe && !canLongPress) || phase === "leaving" || (mouse && event.button !== 0)) {
      return
    }
    const current: Gesture = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      width: event.currentTarget.getBoundingClientRect().width,
      engaged: false,
      held: false,
    }
    gesture.current = current
    if (canLongPress) {
      holdTimer.current = setTimeout(() => {
        current.held = true
        setHeld(true)
        navigator.vibrate?.(10)
      }, LONG_PRESS_MS)
    }
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId) return
    const dx = event.clientX - current.startX
    const dy = event.clientY - current.startY

    if (!current.engaged) {
      if (Math.abs(dx) < SLOP_PX && Math.abs(dy) < SLOP_PX) return
      // Moving the finger ends a long press, whether it becomes a scroll or a swipe.
      cancelHold()
      current.held = false
      if (!canSwipe || (Math.abs(dy) > SLOP_PX && Math.abs(dy) > Math.abs(dx))) {
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

  /** Swallow the click the browser may fire after the gesture, but only for this one. */
  function suppressNextClick() {
    suppressClick.current = true
    setTimeout(() => {
      suppressClick.current = false
    }, 0)
  }

  function finish(event: PointerEvent<HTMLElement>, completed: boolean) {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId) return
    gesture.current = null
    cancelHold()

    if (current.held) {
      // Also on a cancel: some browsers cancel a held touch to offer their own long-press
      // menu, and a held press can't be a scroll, since moving ends it.
      suppressNextClick()
      onLongPress?.()
      return
    }
    if (!current.engaged) return

    suppressNextClick()
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

  /** Swallows the click that follows a gesture, so it doesn't also select the row. */
  function onClickCapture(event: MouseEvent<HTMLElement>) {
    if (!suppressClick.current) return
    suppressClick.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  /** Phones open their own menu on a long press; the row's long press replaces it. */
  function onContextMenu(event: MouseEvent<HTMLElement>) {
    if (onLongPress && gesture.current) event.preventDefault()
  }

  const direction: SwipeDirection | null = offset < 0 ? "left" : offset > 0 ? "right" : null

  return {
    offset,
    phase,
    direction,
    armed,
    /** A long press is ready and acts when the finger lifts. */
    held,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (event: PointerEvent<HTMLElement>) => finish(event, true),
      onPointerCancel: (event: PointerEvent<HTMLElement>) => finish(event, false),
      onClickCapture,
      onContextMenu,
    },
  }
}
