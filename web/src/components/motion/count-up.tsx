import { animate, useInView, useReducedMotion } from "motion/react"
import { useEffect, useEffectEvent, useRef } from "react"
import { formatCount } from "@/lib/format"
import { ease } from "@/lib/motion"

/**
 * Number that counts up to its value (like WG's live FPS readout) and eases to each
 * new value when it changes. Writes to the DOM directly, so it doesn't re-render.
 */
export function CountUp({ value, duration = 1.2, format = formatCount }: { value: number; duration?: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const from = useRef(0)
  const inView = useInView(ref, { once: true })
  const reduced = useReducedMotion()
  const write = useEffectEvent((n: number) => {
    if (ref.current) ref.current.textContent = format(Math.round(n))
  })

  useEffect(() => {
    if (!inView) return
    const start = from.current
    from.current = value
    if (reduced) return write(value)
    const controls = animate(start, value, { duration, ease: ease.wg, onUpdate: write })
    return () => controls.stop()
  }, [value, inView, reduced, duration])

  return (
    <span ref={ref} className="tabular-nums">
      {format(0)}
    </span>
  )
}
