import { AnimatePresence, m, useReducedMotion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { idsOn, useShelf } from "@/hooks/use-shelf"
import { onUnlock, unlock, type Unlocked } from "@/hooks/use-achievements"
import { ease } from "@/lib/motion"
import { play } from "@/lib/sfx"

const SHOW_MS = 4800

/**
 * The achievement toast: a lime block that wipes in at the bottom left, says what was unlocked
 * and why, and wipes away again. One at a time; several unlocked together queue up. Also
 * watches the shelf, so the first wishlist and collection additions (this visit) unlock theirs.
 */
export function Achievements() {
  const reduced = useReducedMotion()
  const [queue, setQueue] = useState<Unlocked[]>([])
  const current = queue[0]

  useEffect(() => onUnlock((a) => setQueue((q) => [...q, a])), [])
  useEffect(() => {
    if (!current) return
    play("on")
    const t = setTimeout(() => setQueue((q) => q.slice(1)), SHOW_MS)
    return () => clearTimeout(t)
  }, [current])

  // Additions made now, not a shelf brought back from an earlier visit.
  const shelf = useShelf()
  const counts = { wishlist: idsOn(shelf, "wishlist").length, collection: idsOn(shelf, "collection").length }
  const before = useRef(counts)
  useEffect(() => {
    if (counts.wishlist > before.current.wishlist) unlock("first-wish")
    if (counts.collection > before.current.collection) unlock("first-owned")
    before.current = counts
  })

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-4 left-4 z-[70] w-[min(calc(100vw-2rem),24rem)] md:bottom-8 md:left-8">
      <AnimatePresence mode="wait">
        {current && (
          <m.div
            key={current.id}
            className="on-lime chamfer grid grid-cols-[auto_1fr] items-center gap-4 p-4 pr-5"
            initial={reduced ? { opacity: 0 } : { clipPath: "inset(0% 100% 0% 0%)" }}
            animate={reduced ? { opacity: 1 } : { clipPath: "inset(0% 0% 0% 0%)" }}
            exit={reduced ? { opacity: 0 } : { clipPath: "inset(0% 0% 0% 100%)", transition: { duration: 0.5, ease: ease.cineInOut } }}
            transition={{ duration: 0.7, ease: ease.cineInOut }}
          >
            {/* A trophy, drawn: a cup on a stand */}
            <svg viewBox="0 0 32 32" aria-hidden className="size-10 shrink-0">
              <path d="M9 4h14v8a7 7 0 0 1-14 0V4Z" fill="currentColor" />
              <path d="M9 7H5v2a5 5 0 0 0 5 5M23 7h4v2a5 5 0 0 1-5 5" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M14 19h4v5h-4zM10 25h12v3H10z" fill="currentColor" />
            </svg>
            <div className="grid gap-1">
              <span className="label-caps text-muted-foreground">Achievement unlocked</span>
              <span className="font-display text-xl leading-none uppercase">{current.title}</span>
              <span className="text-sm leading-snug">{current.body}</span>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
