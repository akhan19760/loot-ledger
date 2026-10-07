import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react"
import { Moon, ShoppingBag, Sun } from "lucide-react"
import { useState } from "react"
import { cn } from "cn"
import type { FiltersResponse } from "@ugs/shared"
import { CountUp } from "@/components/motion/count-up"
import { Equalizer } from "@/components/motion/equalizer"
import { RollText } from "@/components/motion/roll-text"
import { useScrollTo } from "@/components/motion/smooth-scroll"
import { Button } from "@/components/ui/button"
import { Stat } from "@/components/ui/stat"
import type { Page } from "@/hooks/use-library-url"
import { useTheme } from "@/hooks/use-theme"
import { timeAgo } from "@/lib/format"
import { ease } from "@/lib/motion"

/**
 * WG header bar: floating 8px from the edges, blurred, status stats on the left.
 * Slides in after the intro, tucks away while scrolling down and returns on the way up.
 */
export function SiteHeader({
  filters,
  online,
  introDone,
  cartCount,
  onOpenCart,
  page,
  onNavigate,
}: {
  filters: FiltersResponse | undefined
  online: boolean
  introDone: boolean
  cartCount: number
  onOpenCart: () => void
  page: Page
  /** Go to a page, then to a section of it (or its top). */
  onNavigate: (page: Page, section?: string) => void
}) {
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
        scrolled ? "border-border bg-popover/70" : "border-transparent bg-popover/40",
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
        onClick={() => (page === "library" ? scrollTo(0) : onNavigate("library"))}
        aria-label={page === "library" ? "LootLedger, back to top" : "LootLedger, home"}
        className="group/roll absolute left-1/2 -translate-x-1/2 font-display text-2xl leading-none uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-4xl"
      >
        <RollText>
          <span>Loot</span>
          <span className="text-neon">Ledger</span>
        </RollText>
      </button>

      <nav className="flex items-center gap-1 md:gap-2">
        <Button
          variant="ghost"
          className="hidden px-3 lg:inline-flex"
          onClick={() => (page === "library" ? scrollTo("library") : onNavigate("library", "library"))}
        >
          <RollText>Library</RollText>
        </Button>
        <Button
          variant="ghost"
          // Current page: neon in dark; underlined in light, where primary-ink is plain black.
          className={cn(
            "hidden px-3 lg:inline-flex",
            page === "deals" && "text-primary-ink light:after:absolute light:after:inset-x-3 light:after:bottom-1.5 light:after:h-0.5 light:after:rounded-full light:after:bg-current",
          )}
          aria-current={page === "deals" ? "page" : undefined}
          onClick={() => (page === "deals" ? scrollTo(0) : onNavigate("deals"))}
        >
          <RollText>Deals</RollText>
        </Button>
        <Button variant="ghost" className="hidden px-3 lg:inline-flex" onClick={() => scrollTo("stores")}>
          <RollText>Stores</RollText>
        </Button>
        {filters?.generated && (
          <Stat className="mx-2" value={timeAgo(filters.generated)} label="Updated" title={new Date(filters.generated).toLocaleString()} />
        )}
        <CartButton count={cartCount} onClick={onOpenCart} />
        <ThemeToggle />
      </nav>
    </motion.header>
  )
}

/** WG black circle with the cart's count on a neon chip. */
function CartButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <Button variant="round" size="icon-sm" aria-label={`Cart optimizer, ${count} ${count === 1 ? "game" : "games"}`} title="Cart optimizer" className="relative md:size-11" onClick={onClick}>
      <ShoppingBag />
      <AnimatePresence>
        {count > 0 && (
          <motion.span
            key={count}
            initial={{ scale: 0.4 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ duration: 0.4, ease: ease.inkRoll }}
            className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-semibold text-black tabular-nums"
          >
            {count}
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  )
}

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const dark = theme === "dark"
  return (
    <Button
      variant="round"
      size="icon-sm"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
      className="overflow-hidden md:size-11"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        toggle({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
      }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={theme}
          initial={{ y: "120%", rotate: -90, opacity: 0 }}
          animate={{ y: "0%", rotate: 0, opacity: 1 }}
          exit={{ y: "-120%", rotate: 90, opacity: 0 }}
          transition={{ duration: 0.5, ease: ease.inkRoll }}
          className="grid place-items-center"
        >
          {dark ? <Moon /> : <Sun />}
        </motion.span>
      </AnimatePresence>
    </Button>
  )
}
