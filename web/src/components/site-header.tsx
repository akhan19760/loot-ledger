import { AnimatePresence, m, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react"
import { ShoppingBag, X } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { useRef, useState } from "react"
import { cn } from "cn"
import type { FiltersResponse } from "@lootledger/shared"
import { CountUp } from "@/components/motion/count-up"
import { RollText } from "@/components/motion/roll-text"
import { useScrollLock, useScrollTo } from "@/components/motion/smooth-scroll"
import { Button } from "@/components/ui/button"
import type { LibraryList, Page } from "@/hooks/use-library-url"
import { useDialogSound } from "@/hooks/use-sound-effects"
import { useTheme } from "@/hooks/use-theme"
import { play, useSound } from "@/lib/sfx"
import { timeAgo } from "@/lib/format"
import { ease } from "@/lib/motion"

interface Props {
  filters: FiltersResponse | undefined
  online: boolean
  introDone: boolean
  cartCount: number
  onOpenCart: () => void
  page: Page
  /** Go to a page, then to a section of it (or its top). */
  onNavigate: (page: Page, section?: string) => void
  /** Show the whole library, or the wishlist or collection. */
  onList: (list: LibraryList) => void
  counts: { wishlist: number; collection: number }
}

/**
 * The header (DESIGN.md, "Header: pause menu"): the wordmark, the cart and one Menu button,
 * clear over the top of the page and a solid ink bar once it scrolls (no glass). Menu opens a
 * game's pause screen. It slides in after the intro, tucks away while scrolling down and
 * returns on the way up. Over the home page's first screen the wordmark steps aside for the
 * hero's own.
 */
export function SiteHeader({ filters, online, introDone, cartCount, onOpenCart, page, onNavigate, onList, counts }: Props) {
  const { scrollY } = useScroll()
  const [hidden, setHidden] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const scrollTo = useScrollTo()

  useMotionValueEvent(scrollY, "change", (y) => {
    const previous = scrollY.getPrevious() ?? 0
    setHidden(y > previous && y > 320)
    setScrolled(y > 16)
  })
  const homeTop = page === "library" && !scrolled

  return (
    <m.header
      initial={{ y: "-110%" }}
      animate={{ y: introDone && (!hidden || menuOpen) ? "0%" : "-110%" }}
      transition={{ duration: 0.8, ease: ease.cine }}
      className={cn(
        // width-before-scroll-bar: Radix's scroll lock (an open dialog) keeps it as wide as the page beneath.
        // Dark in either theme, like the title screen it sits on: clear over the home page's hero,
        // a solid ink bar everywhere else (the deals page, or once scrolled).
        "dark width-before-scroll-bar fixed inset-x-0 top-0 z-40 flex h-(--height-bar-mobile) items-center justify-between gap-4 px-4 text-foreground transition-colors duration-500 md:h-(--height-bar) md:px-8",
        homeTop ? "bg-transparent" : "bg-background",
      )}
    >
      <button
        type="button"
        onClick={() => (page === "library" ? scrollTo(0) : onNavigate("library"))}
        aria-label={page === "library" ? "LootLedger, back to top" : "LootLedger, home"}
        className={cn(
          "group/roll font-display text-xl leading-none uppercase transition-opacity duration-500 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current md:text-2xl",
          homeTop && "pointer-events-none opacity-0",
        )}
      >
        <RollText>
          <span>Loot</span>
          <span className="text-neon">Ledger</span>
        </RollText>
      </button>

      <div className="flex items-center gap-2">
        <CartButton count={cartCount} onClick={onOpenCart} />
        <PauseMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          filters={filters}
          online={online}
          page={page}
          counts={counts}
          onGo={(target, section) => (page === target ? scrollTo(section ?? 0) : onNavigate(target, section))}
          onList={onList}
          onShops={() => scrollTo("stores")}
        />
      </div>
    </m.header>
  )
}

/** A chamfered square with the cart's count on a lime tag. */
function CartButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <Button variant="round" size="icon" aria-label={`Cart optimizer, ${count} ${count === 1 ? "game" : "games"}`} title="Cart optimizer" className="relative" onClick={onClick}>
      <ShoppingBag className="size-[18px]" />
      <AnimatePresence>
        {count > 0 && (
          <m.span
            key={count}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.45, ease: ease.cine }}
            className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center bg-primary px-1 text-[10px] font-bold text-ink tabular-nums"
          >
            {count}
          </m.span>
        )}
      </AnimatePresence>
    </Button>
  )
}

interface MenuItem {
  id: string
  label: string
  hint: string
  run: () => void
}

/**
 * The pause screen: a full-screen lime block that wipes down over the page. Huge menu items
 * with an ink marker that follows the pointer, the keyboard (↑ ↓, Home, End) and focus, a tick
 * as it moves; options (sound, theme) and the live status beside them. Esc or Resume returns.
 */
function PauseMenu({
  open,
  onOpenChange,
  filters,
  online,
  page,
  counts,
  onGo,
  onList,
  onShops,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: FiltersResponse | undefined
  online: boolean
  page: Page
  counts: { wishlist: number; collection: number }
  onGo: (page: Page, section?: string) => void
  onList: (list: LibraryList) => void
  onShops: () => void
}) {
  const reduced = useReducedMotion()
  const sound = useSound()
  const { theme, toggle: toggleTheme } = useTheme()
  const [current, setCurrent] = useState(0)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  useScrollLock(open)
  useDialogSound("menu", open)

  // Close first, then go: the page must be scrollable again for the trip.
  const then = (action: () => void) => () => {
    onOpenChange(false)
    setTimeout(action, 60)
  }
  const items: MenuItem[] = [
    { id: "resume", label: "Resume", hint: "Back to where you were", run: () => onOpenChange(false) },
    {
      id: "library",
      label: "Library",
      hint: filters ? `${filters.totals.games.toLocaleString("en-PK")} games, cheapest first` : "Every game, cheapest first",
      run: then(() => {
        onList("all")
        onGo("library", "library")
      }),
    },
    { id: "deals", label: "Deals", hint: "Markdowns and the biggest price gaps", run: then(() => onGo("deals")) },
    ...(page === "library" ? [{ id: "versus", label: "Shop around", hint: "Same game, two shops, head to head", run: then(() => onGo("library", "versus")) }] : []),
    {
      id: "wishlist",
      label: "Wishlist",
      hint: `${counts.wishlist} ${counts.wishlist === 1 ? "game" : "games"} saved in this browser`,
      run: then(() => {
        onList("wishlist")
        onGo("library", "library")
      }),
    },
    {
      id: "collection",
      label: "Collection",
      hint: `${counts.collection} ${counts.collection === 1 ? "game" : "games"} owned`,
      run: then(() => {
        onList("collection")
        onGo("library", "library")
      }),
    },
    { id: "shops", label: "The shops", hint: filters ? `All ${filters.stores.length}, in the credits` : "In the credits", run: then(onShops) },
  ]

  const move = (to: number) => {
    const i = (to + items.length) % items.length
    buttons.current[i]?.focus()
  }
  const point = (i: number) => {
    if (i === current) return
    setCurrent(i)
    play("tick", 0.6)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Trigger asChild>
        <Button size="sm" className="h-12 gap-3 px-5 uppercase tracking-[0.12em]" aria-label="Menu">
          <span aria-hidden className="grid gap-[5px]">
            <span className="block h-[2px] w-4 bg-current" />
            <span className="block h-[2px] w-4 bg-current" />
          </span>
          <RollText>Menu</RollText>
        </Button>
      </DialogPrimitive.Trigger>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Content
              forceMount
              asChild
              aria-describedby={undefined}
              onOpenAutoFocus={(e) => {
                e.preventDefault()
                setCurrent(0)
                buttons.current[0]?.focus()
              }}
            >
              <m.div
                className="on-lime fixed inset-0 z-[60] flex flex-col overflow-hidden outline-none"
                initial={reduced ? { opacity: 0 } : { clipPath: "inset(0% 0% 100% 0%)" }}
                animate={reduced ? { opacity: 1 } : { clipPath: "inset(0% 0% 0% 0%)" }}
                exit={reduced ? { opacity: 0 } : { clipPath: "inset(100% 0% 0% 0%)", transition: { duration: 0.55, ease: ease.cineInOut } }}
                transition={{ duration: 0.75, ease: ease.cineInOut }}
              >
                <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
                <div className="flex h-(--height-bar-mobile) shrink-0 items-center justify-between gap-4 px-4 md:h-(--height-bar) md:px-8">
                  <span className="font-display text-xl leading-none uppercase md:text-2xl">LootLedger</span>
                  <span className="hidden label-caps md:inline">Paused</span>
                  <DialogPrimitive.Close asChild>
                    <button
                      type="button"
                      className="group/roll chamfer-sm flex h-12 items-center gap-3 bg-ink px-5 text-[13px] font-bold tracking-[0.12em] text-lime uppercase outline-none focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-lime"
                    >
                      <X className="size-4" />
                      <RollText>Resume</RollText>
                    </button>
                  </DialogPrimitive.Close>
                </div>

                <div data-lenis-prevent className="grid min-h-0 flex-1 content-start gap-10 overflow-y-auto overscroll-contain px-4 pt-4 pb-8 md:px-8 lg:grid-cols-12 lg:content-center lg:gap-8">
                  <nav aria-label="Menu" className="lg:col-span-8">
                    <ul
                      className="grid"
                      onKeyDown={(e) => {
                        const i = buttons.current.findIndex((b) => b === document.activeElement)
                        if (e.key === "ArrowDown") move(i + 1)
                        else if (e.key === "ArrowUp") move(i - 1)
                        else if (e.key === "Home") move(0)
                        else if (e.key === "End") move(items.length - 1)
                        else return
                        e.preventDefault()
                      }}
                    >
                      {items.map((item, i) => (
                        <m.li
                          key={item.id}
                          initial={reduced ? false : { opacity: 0, y: 40 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.8, ease: ease.cine, delay: 0.25 + i * 0.05 }}
                        >
                          <button
                            ref={(b) => void (buttons.current[i] = b)}
                            type="button"
                            onClick={item.run}
                            onPointerEnter={() => point(i)}
                            onFocus={() => point(i)}
                            className="group/item flex w-full items-center gap-[0.25em] py-[0.05em] text-left font-display text-[clamp(2rem,5vw,5.25rem)] leading-[1] uppercase outline-none short:text-[clamp(2rem,4.2vw,4rem)]"
                          >
                            <span aria-hidden className="relative grid w-[0.55em] shrink-0 place-items-center self-stretch">
                              {current === i && (
                                <m.span
                                  layoutId="pause-marker"
                                  transition={{ duration: 0.45, ease: ease.cine }}
                                  className="block size-[0.42em] bg-ink [clip-path:polygon(0_0,100%_50%,0_100%)]"
                                />
                              )}
                            </span>
                            <span className={cn("transition-opacity duration-300", current === i ? "opacity-100" : "opacity-50")}>{item.label}</span>
                            <span
                              className={cn(
                                "ml-auto hidden max-w-[16rem] text-right font-sans text-[13px] leading-snug font-semibold tracking-[0.06em] normal-case transition-[opacity,translate] duration-500 md:block",
                                current === i ? "translate-x-0 opacity-100" : "translate-x-3 opacity-0",
                              )}
                            >
                              {item.hint}
                            </span>
                          </button>
                        </m.li>
                      ))}
                    </ul>
                  </nav>

                  <m.aside
                    aria-label="Options and status"
                    className="chamfer-lg grid content-start gap-7 self-center bg-ink p-6 text-bone md:p-8 lg:col-span-4"
                    initial={reduced ? false : { opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.9, ease: ease.cine, delay: 0.45 }}
                  >
                    <div className="grid gap-3">
                      <span className="label-caps text-bone/55">Options</span>
                      <Option label="Sound" value={sound.on ? "On" : "Off"} pressed={sound.on} onClick={sound.toggle} />
                      <Option
                        label="Theme"
                        value={theme === "dark" ? "Dark" : "Light"}
                        pressed={theme === "dark"}
                        onClick={(e) => {
                          const r = e.currentTarget.getBoundingClientRect()
                          toggleTheme({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
                        }}
                      />
                    </div>
                    <div className="grid gap-3">
                      <span className="label-caps text-bone/55">Status</span>
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        <span aria-hidden className={cn("size-2", online ? "bg-lime" : "bg-bone/40")} />
                        {online ? "Online" : "Offline"}
                        {filters?.generated && <span className="font-medium text-bone/60">· prices checked {timeAgo(filters.generated)}</span>}
                      </p>
                      {filters && (
                        <dl className="grid grid-cols-3 gap-3">
                          {(
                            [
                              ["Games", filters.totals.games],
                              ["Offers", filters.totals.offers],
                              ["Shops", filters.stores.length],
                            ] as const
                          ).map(([label, value]) => (
                            <div key={label} className="grid gap-1">
                              <dt className="label-caps text-bone/55">{label}</dt>
                              <dd className="font-display text-xl leading-none text-lime">
                                <CountUp value={value} />
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </div>
                    <p className="hidden label-caps text-bone/55 md:block">↑ ↓ Move · Enter Select · Esc Resume</p>
                  </m.aside>
                </div>
              </m.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  )
}

/** One option row: its name, and a switch showing its state (lime while on). */
function Option({ label, value, pressed, onClick }: { label: string; value: string; pressed: boolean; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="group/opt flex items-center justify-between gap-4 border-b border-bone/10 pb-3 text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime"
    >
      <span className="font-display text-xl leading-none uppercase">{label}</span>
      <span className={cn("chamfer-xs px-3 py-1.5 text-xs font-bold tracking-[0.12em] uppercase transition-colors duration-300", pressed ? "bg-lime text-ink" : "bg-bone/10 text-bone group-hover/opt:bg-bone/20")}>
        {value}
      </span>
    </button>
  )
}
