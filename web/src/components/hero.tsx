import { m, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "motion/react"
import { ArrowDown, ArrowRight } from "lucide-react"
import { useRef } from "react"
import { cn } from "cn"
import type { FiltersResponse, GameSummary } from "@lootledger/shared"
import { CoverArt } from "@/components/cover-art"
import { SearchField } from "@/components/filter-bar"
import { RollText } from "@/components/motion/roll-text"
import { SplitText } from "@/components/motion/split-text"
import { Button } from "@/components/ui/button"
import { ease, pointerSpring } from "@/lib/motion"

// INK hero: tilted art floating around the headline. Positions are % of the hero. Phones
// keep the two above the title: lower down they would sit on the sentence and the search.
const SLOTS = [
  { left: "3%", top: "12%", rotate: -12, depth: 1.2 },
  { left: "80%", top: "9%", rotate: 10, depth: 0.8 },
  { left: "8%", top: "56%", rotate: 8, depth: 1, desktop: true },
  { left: "84%", top: "52%", rotate: -9, depth: 1.4, desktop: true },
  { left: "24%", top: "74%", rotate: -5, depth: 0.6, desktop: true },
  { left: "66%", top: "76%", rotate: 11, depth: 0.9, desktop: true },
] as const

const BRAND = "LootLedger"
const NEON_FROM = 4 // "Ledger" in neon, as in the header's wordmark

// WG rows of big words, sliding opposite ways on scroll: what the library covers, set
// quietly under the title so they read as a band rather than a second headline.
const ROW_A = ["PS5", "PS4", "Switch", "Xbox", "PC", "PS5", "PS4", "Switch", "Xbox", "PC"]
const ROW_B = ["New", "Used", "Disc", "Digital", "Deals", "New", "Used", "Disc", "Digital", "Deals"]

/**
 * How the title arrives: sliding up letter by letter, or flown in by the loading screen
 * (`flying` keeps it hidden in place while the letters travel; `landed` shows it).
 */
export type TitleEntrance = "slide" | "flying" | "landed"

interface Props {
  meta: FiltersResponse | undefined
  covers: GameSummary[]
  play: boolean
  title: TitleEntrance
  /** The library's search, shared with the filter bar's field. */
  query: string
  onSearch: (q: string) => void
  /** Go to the library's results. */
  onBrowse: () => void
  onDeals: () => void
}

/**
 * The first screen: the wordmark (where the loading screen's letters land), one sentence
 * saying what this is, and the one thing to do here, search, which lands on the results.
 * Everything here that scroll or the pointer moves has `will-change`: a transform set from
 * JS on an ordinary element makes the browser repaint it every frame.
 */
export function Hero({ meta, covers, play, title, query, onSearch, onBrowse, onDeals }: Props) {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] })

  // Pointer position in the hero, -0.5..0.5, smoothed.
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const sx = useSpring(px, pointerSpring)
  const sy = useSpring(py, pointerSpring)

  const titleScale = useTransform(scrollYProgress, [0, 0.7], [1, 0.82])
  const titleOpacity = useTransform(scrollYProgress, [0.1, 0.65], [1, 0])
  const rowA = useTransform(scrollYProgress, [0, 1], ["0%", "-22%"])
  const rowB = useTransform(scrollYProgress, [0, 1], ["-22%", "0%"])

  const onPointerMove = (e: React.PointerEvent) => {
    if (reduced || e.pointerType !== "mouse") return
    const r = e.currentTarget.getBoundingClientRect()
    px.set((e.clientX - r.left) / r.width - 0.5)
    py.set((e.clientY - r.top) / r.height - 0.5)
  }

  const rise = (delay: number) =>
    ({ initial: { opacity: 0, y: 24 }, animate: play ? { opacity: 1, y: 0 } : undefined, transition: { duration: 1, ease: ease.wg, delay } }) as const

  return (
    <section
      ref={ref}
      aria-labelledby="hero-title"
      onPointerMove={onPointerMove}
      className="dark relative isolate flex min-h-[calc(100svh-var(--height-bar-mobile)-1.5rem)] flex-col justify-between overflow-hidden rounded-2xl bg-black text-foreground md:min-h-[calc(100svh-var(--height-bar)-1.5rem)]"
    >
      {covers.slice(0, SLOTS.length).map((game, i) => (
        <FloatingCover key={game.id} game={game} slot={SLOTS[i]!} index={i} play={play} progress={scrollYProgress} sx={sx} sy={sy} />
      ))}

      <m.div
        style={reduced ? undefined : { scale: titleScale, opacity: titleOpacity }}
        className="relative z-10 grid flex-1 content-center justify-items-center gap-6 px-4 pt-16 pb-8 text-center will-change-[transform,opacity] md:gap-8"
      >
        <h1
          id="hero-title"
          className="font-display text-[clamp(4.5rem,18vw,18rem)] leading-[0.82] tracking-tight uppercase"
          style={title === "flying" ? { opacity: 0 } : undefined}
        >
          {play ? (
            <SplitText
              text={BRAND}
              by="letter"
              onMount
              still={title !== "slide"}
              stagger={0.05}
              delay={0.15}
              partClassName={(_, i) => (i >= NEON_FROM ? "text-neon" : undefined)}
            />
          ) : (
            <span className="invisible">{BRAND}</span>
          )}
        </h1>

        <m.p {...rise(0.55)} className="max-w-2xl text-xl text-balance md:text-2xl">
          Compare new and used game prices across {meta ? `${meta.stores.length} Pakistani game stores` : "Pakistani game stores"}, cheapest first.
        </m.p>

        <m.form
          {...rise(0.7)}
          role="search"
          aria-label="Search the library"
          onSubmit={(e) => {
            e.preventDefault()
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur() // a phone's keyboard goes away
            onBrowse()
          }}
          className="grid w-full max-w-2xl justify-items-center gap-3"
        >
          <SearchField
            committed={query}
            onCommit={onSearch}
            size="lg"
            className="w-full"
            action={
              <Button type="submit" aria-label="Find prices" className="h-11 rounded-[10px] px-4 md:h-12 md:px-6">
                <RollText className="max-sm:hidden">Find prices</RollText>
                <ArrowDown className="sm:hidden" />
              </Button>
            }
          />
          {/* On phones the header has no page links: this is the way to the deals */}
          <Button type="button" variant="ghost" className="text-muted-foreground" onClick={onDeals}>
            <RollText>Or see today's deals</RollText>
            <ArrowRight />
          </Button>
        </m.form>
      </m.div>

      <div aria-hidden className="relative z-0 grid gap-1 pb-6 font-sans text-[clamp(2.75rem,8vw,8rem)] leading-[1] font-medium tracking-[-0.04em] whitespace-nowrap text-white/35 select-none">
        <WordRow words={ROW_A} x={rowA} play={play} />
        <WordRow words={ROW_B} x={rowB} play={play} offset={1} />
      </div>
    </section>
  )
}

function WordRow({ words, x, play, offset = 0 }: { words: string[]; x: MotionValue<string>; play: boolean; offset?: number }) {
  return (
    <m.div
      style={{ x }}
      initial={{ opacity: 0 }}
      animate={play ? { opacity: 1 } : undefined}
      transition={{ duration: 1.2, ease: ease.inkFade, delay: 0.9 + offset * 0.15 }}
      className="flex gap-[0.35em] will-change-transform"
    >
      {words.map((w, i) => (
        <span key={i}>{w}</span>
      ))}
    </m.div>
  )
}

function FloatingCover({
  game,
  slot,
  index,
  play,
  progress,
  sx,
  sy,
}: {
  game: GameSummary
  slot: (typeof SLOTS)[number]
  index: number
  play: boolean
  progress: MotionValue<number>
  sx: MotionValue<number>
  sy: MotionValue<number>
}) {
  const scrollY = useTransform(progress, [0, 1], [0, -260 * slot.depth])
  const mouseX = useTransform(sx, (v) => v * -60 * slot.depth)
  const mouseY = useTransform(sy, (v) => v * -40 * slot.depth)
  const y = useTransform(() => scrollY.get() + mouseY.get())

  return (
    <m.div
      aria-hidden
      style={{ left: slot.left, top: slot.top, x: mouseX, y }}
      className={cn("absolute z-[5] w-[clamp(84px,11vw,190px)] will-change-transform", "desktop" in slot && "hidden md:block")}
    >
      <m.div
        initial={{ clipPath: "inset(100% 0% 0% 0%)", rotate: slot.rotate * 1.6, scale: 1.1 }}
        animate={play ? { clipPath: "inset(0% 0% 0% 0%)", rotate: slot.rotate, scale: 1 } : undefined}
        whileHover={{ rotate: 0, scale: 1.08, transition: { duration: 0.5, ease: ease.wg } }}
        transition={{ duration: 1.1, ease: ease.wg, delay: 0.25 + index * 0.08 }}
        className="pointer-events-auto aspect-[4/5] overflow-hidden rounded-2xl"
      >
        {/* At most 190px wide; 400px covers 2x screens and is the copy the loading screen preloads.
            Nothing until it loads: a grey stand-in floating on its own reads as a placeholder box. */}
        <CoverArt src={game.image} title={game.title} width={400} placeholder={false} />
      </m.div>
    </m.div>
  )
}
