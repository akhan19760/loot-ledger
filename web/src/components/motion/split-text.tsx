import { m, useInView, useReducedMotion } from "motion/react"
import { useRef } from "react"
import { cn } from "cn"
import { ease } from "@/lib/motion"

/**
 * INK split-text reveal: each word (or letter) slides up from 102% behind a mask,
 * staggered, with INK's 0.8 s ease. Plays once when scrolled into view (or on mount).
 */
export function SplitText({
  text,
  by = "word",
  delay = 0,
  stagger = 0.06,
  className,
  partClassName,
  partStyle,
  onMount = false,
  still = false,
}: {
  text: string
  by?: "word" | "letter"
  delay?: number
  stagger?: number
  className?: string
  /** Extra classes for one word/letter (e.g. the neon gradient on a single word). */
  partClassName?: (part: string, index: number) => string | undefined
  /** Inline style for one word/letter. */
  partStyle?: (part: string, index: number) => React.CSSProperties | undefined
  /** Play immediately (when true) instead of waiting for the element to enter the viewport. */
  onMount?: boolean
  /** Show the parts in place at once, without the reveal. */
  still?: boolean
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" })
  const reduced = useReducedMotion()
  const show = onMount || inView
  const parts = by === "word" ? text.split(/(\s+)/) : [...text]

  return (
    <span ref={ref} className={cn("inline-block", className)} aria-label={text}>
      {parts.map((part, i) =>
        /^\s+$/.test(part) ? (
          <span key={i}>{part}</span>
        ) : (
          <span key={i} aria-hidden className="inline-block overflow-hidden pb-[0.08em] align-bottom">
            {/* `transform` rather than `y`, so the browser runs it off the main thread */}
            <m.span
              className={cn("inline-block", partClassName?.(part, i))}
              style={partStyle?.(part, i)}
              data-part
              initial={reduced || still ? false : { transform: "translateY(102%)" }}
              animate={show ? { transform: "translateY(0%)" } : undefined}
              transition={{ duration: 0.8, ease: ease.inkSlide, delay: delay + i * stagger }}
            >
              {part}
            </m.span>
          </span>
        ),
      )}
    </span>
  )
}
