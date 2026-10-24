import { ReactLenis, useLenis } from "lenis/react"
import { cancelFrame, frame, useReducedMotion, type FrameData } from "motion/react"
import { useCallback, useEffect } from "react"

/**
 * Inertial page scrolling. Off for people who ask for reduced motion.
 *
 * Lenis is stepped from motion's frame loop rather than its own requestAnimationFrame:
 * with two loops the scroll position and the scroll-linked animations reading it drift
 * a frame apart, which shows as jitter. And only while it has a glide to play
 * (LenisFrames): kept going for good, the loop asked for every frame of an idle page.
 * While a wheel or trackpad glides the page,
 * <html> carries `scrolling`, so cards sliding under the pointer don't start their hover
 * effects (index.css): not even in a glide's slow tail, where a card's hover set off
 * mid-scroll costs frames. Only Lenis's own (smooth) scrolling: after a native scroll
 * (touch, keys, a jump) Lenis reports scrolling for 400 ms, and cards would ignore taps
 * and clicks for that long.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion()
  if (reduced) return <>{children}</>
  return (
    <ReactLenis root options={{ lerp: 0.09, allowNestedScroll: true, autoRaf: false }}>
      <LenisFrames />
      {children}
    </ReactLenis>
  )
}

/** Starts LenisFrames' loop for a programmatic scroll (useScrollTo); wheel input starts it itself. */
let wakeFrames = () => {}

/** Steps Lenis a frame at a time while it glides, and stops a couple of frames after. */
function LenisFrames() {
  const lenis = useLenis()
  useEffect(() => {
    if (!lenis) return
    const root = document.documentElement
    let running = false
    let stillFrames = 0
    const update = ({ timestamp }: FrameData) => {
      lenis.raf(timestamp)
      const gliding = lenis.isScrolling === "smooth"
      // Only on a change: any class change on <html> restyles the whole page.
      if (gliding !== root.classList.contains("scrolling")) root.classList.toggle("scrolling", gliding)
      // A couple of frames' grace: a glide asked for just now starts on Lenis's next step.
      stillFrames = gliding ? 0 : stillFrames + 1
      if (stillFrames > 2) {
        cancelFrame(update)
        running = false
      }
    }
    const wake = () => {
      if (running) return
      running = true
      stillFrames = 0
      lenis.time = 0 // Lenis steps by the time since its last step: not the whole pause
      frame.update(update, true)
    }
    wakeFrames = wake
    const off = lenis.on("virtual-scroll", wake)
    return () => {
      off()
      cancelFrame(update)
      wakeFrames = () => {}
      root.classList.remove("scrolling")
    }
  }, [lenis])
  return null
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
      if (lenis) {
        lenis.scrollTo(el ?? 0, { offset: HEADER_OFFSET, duration: 1.4, immediate: instant, force: instant })
        wakeFrames()
      }
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
