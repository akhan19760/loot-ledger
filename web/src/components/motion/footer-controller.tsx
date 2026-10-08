import { cancelFrame, frame, useMotionValueEvent, useReducedMotion, type MotionValue } from "motion/react"
import { useEffect, useRef, useState } from "react"
import type { ControllerScene } from "@/lib/controller-scene"

const LENGTH = 10 // the sequence's length (controller-scene.ts)
// WG scrubs with `scrub: 1`: the animation takes about a second to catch up with the scroll.
const CATCH_UP = 5 // per second

/** Where in the sequence a scroll progress lands: GSAP's default ease, power1.out. */
const positionAt = (progress: number, still: boolean | null) => (still ? LENGTH : LENGTH * (1 - (1 - progress) ** 2))

/**
 * WG's 3D controller (the section after their hero): it rises out of the bottom of the
 * screen, tumbles, spins round and settles as you scroll. Sticky, so it stays in view
 * while it plays, and scrubbed by `progress` (0–1), eased as WG's GSAP tween is
 * (power1.out). three.js and the model load only when the footer comes near; under
 * reduced motion the controller is shown at rest, in its final pose.
 */
export function FooterController({ progress, className }: { progress: MotionValue<number>; className?: string }) {
  const reduced = useReducedMotion()
  const layer = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const scene = useRef<ControllerScene | null>(null)
  const [near, setNear] = useState(false)
  const [ready, setReady] = useState(false)

  const shown = useRef(0)
  const loop = useRef<((data: { delta: number }) => void) | null>(null)

  // Ease the shown position toward the scroll's, a frame at a time, until it arrives.
  const play = () => {
    if (!scene.current || loop.current) return
    loop.current = ({ delta }) => {
      const to = positionAt(progress.get(), reduced)
      const step = 1 - Math.exp((-CATCH_UP * Math.min(delta, 100)) / 1000)
      shown.current = Math.abs(to - shown.current) < 0.001 ? to : shown.current + (to - shown.current) * step
      scene.current?.render(shown.current)
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
    if (!near || !canvas.current) return
    let gone = false
    let made: ControllerScene | null = null
    const el = canvas.current
    const resize = new ResizeObserver(() => {
      made?.resize()
      made?.render(shown.current)
    })
    import("@/lib/controller-scene")
      .then(({ createControllerScene }) => createControllerScene(el))
      .then((s) => {
        if (gone) return s.dispose()
        made = scene.current = s
        shown.current = positionAt(progress.get(), reduced)
        s.render(shown.current)
        resize.observe(el)
        setReady(true)
      })
      .catch(() => undefined) // no WebGL, or the model didn't load: the panel just goes without
    return () => {
      gone = true
      resize.disconnect()
      if (loop.current) cancelFrame(loop.current)
      loop.current = null
      made?.dispose()
      scene.current = null
    }
  }, [near, progress, reduced])

  return (
    <div ref={layer} aria-hidden className={className}>
      {/* Centred on the screen while it plays, a little shorter than it so the controller
          can come to rest above the wordmark */}
      <canvas
        ref={canvas}
        className={`sticky top-[7.5svh] block h-[85svh] w-full transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  )
}
