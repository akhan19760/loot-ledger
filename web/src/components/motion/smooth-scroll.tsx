import { ReactLenis, useLenis, type LenisRef } from "lenis/react"
import { cancelFrame, frame, useReducedMotion, type FrameData } from "motion/react"
import { useCallback, useEffect, useRef } from "react"

/** Scroll speed, in px a frame, above which game cards ignore the pointer (see index.css). */
const FAST_SCROLL = 4

/**
 * Inertial page scrolling. Off for people who ask for reduced motion.
 *
 * Lenis is stepped from motion's frame loop rather than its own requestAnimationFrame:
 * with two loops the scroll position and the scroll-linked animations reading it drift
 * a frame apart, which shows as jitter. While a wheel or trackpad scrolls the page fast,
 * <html> carries `scrolling-fast`, so cards sliding under the pointer don't start their
 * hover effects. Only Lenis's own (smooth) scrolling: after a native scroll (touch, keys,
 * a jump) Lenis holds the whole jump as its velocity for 400 ms, and cards would ignore
 * taps and clicks for that long.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion()
  const lenis = useRef<LenisRef>(null)

  useEffect(() => {
    if (reduced) return
    const root = document.documentElement
    const update = ({ timestamp }: FrameData) => {
      const instance = lenis.current?.lenis
      if (!instance) return
      instance.raf(timestamp)
      root.classList.toggle("scrolling-fast", instance.isScrolling === "smooth" && Math.abs(instance.velocity) > FAST_SCROLL)
    }
    frame.update(update, true)
    return () => {
      cancelFrame(update)
      root.classList.remove("scrolling-fast")
    }
  }, [reduced])

  if (reduced) return <>{children}</>
  return (
    <ReactLenis root ref={lenis} options={{ lerp: 0.09, allowNestedScroll: true, autoRaf: false }}>
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
