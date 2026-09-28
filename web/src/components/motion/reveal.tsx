import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react"
import { ease } from "@/lib/motion"

/**
 * WG content blocks rise into place as they scroll in (they start 5rem low),
 * fading in with INK's fade curve.
 */
export function Reveal({ delay = 0, y = 80, children, ...props }: HTMLMotionProps<"div"> & { delay?: number; y?: number }) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ y: { duration: 1, ease: ease.wg, delay }, opacity: { duration: 0.8, ease: ease.inkFade, delay } }}
      {...props}
    >
      {children}
    </motion.div>
  )
}
