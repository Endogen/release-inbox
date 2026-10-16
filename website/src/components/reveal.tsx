"use client"

import { useEffect, useRef, type ComponentProps } from "react"

/** Fades its content in and up once it scrolls into view; `delay` staggers siblings. */
export function Reveal({
  delay = 0,
  style,
  ...props
}: ComponentProps<"div"> & { delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        element.dataset.reveal = "visible"
        observer.disconnect()
      },
      { rootMargin: "0px 0px -10% 0px" }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      data-reveal=""
      style={{ ...style, ["--reveal-delay" as string]: `${delay}ms` }}
      {...props}
    />
  )
}
