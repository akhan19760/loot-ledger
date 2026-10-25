import { AnimatePresence, m, useInView, useReducedMotion } from "motion/react"
import { ArrowLeft, ArrowRight, Search } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "cn"
import type { FiltersResponse, GameSummary } from "@lootledger/shared"
import { CoverArt } from "@/components/cover-art"
import { RollText } from "@/components/motion/roll-text"
import { SplitText } from "@/components/motion/split-text"
import { ShelfActions } from "@/components/shelf-buttons"
import { Button, ButtonCircle } from "@/components/ui/button"
import { capitalize, formatPrice, timeAgo } from "@/lib/format"
import { thumb } from "@/lib/images"
import { ease } from "@/lib/motion"
import { play as playSound } from "@/lib/sfx"

/** How the title arrives: slides in itself, or is flown in by the loading screen's letters (hidden until they land). */
export type TitleEntrance = "slide" | "flying" | "landed"

const BRAND = "LootLedger"
const NEON_FROM = 4 // "Ledger"
const FEATURED = 12
/** An attract mode: the featured game moves on by itself this often, unless someone is looking. */
const TURN_MS = 7000
/** The hero's cover is drawn up to ~30rem wide: this copy stays sharp on a 2x screen. */
export const HERO_COVER_WIDTH = 800

const pad = (n: number) => String(n).padStart(2, "0")

interface Props {
  meta: FiltersResponse | undefined
  /** The most-stocked games with art; the first dozen take turns as the featured game. */
  covers: readonly GameSummary[]
  storeNames: Map<string, string>
  /** False until the loading screen has gone: the entrance waits for it. */
  play: boolean
  title: TitleEntrance
  onOpen: (id: string) => void
  onSearch: () => void
}

/**
 * The title screen (DESIGN.md, "Hero"): the wordmark like a game's logo, and one featured game
 * as key art. Its cover, tilted on a lime plate; its cheapest price, the biggest figure on the
 * page; its title, huge. Every few seconds the next game wipes in, like a game's attract mode,
 * unless the pointer or focus is on it; arrows, the segments along the bottom and ← → move by hand.
 */
export function Hero({ meta, covers, storeNames, play, title, onOpen, onSearch }: Props) {
  const reduced = useReducedMotion()
  const games = covers.slice(0, FEATURED)
  const n = games.length
  const [focus, setFocus] = useState(0)
  const [direction, setDirection] = useState(1)
  const [resting, setResting] = useState(false)
  const section = useRef<HTMLElement>(null)
  const inView = useInView(section, { amount: 0.4 })
  const game = n ? games[focus % n]! : undefined

  const turnTo = useCallback(
    (i: number, by = i > focus ? 1 : -1) => {
      if (!n) return
      setDirection(by)
      setFocus(((i % n) + n) % n)
      playSound("tick")
    },
    [focus, n],
  )
  const turn = useCallback((by: number) => turnTo(focus + by, by), [focus, turnTo])

  // Attract mode: on to the next game, unless someone's looking, it's off screen or hidden.
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === "visible")
    document.addEventListener("visibilitychange", onChange)
    return () => document.removeEventListener("visibilitychange", onChange)
  }, [])
  const attract = play && !reduced && !resting && inView && visible && n > 1
  useEffect(() => {
    if (!attract) return
    const t = setTimeout(() => {
      setDirection(1)
      setFocus((f) => (f + 1) % n)
    }, TURN_MS)
    return () => clearTimeout(t)
  }, [attract, focus, n])

  // ← → while the hero is on screen (not while typing, or with a dialog open over it).
  useEffect(() => {
    if (!inView || n < 2) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
      const t = e.target as HTMLElement | null
      if (t?.closest("input, textarea, select, [contenteditable], [role=dialog], [role=listbox], [role=slider]")) return
      if (document.querySelector("[role=dialog]")) return
      e.preventDefault()
      turn(e.key === "ArrowRight" ? 1 : -1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [inView, n, turn])

  // The next cover, fetched ahead (as CoverArt asks for it) so its wipe never uncovers an empty frame.
  useEffect(() => {
    const next = n > 1 ? games[(focus + 1) % n] : undefined
    if (!next?.image) return
    const img = new Image()
    img.referrerPolicy = "no-referrer"
    img.src = thumb(next.image, HERO_COVER_WIDTH)
  }, [focus, games, n])
  // The queue after the featured game, like an attract mode's "up next".
  const upNext = n > 1 ? Array.from({ length: Math.min(5, n - 1) }, (_, k) => (focus + 1 + k) % n) : []

  const rise = (delay: number) =>
    ({ initial: reduced ? false : { opacity: 0, y: 28 }, animate: play ? { opacity: 1, y: 0 } : undefined, transition: { duration: 1, ease: ease.cine, delay } }) as const

  return (
    <section
      ref={section}
      aria-labelledby="hero-title"
      className="dark relative isolate grid min-h-svh grid-rows-[auto_1fr_auto] gap-6 overflow-hidden bg-background px-4 pt-[calc(var(--height-bar-mobile)+0.5rem)] pb-8 text-foreground md:gap-8 md:px-8 md:pt-[calc(var(--height-bar)+0.25rem)] md:pb-10"
    >
      {/* ------------------------------------------------ the logo */}
      <div className="flex items-start justify-between gap-6">
        <div className="grid gap-3">
          <h1
            id="hero-title"
            className="font-display text-[clamp(2.4rem,6.2vw,6.25rem)] leading-[0.86] uppercase short:text-[clamp(2.4rem,5vw,4.5rem)]"
            style={title === "flying" ? { opacity: 0 } : undefined}
          >
            {play ? (
              <SplitText
                text={BRAND}
                by="letter"
                onMount
                still={title !== "slide"}
                stagger={0.05}
                delay={0.1}
                partClassName={(_, i) => (i >= NEON_FROM ? "text-neon" : undefined)}
              />
            ) : (
              <span className="invisible">{BRAND}</span>
            )}
          </h1>
          <m.p {...rise(0.3)} className="max-w-[34ch] text-base text-muted-foreground md:text-lg">
            Every game&rsquo;s price at {meta ? `${meta.stores.length} ` : ""}Pakistani game shops, new and used, cheapest first.
          </m.p>
        </div>
        <m.div {...rise(0.4)} className="hidden justify-items-end gap-2 text-right sm:grid">
          <span className="label-caps text-foreground">
            Featured {n ? `${pad(focus + 1)} / ${pad(n)}` : ""}
          </span>
          <span className="label-caps text-muted-foreground">{meta ? `${meta.stores.length} shops${meta.generated ? ` · checked ${timeAgo(meta.generated)}` : ""}` : "Checking the shops…"}</span>
        </m.div>
      </div>

      {/* ------------------------------------------------ the featured game */}
      <div
        className="grid min-h-0 items-end gap-x-10 gap-y-6 lg:grid-cols-12"
        onPointerEnter={() => setResting(true)}
        onPointerLeave={() => setResting(false)}
        onFocus={() => setResting(true)}
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setResting(false)}
      >
        <Cover game={game} index={focus} direction={direction} play={play} reduced={!!reduced} onOpen={onOpen} />

        <div className="grid min-w-0 content-end gap-5 lg:col-span-7 lg:row-start-1 md:gap-6">
          {upNext.length > 0 && (
            <m.div {...rise(0.5)} className="mb-auto hidden items-center gap-4 pb-6 lg:flex short:hidden">
              <span className="label-caps text-muted-foreground">Up next</span>
              <div className="flex gap-2">
                {upNext.map((i) => (
                  <button
                    key={games[i]!.id}
                    type="button"
                    aria-label={`Show ${games[i]!.title}`}
                    onClick={() => turnTo(i, 1)}
                    className="group/next chamfer-sm relative aspect-[4/5] w-12 overflow-hidden bg-raised outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-lime"
                  >
                    <CoverArt src={games[i]!.image} title={games[i]!.title} width={200} className="opacity-60 transition-opacity duration-300 group-hover/next:opacity-100" />
                  </button>
                ))}
              </div>
            </m.div>
          )}
          <AnimatePresence mode="wait" initial={false}>
            {game ? (
              <m.div
                key={game.id}
                className="grid gap-5 md:gap-6"
                initial={reduced ? false : { opacity: 0 }}
                animate={play ? { opacity: 1 } : { opacity: 0 }}
                exit={reduced ? undefined : { opacity: 0, transition: { duration: 0.25 } }}
                transition={{ duration: 0.2 }}
              >
                <Line delay={0.05} reduced={!!reduced} play={play}>
                  <span className="label-caps text-muted-foreground">Cheapest today</span>
                  <p className="font-display text-[clamp(3rem,8.4vw,8.75rem)] leading-[0.84] text-primary-ink short:text-[clamp(3rem,6.5vw,6.5rem)]">{formatPrice(game.best.price)}</p>
                  <p className="mt-2 text-base text-muted-foreground md:text-lg">
                    at <span className="font-semibold text-foreground">{storeNames.get(game.best.store) ?? game.best.store}</span>
                    {" · "}
                    {[game.best.platform, game.best.condition && capitalize(game.best.condition)].filter(Boolean).join(" · ")}
                    {" · "}
                    {game.storeCount} {game.storeCount === 1 ? "shop" : "shops"} compared
                  </p>
                </Line>
                <Line delay={0.14} reduced={!!reduced} play={play}>
                  <h2
                    className="font-display text-[clamp(2rem,calc(108vw/var(--per-line)),4.75rem)] leading-[0.9] text-balance uppercase lg:text-[clamp(2.5rem,calc(62vw/var(--per-line)),8.5rem)] short:lg:text-[clamp(2.25rem,calc(54vw/var(--per-line)),6rem)]"
                    style={{ "--per-line": perLine(game.title) } as React.CSSProperties}
                  >
                    {game.title}
                  </h2>
                </Line>
              </m.div>
            ) : (
              <div className="grid gap-5">
                <span className="label-caps text-muted-foreground">Cheapest today</span>
                <div className="sweep chamfer h-[clamp(3rem,8.4vw,8.75rem)] w-2/3 bg-surface" />
                <div className="sweep chamfer h-[clamp(2.5rem,6vw,6rem)] w-5/6 bg-surface" />
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ------------------------------------------------ the controls */}
      <m.div {...rise(0.55)} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" disabled={!game} onClick={() => game && onOpen(game.id)} className="max-sm:flex-1">
            <RollText>{game ? `See all ${game.offerCount} prices` : "See every price"}</RollText>
            <ButtonCircle />
          </Button>
          {game && (
            <div className="hidden md:block">
              <ShelfActions game={game} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="mr-2 hidden label-caps text-muted-foreground xl:inline">← → Browse · Enter Open</span>
          <Button variant="round" size="icon" aria-label="Previous game" disabled={n < 2} onClick={() => turn(-1)}>
            <ArrowLeft />
          </Button>
          <Button variant="round" size="icon" aria-label="Next game" disabled={n < 2} onClick={() => turn(1)}>
            <ArrowRight />
          </Button>
          <Button variant="round" size="icon" aria-label="Search the library" onClick={onSearch}>
            <Search />
          </Button>
        </div>
      </m.div>

      {/* One segment per featured game along the bottom edge; the current one fills while it waits */}
      {n > 1 && (
        <div className="absolute inset-x-4 bottom-3 flex gap-1 md:inset-x-8 md:bottom-4">
          {games.map((g, i) => (
            <button
              key={g.id}
              type="button"
              aria-label={`Show ${g.title}`}
              aria-current={i === focus}
              onClick={() => turnTo(i)}
              className="group/seg relative h-4 flex-1 outline-none focus-visible:outline-2 focus-visible:outline-foreground"
            >
              <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-foreground/15 transition-colors group-hover/seg:bg-foreground/35">
                {i < focus && <span className="absolute inset-0 bg-foreground/55" />}
                {i === focus && (
                  <m.span
                    key={`${focus}-${attract}`}
                    className="absolute inset-0 origin-left bg-primary"
                    initial={{ scaleX: attract ? 0 : 1 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: attract ? TURN_MS / 1000 : 0, ease: "linear" }}
                  />
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

/** A block of the featured game's text, rising out of a mask as the game arrives. */
function Line({ delay, reduced, play, children }: { delay: number; reduced: boolean; play: boolean; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden pb-[0.06em]">
      <m.div
        className="grid gap-2"
        initial={reduced ? false : { y: "105%" }}
        animate={play ? { y: "0%" } : undefined}
        transition={{ duration: 0.9, ease: ease.cine, delay }}
      >
        {children}
      </m.div>
    </div>
  )
}

/**
 * Letters on the longer of the title's two lines, give or take a word: the h2 divides its
 * column by this, so short names run huge and long ones step down, two lines at most.
 * (Dela Gothic One is wide, about 0.85em a capital.)
 */
const perLine = (title: string) => Math.max(7, Math.ceil(title.length / 2) + 2)

/**
 * The featured cover, tilted on a lime plate. A new game wipes across it (from the side it's
 * coming from) while the old one is wiped off; the plate stays and turns a little.
 */
function Cover({
  game,
  index,
  direction,
  play,
  reduced,
  onOpen,
}: {
  game: GameSummary | undefined
  index: number
  direction: number
  play: boolean
  reduced: boolean
  onOpen: (id: string) => void
}) {
  const hidden = direction > 0 ? "inset(0% 0% 0% 100%)" : "inset(0% 100% 0% 0%)"
  const gone = direction > 0 ? "inset(0% 100% 0% 0%)" : "inset(0% 0% 0% 100%)"
  return (
    <m.div
      className="relative mx-auto w-[min(50vw,15rem)] lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:mr-[4%] lg:w-[min(30vw,29rem)] lg:self-center short:lg:w-[min(24vw,22rem)]"
      initial={reduced ? false : { opacity: 0, y: 60, rotate: -6 }}
      animate={play ? { opacity: 1, y: 0, rotate: 0 } : undefined}
      transition={{ duration: 1.2, ease: ease.cine, delay: 0.2 }}
    >
      {/* The lime plate behind the case */}
      <m.div
        aria-hidden
        className="chamfer-lg absolute inset-0 bg-primary"
        animate={{ rotate: index % 2 ? -7 : -4, x: index % 2 ? "-5%" : "6%", y: "4%" }}
        transition={{ duration: 1.1, ease: ease.cine }}
      />
      <div className="relative aspect-[4/5] rotate-[3deg]">
        <AnimatePresence initial={false} custom={direction}>
          {game ? (
            <m.button
              key={game.id}
              type="button"
              data-game-card={game.id}
              aria-label={`${game.title}: see all ${game.offerCount} prices`}
              onClick={() => onOpen(game.id)}
              className="group/cover absolute inset-0 block outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
              initial={reduced ? false : { clipPath: hidden }}
              animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
              exit={reduced ? undefined : { clipPath: gone, transition: { duration: 0.7, ease: ease.cineInOut } }}
              transition={{ duration: 1, ease: ease.cineInOut }}
            >
              <span className="chamfer-lg absolute inset-0 overflow-hidden bg-raised">
                <CoverArt
                  src={game.image}
                  title={game.title}
                  width={HERO_COVER_WIDTH}
                  className="transition-transform duration-[1.4s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/cover:scale-[1.04]"
                />
              </span>
            </m.button>
          ) : (
            <div className={cn("sweep chamfer-lg absolute inset-0 bg-raised")} />
          )}
        </AnimatePresence>
      </div>
    </m.div>
  )
}
