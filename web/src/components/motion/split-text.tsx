import { motion, useInView, useReducedMotion } from "motion/react"
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
            <motion.span
              className={cn("inline-block will-change-transform", partClassName?.(part, i))}
              style={partStyle?.(part, i)}
              initial={reduced ? false : { y: "102%" }}
              animate={show ? { y: "0%" } : undefined}
              transition={{ duration: 0.8, ease: ease.inkSlide, delay: delay + i * stagger }}
            >
              {part}
            </motion.span>
          </span>
        ),
      )}
    </span>
  )
}
