import { AnimatePresence, useReducedMotion } from "motion/react"
import { lazy, Suspense, useEffect, useState } from "react"
import type { LoadingScreenProps } from "@/components/loading-screen"

// The loading screen itself is a chunk of its own: most visits never show it.
const Screen = lazy(() => import("@/components/loading-screen").then((m) => ({ default: m.Screen })))

// Shown at most once a week per browser, and never to someone who followed a link to
// something in particular (a shared game, the deals, a wishlist): they came for that.
const SEEN_KEY = "lootledger-intro-seen"
const SHOW_EVERY_MS = 7 * 24 * 60 * 60 * 1000

function introWanted(): boolean {
  const params = new URLSearchParams(location.search)
  if (location.pathname.replace(/\/+$/, "") !== "" || params.has("game") || params.has("list")) return false
  try {
    const seen = Number(localStorage.getItem(SEEN_KEY))
    if (seen && Date.now() - seen < SHOW_EVERY_MS) return false
    localStorage.setItem(SEEN_KEY, String(Date.now()))
  } catch {
    // Storage blocked: show it, it's short.
  }
  return true
}

/**
 * The video-game loading screen on a first visit to the home page (loading-screen.tsx).
 * While its code loads, a black screen like its backdrop keeps the page covered.
 */
export function LoadingScreen({
  onDone,
  ...props
}: Omit<LoadingScreenProps, "onContinue"> & {
  /** Called as the screen starts to wipe away (or at once when it isn't shown). */
  onDone: () => void
}) {
  const reduced = useReducedMotion()
  const [enabled] = useState(() => !reduced && introWanted())
  const [leaving, setLeaving] = useState(false)
  const visible = enabled && !leaving

  // Start the page's entrance as the screen begins to wipe away.
  useEffect(() => {
    if (!visible) onDone()
  }, [visible, onDone])

  return (
    <AnimatePresence>
      {visible && (
        <Suspense key="loading" fallback={<div className="fixed inset-0 z-[100] bg-black" />}>
          <Screen {...props} onContinue={() => setLeaving(true)} />
        </Suspense>
      )}
    </AnimatePresence>
  )
}
