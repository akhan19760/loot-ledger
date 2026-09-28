import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useEffect, useState } from "react"
import { Eyebrow } from "@/components/ui/eyebrow"
import { ease } from "@/lib/motion"
import { SplitText } from "./split-text"

const SEEN_KEY = "lootledger-intro"
const MIN_MS = 1400

function alreadySeen() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1"
  } catch {
    return false
  }
}

function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, "1")
  } catch {
    /* private mode: the intro just plays again next time */
  }
}

/**
 * WG page loader: a full-screen panel with the wordmark and a loading bar that
 * fills toward 90 % while data loads, then wipes up and away (WG's
 * cubic-bezier(.77,0,.175,1)). Shown once per browser session.
 */
export function IntroLoader({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const reduced = useReducedMotion()
  const [enabled] = useState(() => !reduced && !alreadySeen())
  const [minElapsed, setMinElapsed] = useState(false)
  const leaving = ready && minElapsed
  const visible = enabled && !leaving

  useEffect(() => {
    if (!enabled) return
    const t = setTimeout(() => setMinElapsed(true), MIN_MS)
    return () => clearTimeout(t)
  }, [enabled])

  // Start the page's entrance as the panel begins to wipe away.
  useEffect(() => {
    if (visible) return
    if (enabled) markSeen()
    onDone()
  }, [visible, enabled, onDone])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="intro"
          className="fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-primary text-black"
          exit={{ y: "-100%" }}
          transition={{ duration: 1.2, ease: ease.wgWipe }}
        >
          <div className="grid justify-items-center gap-6 px-4">
            <Eyebrow>Loading every store</Eyebrow>
            <h2 className="font-display text-[clamp(3.5rem,16vw,14rem)] leading-[0.85] uppercase">
              <SplitText text="LootLedger" by="letter" stagger={0.045} onMount />
            </h2>
            <div className="h-1 w-48 overflow-hidden rounded-full bg-black/15">
              <motion.div
                className="h-full bg-black"
                initial={{ width: "0%" }}
                animate={{ width: "90%" }}
                transition={{ duration: MIN_MS / 1000, ease: ease.wg }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
