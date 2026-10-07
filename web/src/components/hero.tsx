import { m, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "motion/react"
import { ArrowDown } from "lucide-react"
import { useRef } from "react"
import { cn } from "cn"
import type { FiltersResponse, GameSummary } from "@ugs/shared"
import { CoverArt } from "@/components/cover-art"
import { CountUp } from "@/components/motion/count-up"
import { RollText } from "@/components/motion/roll-text"
import { SplitText } from "@/components/motion/split-text"
import { Button, ButtonCircle } from "@/components/ui/button"
import { Eyebrow } from "@/components/ui/eyebrow"
import { ease, pointerSpring } from "@/lib/motion"

// INK hero: tilted art floating around the headline. Positions are % of the hero.
const SLOTS = [
  { left: "3%", top: "12%", rotate: -12, depth: 1.2 },
  { left: "80%", top: "9%", rotate: 10, depth: 0.8 },
  { left: "8%", top: "56%", rotate: 8, depth: 1 },
  { left: "84%", top: "52%", rotate: -9, depth: 1.4 },
  { left: "24%", top: "74%", rotate: -5, depth: 0.6, desktop: true },
  { left: "66%", top: "76%", rotate: 11, depth: 0.9, desktop: true },
] as const

const BRAND = "LootLedger"
const NEON_FROM = 4 // "Ledger" gets WG's neon gradient

/** Each letter shows its own slice of one gradient, so the word reads as one continuous sweep. */
const neonSlice = (k: number, n: number): React.CSSProperties => ({
  backgroundSize: `${n * 100}% 100%`,
  backgroundPosition: `${(k / (n - 1)) * 100}% 0`,
})

// WG rows of big words, alternating white and neon gradient, sliding opposite ways on scroll.
const ROW_A = ["PS5", "PS4", "Switch", "Xbox", "PC", "PS5", "PS4", "Switch", "Xbox", "PC"]
const ROW_B = ["New", "Used", "Disc", "Digital", "Deals", "New", "Used", "Disc", "Digital", "Deals"]

interface Props {
  meta: FiltersResponse | undefined
  covers: GameSummary[]
  play: boolean
  onBrowse: () => void
  onStores: () => void
  onDeals: () => void
}

// Everything here that scroll or the pointer moves has `will-change`: a transform set
// from JS on an ordinary element makes the browser repaint it every frame.
export function Hero({ meta, covers, play, onBrowse, onStores, onDeals }: Props) {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] })

  // Pointer position in the hero, -0.5..0.5, smoothed.
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const sx = useSpring(px, pointerSpring)
  const sy = useSpring(py, pointerSpring)
  // The glow's offset from the hero's centre in px: moved by transform, not left/top,
  // so following the pointer doesn't re-lay out (and re-blur) it every frame.
  const gx = useMotionValue(0)
  const gy = useMotionValue(0)
  const glowX = useSpring(gx, pointerSpring)
  const glowY = useSpring(gy, pointerSpring)

  const titleScale = useTransform(scrollYProgress, [0, 0.7], [1, 0.82])
  const titleOpacity = useTransform(scrollYProgress, [0.1, 0.65], [1, 0])
  const titleBlur = useTransform(scrollYProgress, [0.1, 0.65], ["blur(0px)", "blur(12px)"])
  const rowA = useTransform(scrollYProgress, [0, 1], ["0%", "-22%"])
  const rowB = useTransform(scrollYProgress, [0, 1], ["-22%", "0%"])

  const onPointerMove = (e: React.PointerEvent) => {
    if (reduced || e.pointerType !== "mouse") return
    const r = e.currentTarget.getBoundingClientRect()
    px.set((e.clientX - r.left) / r.width - 0.5)
    py.set((e.clientY - r.top) / r.height - 0.5)
    gx.set(e.clientX - r.left - r.width / 2)
    gy.set(e.clientY - r.top - r.height / 2)
  }

  return (
    <section
      ref={ref}
      aria-labelledby="hero-title"
      onPointerMove={onPointerMove}
      className="dark relative isolate flex min-h-[calc(100svh-var(--height-bar-mobile)-1.5rem)] flex-col justify-between overflow-hidden rounded-2xl bg-black text-foreground md:min-h-[calc(100svh-var(--height-bar)-1.5rem)]"
    >
      {/* WG star glow: a blurred neon light that follows the pointer */}
      <m.div
        aria-hidden
        style={{ x: glowX, y: glowY }}
        className="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-[42vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[120px] will-change-transform"
      />

      {covers.slice(0, SLOTS.length).map((game, i) => (
        <FloatingCover key={game.id} game={game} slot={SLOTS[i]!} index={i} play={play} progress={scrollYProgress} sx={sx} sy={sy} />
      ))}

      <m.div
        style={reduced ? undefined : { scale: titleScale, opacity: titleOpacity, filter: titleBlur }}
        className="relative z-10 grid flex-1 content-center justify-items-center gap-6 px-4 pt-16 pb-8 text-center will-change-[transform,opacity,filter] md:gap-8"
      >
        <m.div initial={{ opacity: 0 }} animate={play ? { opacity: 1 } : undefined} transition={{ duration: 0.8, ease: ease.inkFade, delay: 0.1 }}>
          <Eyebrow className="text-primary">
            {meta ? (
              <>
                <CountUp value={meta.stores.length} /> stores · <CountUp value={meta.totals.offers} /> offers · <CountUp value={meta.totals.games} /> games
              </>
            ) : (
              "Price comparison"
            )}
          </Eyebrow>
        </m.div>

        <h1 id="hero-title" className="font-display text-[clamp(4.5rem,18vw,18rem)] leading-[0.82] tracking-tight uppercase">
          {play ? (
            <SplitText
              text={BRAND}
              by="letter"
              onMount
              stagger={0.05}
              delay={0.15}
              partClassName={(_, i) => (i >= NEON_FROM ? "text-neon" : undefined)}
              partStyle={(_, i) => (i >= NEON_FROM ? neonSlice(i - NEON_FROM, BRAND.length - NEON_FROM) : undefined)}
            />
          ) : (
            <span className="invisible">{BRAND}</span>
          )}
        </h1>

        <m.p
          initial={{ opacity: 0, y: 24 }}
          animate={play ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 1, ease: ease.wg, delay: 0.55 }}
          className="max-w-xl text-lg text-muted-foreground md:text-xl"
        >
          Compare new and used PlayStation game prices across Pakistani game stores in one place.
        </m.p>

        <m.div
          initial={{ opacity: 0, y: 24 }}
          animate={play ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 1, ease: ease.wg, delay: 0.7 }}
          className="flex flex-wrap justify-center gap-3"
        >
          <Button size="lg" onClick={onBrowse}>
            <RollText>Start browsing</RollText>
            <ButtonCircle icon={ArrowDown} />
          </Button>
          <Button variant="secondary" size="lg" className="pr-7" onClick={onDeals}>
            <RollText>Today's deals</RollText>
          </Button>
          <Button variant="secondary" size="lg" className="pr-7" onClick={onStores}>
            <RollText>See the stores</RollText>
          </Button>
        </m.div>
      </m.div>

      <div aria-hidden className="relative z-0 grid gap-1 pb-6 font-sans text-[clamp(2.75rem,8vw,8rem)] leading-[1] font-medium tracking-[-0.04em] whitespace-nowrap select-none">
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
        <span key={i} className={(i + offset) % 2 ? (i % 4 < 2 ? "text-neon" : "text-neon-reverse") : "text-white"}>
          {w}
        </span>
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
        className="pointer-events-auto aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.8)]"
      >
        {/* At most 190px wide; 400px covers 2x screens and is the copy the loading screen preloads */}
        <CoverArt src={game.image} title={game.title} width={400} />
      </m.div>
    </m.div>
  )
}
