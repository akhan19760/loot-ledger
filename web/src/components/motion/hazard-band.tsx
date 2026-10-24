import { useEffect, useRef, useState } from "react"
import { cn } from "cn"

/**
 * WG's neon hazard stripes, sliding endlessly (their join/footer stripe band). A strip one
 * stripe period wider than the band slides by that period, a transform the GPU runs on
 * its own (sliding the background itself restyled and repainted it every frame), and it
 * rests while the band is off screen.
 */
export function HazardBand({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [onScreen, setOnScreen] = useState(false)
  useEffect(() => {
    const io = new IntersectionObserver(([entry]) => setOnScreen(!!entry?.isIntersecting))
    io.observe(ref.current!)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} aria-hidden className={cn("relative h-16 overflow-hidden rounded-2xl md:h-24", className)}>
      <div className={cn("hazard-band absolute inset-y-0 left-0 w-[calc(100%+79.2px)]", !onScreen && "[animation-play-state:paused]")} />
    </div>
  )
}
