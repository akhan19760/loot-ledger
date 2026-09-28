import { motion, useMotionValueEvent, useScroll } from "motion/react"
import { useState } from "react"
import { cn } from "cn"
import type { FiltersResponse } from "@ugs/shared"
import { CountUp } from "@/components/motion/count-up"
import { Equalizer } from "@/components/motion/equalizer"
import { RollText } from "@/components/motion/roll-text"
import { useScrollTo } from "@/components/motion/smooth-scroll"
import { Button } from "@/components/ui/button"
import { Stat } from "@/components/ui/stat"
import { timeAgo } from "@/lib/format"
import { ease } from "@/lib/motion"

/**
 * WG header bar: floating 8px from the edges, blurred, status stats on the left.
 * Slides in after the intro, tucks away while scrolling down and returns on the way up.
 */
export function SiteHeader({ filters, online, introDone }: { filters: FiltersResponse | undefined; online: boolean; introDone: boolean }) {
  const scrollTo = useScrollTo()
  const { scrollY } = useScroll()
  const [hidden, setHidden] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useMotionValueEvent(scrollY, "change", (y) => {
    const previous = scrollY.getPrevious() ?? 0
    setHidden(y > previous && y > 320)
    setScrolled(y > 16)
  })

  return (
    <motion.header
      initial={{ y: "-140%" }}
      animate={{ y: introDone && !hidden ? "0%" : "-140%" }}
      transition={{ duration: 0.8, ease: ease.wg }}
      className={cn(
        "fixed inset-x-2 top-2 z-40 flex h-(--height-bar-mobile) items-center justify-between gap-4 rounded-2xl border px-3 backdrop-blur-[16px] transition-colors duration-500 md:h-(--height-bar) md:px-4",
        scrolled ? "border-white/10 bg-neutral-900/70" : "border-transparent bg-neutral-800/40",
      )}
    >
      <div className="flex items-center gap-4 md:gap-5">
        <Equalizer live={online} />
        <Stat className="hidden lg:flex" dot={online ? "live" : "idle"} label={online ? "Online" : "Offline"} />
        {filters && (
          <>
            <Stat className="hidden sm:flex" value={<CountUp value={filters.totals.games} />} label="Games" />
            <Stat className="hidden sm:flex" value={<CountUp value={filters.totals.offers} />} label="Offers" />
            <Stat className="hidden md:flex" value={<CountUp value={filters.stores.length} />} label="Stores" />
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => scrollTo(0)}
        aria-label="LootLedger, back to top"
        className="group/roll absolute left-1/2 -translate-x-1/2 font-display text-2xl leading-none uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-4xl"
      >
        <RollText>
          <span>Loot</span>
          <span className="text-neon">Ledger</span>
        </RollText>
      </button>

      <nav className="flex items-center gap-1 md:gap-2">
        <Button variant="ghost" className="hidden px-3 lg:inline-flex" onClick={() => scrollTo("library")}>
          <RollText>Library</RollText>
        </Button>
        <Button variant="ghost" className="hidden px-3 lg:inline-flex" onClick={() => scrollTo("stores")}>
          <RollText>Stores</RollText>
        </Button>
        {filters?.generated && (
          <Stat className="ml-2" value={timeAgo(filters.generated)} label="Updated" title={new Date(filters.generated).toLocaleString()} />
        )}
      </nav>
    </motion.header>
  )
}
