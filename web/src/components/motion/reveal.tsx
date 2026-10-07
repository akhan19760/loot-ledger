import { m, useReducedMotion, type HTMLMotionProps } from "motion/react"
import { ease } from "@/lib/motion"

/**
 * WG content blocks rise into place as they scroll in (they start 5rem low),
 * fading in with INK's fade curve. Animates `transform` rather than `y` so the
 * browser runs it off the main thread and it stays smooth while the page scrolls.
 */
export function Reveal({ delay = 0, y = 80, children, ...props }: HTMLMotionProps<"div"> & { delay?: number; y?: number }) {
  const reduced = useReducedMotion()
  return (
    <m.div
      initial={reduced ? false : { opacity: 0, transform: `translateY(${y}px)` }}
      whileInView={{ opacity: 1, transform: "translateY(0px)" }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ transform: { duration: 1, ease: ease.wg, delay }, opacity: { duration: 0.8, ease: ease.inkFade, delay } }}
      {...props}
    >
      {children}
    </m.div>
  )
}
