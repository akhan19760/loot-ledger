import { cancelFrame, frame, useMotionValueEvent, useReducedMotion, type MotionValue } from "motion/react"
import { useEffect, useRef, useState } from "react"
import type { ControllerView } from "@/lib/controller-host"

const LENGTH = 10 // the sequence's length (controller-scene.ts)
// WG scrubs with `scrub: 1`: the animation takes about a second to catch up with the scroll.
const CATCH_UP = 5 // per second

// Centred on the screen while it plays, a little shorter than it so the controller can come
// to rest above the wordmark. Fades in once the scene has drawn.
const CANVAS_CLASS = "sticky top-[7.5svh] block h-[85svh] w-full opacity-0 transition-opacity duration-700"

/** Resolves once the page hasn't scrolled for `ms` (or `signal` aborts). */
function whenStill(signal: AbortSignal, ms = 250) {
  return new Promise<void>((resolve) => {
    let timer = setTimeout(done, ms)
    function done() {
      clearTimeout(timer)
      window.removeEventListener("scroll", wait)
      resolve()
    }
    function wait() {
      clearTimeout(timer)
      timer = setTimeout(done, ms)
    }
    window.addEventListener("scroll", wait, { passive: true })
    signal.addEventListener("abort", done)
  })
}

/** Where in the sequence a scroll progress lands: GSAP's default ease, power1.out. */
const positionAt = (progress: number, still: boolean | null) => (still ? LENGTH : LENGTH * (1 - (1 - progress) ** 2))

/**
 * WG's 3D controller (the section after their hero): it rises out of the bottom of the
 * screen, tumbles, spins round and settles as you scroll. Sticky, so it stays in view
 * while it plays, and scrubbed by `progress` (0–1), eased as WG's GSAP tween is
 * (power1.out). three.js and the model load only when the footer comes near, and draw in a
 * worker where the browser allows (controller-host.ts); under reduced motion the controller
 * is shown at rest, in its final pose.
 */
export function FooterController({ progress, className }: { progress: MotionValue<number>; className?: string }) {
  const reduced = useReducedMotion()
  const layer = useRef<HTMLDivElement>(null)
  const view = useRef<ControllerView | null>(null)
  const [near, setNear] = useState(false)

  const shown = useRef(0)
  const loop = useRef<((data: { delta: number }) => void) | null>(null)

  // Ease the shown position toward the scroll's, a frame at a time, until it arrives.
  const play = () => {
    if (!view.current || loop.current) return
    loop.current = ({ delta }) => {
      const to = positionAt(progress.get(), reduced)
      const step = 1 - Math.exp((-CATCH_UP * Math.min(delta, 100)) / 1000)
      shown.current = Math.abs(to - shown.current) < 0.001 ? to : shown.current + (to - shown.current) * step
      view.current?.render(shown.current)
      if (shown.current === to && loop.current) {
        cancelFrame(loop.current)
        loop.current = null
      }
    }
    frame.render(loop.current, true)
  }
  useMotionValueEvent(progress, "change", () => {
    if (!reduced) play()
  })

  // Load once the footer is within a screen or so.
  useEffect(() => {
    const el = layer.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => entry?.isIntersecting && setNear(true), { rootMargin: "150% 0px" })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const el = layer.current
    if (!near || !el) return
    let gone = false
    let made: ControllerView | null = null
    const resize = new ResizeObserver(() => {
      made?.resize()
      made?.render(shown.current)
    })
    // The model loads while the page scrolls; building the scene waits for it to stop.
    const unmounted = new AbortController()
    const still = whenStill(unmounted.signal)
    import("@/lib/controller-host")
      .then(({ mountController }) => mountController(el, CANVAS_CLASS, still))
      .then((v) => {
        if (gone) return v.dispose()
        made = view.current = v
        shown.current = positionAt(progress.get(), reduced)
        v.render(shown.current)
        resize.observe(v.canvas)
        v.canvas.classList.replace("opacity-0", "opacity-100")
      })
      .catch(() => undefined) // no WebGL, or the model didn't load: the panel just goes without
    return () => {
      gone = true
      unmounted.abort()
      resize.disconnect()
      if (loop.current) cancelFrame(loop.current)
      loop.current = null
      made?.dispose()
      view.current = null
    }
  }, [near, progress, reduced])

  return <div ref={layer} aria-hidden className={className} />
}
