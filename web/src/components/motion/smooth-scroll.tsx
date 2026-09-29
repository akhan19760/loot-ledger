import { ReactLenis, useLenis } from "lenis/react"
import { useReducedMotion } from "motion/react"
import { useCallback, useEffect } from "react"

/** Inertial page scrolling. Off for people who ask for reduced motion. */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion()
  if (reduced) return <>{children}</>
  return (
    <ReactLenis root options={{ lerp: 0.09, allowNestedScroll: true }}>
      {children}
    </ReactLenis>
  )
}

const HEADER_OFFSET = -96

/** Scroll to an element id (or the top), below the fixed header. `instant` jumps there, say after a page change. */
export function useScrollTo() {
  const lenis = useLenis()
  return useCallback(
    (target: string | 0, { instant = false } = {}) => {
      const el = target === 0 ? null : document.getElementById(target)
      if (target !== 0 && !el) return
      const behavior = instant ? "instant" : "smooth"
      if (lenis) lenis.scrollTo(el ?? 0, { offset: HEADER_OFFSET, duration: 1.4, immediate: instant, force: instant })
      else if (el) el.scrollIntoView({ behavior })
      else window.scrollTo({ top: 0, behavior })
    },
    [lenis],
  )
}

/** Pause smooth scrolling while `locked` (e.g. an open dialog scrolls itself). */
export function useScrollLock(locked: boolean) {
  const lenis = useLenis()
  useEffect(() => {
    if (!lenis) return
    if (locked) lenis.stop()
    else lenis.start()
  }, [lenis, locked])
}
