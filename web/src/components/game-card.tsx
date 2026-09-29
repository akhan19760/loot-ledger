import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react"
import { ArrowUpRight } from "lucide-react"
import type { GameSummary } from "@ugs/shared"
import { CoverArt } from "@/components/cover-art"
import { ShelfCardButtons } from "@/components/shelf-buttons"
import { Badge } from "@/components/ui/badge"
import { Eyebrow } from "@/components/ui/eyebrow"
import { formatPrice } from "@/lib/format"
import { ease, pointerSpring } from "@/lib/motion"

// Card width per grid breakpoint in App.tsx: 2 columns, then 3 / 4 / 5 / 6 / 7.
const CARD_SIZES = "(min-width: 2200px) 14vw, (min-width: 1536px) 17vw, (min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"

interface Props {
  game: GameSummary
  storeName: string
  /** Position in the grid, for the stagger when cards scroll in. */
  index: number
  onOpen: () => void
  /** On the deals page: a neon sticker ("−60%") and a note that replaces the usual badges. */
  deal?: { sticker: string; note?: string }
}

/**
 * INK image card: art fills the card; eyebrow, uppercase title and price sit over the
 * bottom. Tilts toward the pointer in 3D (INK tilted cards) with a neon glare, glows
 * neon on hover (WG drop-shadow), and wipes in with INK's clip-path reveal.
 */
export function GameCard({ game, storeName, index, onOpen, deal }: Props) {
  const { best } = game
  const reduced = useReducedMotion()

  // Pointer position over the card, 0..1 (centre = 0.5).
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const rotateX = useSpring(useTransform(py, [0, 1], [8, -8]), pointerSpring)
  const rotateY = useSpring(useTransform(px, [0, 1], [-10, 10]), pointerSpring)
  const glareX = useTransform(px, (v) => `${v * 100}%`)
  const glareY = useTransform(py, (v) => `${v * 100}%`)
  const glare = useMotionTemplate`radial-gradient(380px circle at ${glareX} ${glareY}, rgb(212 251 8 / 0.22), transparent 55%)`

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (reduced || e.pointerType !== "mouse") return
    const r = e.currentTarget.getBoundingClientRect()
    px.set((e.clientX - r.left) / r.width)
    py.set((e.clientY - r.top) / r.height)
  }
  const onPointerLeave = () => {
    px.set(0.5)
    py.set(0.5)
  }

  const delay = (index % 6) * 0.06
  // The wrapper watches the viewport and drives the image through variants: the
  // image itself starts fully clipped, and Chrome never reports a fully clipped
  // element as in view.
  const card = {
    hidden: { opacity: 0, y: 60 },
    shown: { opacity: 1, y: 0, transition: { duration: 0.9, ease: ease.wg, delay } },
  }
  const art = {
    hidden: { clipPath: "inset(100% 0% 0% 0%)", scale: 1.25 },
    shown: { clipPath: "inset(0% 0% 0% 0%)", scale: 1, transition: { duration: 1.2, ease: ease.wg, delay: delay + 0.1 } },
  }

  return (
    <motion.div
      variants={card}
      initial={reduced ? false : "hidden"}
      whileInView="shown"
      viewport={{ once: true, margin: "0px 0px -6% 0px" }}
      style={{ perspective: 1000 }}
    >
      {/* The tilting card holds the open button and, beside it, the shelf buttons (buttons can't nest). */}
      <motion.div
        // The game dialog opens out of (and closes back into) the element with this attribute.
        data-game-card={game.id}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        style={reduced ? undefined : { rotateX, rotateY }}
        className="dark group/card relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-surface text-foreground shadow-[0_0_0_0_rgb(212_251_8/0)] transition-shadow duration-500 hover:shadow-[0_0_40px_-8px_rgb(212_251_8/0.55)]"
      >
        <motion.button
          type="button"
          onClick={() => {
            onPointerLeave() // level the tilt so the dialog grows from the card's resting box
            onOpen()
          }}
          whileTap={{ scale: 0.97 }}
          className="absolute inset-0 block rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
        >
          {/* INK clip-path reveal, then a slow zoom on hover */}
          <motion.div className="absolute inset-0" variants={art}>
            <CoverArt src={game.image} title={game.title} sizes={CARD_SIZES} className="transition-transform duration-[1.2s] ease-[cubic-bezier(0.3,0,0.04,1)] group-hover/card:scale-110" />
          </motion.div>
  
          <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-black via-black/85 to-transparent transition-[height] duration-700 ease-[cubic-bezier(0.3,0,0.04,1)] group-hover/card:h-full sm:h-3/4" />
          <motion.div aria-hidden style={{ backgroundImage: glare }} className="pointer-events-none absolute inset-0 opacity-0 mix-blend-screen transition-opacity duration-300 group-hover/card:opacity-100" />
          <span className="pointer-events-none absolute inset-0 rounded-2xl border border-white/5 transition-colors duration-300 group-hover/card:border-primary" />
  
          {/* WG black circle with the arrow that spins in on hover */}
          <span className="absolute top-3 right-3 grid size-10 scale-50 place-items-center rounded-full bg-black text-primary opacity-0 transition-[scale,opacity] duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] group-hover/card:scale-100 group-hover/card:opacity-100">
            <ArrowUpRight className="size-4 -rotate-90 transition-transform duration-700 ease-[cubic-bezier(0.645,0.045,0.355,1)] group-hover/card:rotate-0" />
          </span>
  
          <div className="absolute inset-x-0 bottom-0 grid gap-2 p-3 transition-transform duration-500 ease-[cubic-bezier(0.3,0,0.04,1)] [text-shadow:0_1px_14px_rgb(0_0_0/0.85)] group-hover/card:-translate-y-1 sm:p-4">
            {deal && (
              <span className="w-fit -rotate-2 rounded-sm bg-primary px-2 pt-1 pb-0.5 font-display text-2xl leading-none text-black uppercase [text-shadow:none] sm:text-3xl">
                {deal.sticker}
              </span>
            )}
            <Eyebrow className="text-muted-foreground transition-colors duration-300 group-hover/card:text-primary">
              {[best.platform, best.condition].filter(Boolean).join(" · ")}
            </Eyebrow>
            <h3 className="line-clamp-3 font-display text-2xl leading-[0.95] uppercase">{game.title}</h3>
            <div className="flex min-w-0 items-baseline justify-between gap-2">
              <span className={`text-lg font-semibold whitespace-nowrap tabular-nums sm:text-xl ${best.in_stock ? "text-primary" : "text-muted-foreground"}`}>
                {deal && best.was && <s className="mr-1.5 text-sm font-normal text-muted-foreground">{formatPrice(best.was)}</s>}
                {formatPrice(best.price)}
              </span>
              <span className="min-w-0 truncate text-xs text-muted-foreground">{storeName}</span>
            </div>
            {deal ? (
              deal.note && <p className="text-xs text-muted-foreground">{deal.note}</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {!best.in_stock && <Badge variant="destructive">Out of stock</Badge>}
                <Badge className="hidden sm:inline-flex">
                  {game.storeCount} {game.storeCount === 1 ? "store" : "stores"}
                </Badge>
                {game.spread >= 100 && <Badge variant="outline">Save up to {formatPrice(game.spread)}</Badge>}
              </div>
            )}
            {/* Rises in on hover */}
            <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.3,0,0.04,1)] group-hover/card:grid-rows-[1fr]">
              <div className="overflow-hidden">
                <span className="mt-1 inline-flex text-xs font-semibold tracking-wider text-primary uppercase">
                  View {game.offerCount} {game.offerCount === 1 ? "offer" : "offers"} ↗
                </span>
              </div>
            </div>
          </div>
        </motion.button>
        <ShelfCardButtons game={game} className="absolute top-3 left-3" />
      </motion.div>
    </motion.div>
  )
}
