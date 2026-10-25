import { m, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react"
import { memo, useState } from "react"
import { ArrowUpRight } from "lucide-react"
import type { GameSummary } from "@lootledger/shared"
import { CoverArt } from "@/components/cover-art"
import { ShelfCardButtons } from "@/components/shelf-buttons"
import { Label } from "@/components/ui/label"
import { capitalize, formatPrice } from "@/lib/format"
import { useFinePointer } from "@/hooks/use-fine-pointer"
import { ease, pointerSpring } from "@/lib/motion"

// Card width per grid breakpoint in App.tsx: 2 columns, then 3 / 4 / 5 / 6 / 7.
const CARD_SIZES = "(min-width: 2200px) 14vw, (min-width: 1536px) 17vw, (min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"

interface Props {
  game: GameSummary
  storeName: string
  /** Position in the grid (or column in a row), for the stagger when cards scroll in. */
  index: number
  onOpen: (id: string) => void
  /** On the deals page: a neon sticker ("−60%") and a note that replaces the usual badges. */
  deal?: { sticker: string; note?: string }
  /** False skips the scroll-in, e.g. for a card the virtualized grid brings back into the DOM. */
  appear?: boolean
  /** Called once the card has scrolled into view. */
  onAppear?: (id: string) => void
}

/**
 * INK image card: art fills the card; platform and condition, the uppercase title and the
 * price sit over the bottom. Tilts toward the pointer in 3D (INK tilted cards), takes a
 * neon edge on hover, and wipes in with INK's clip-path reveal. Neon is for the price:
 * the one thing on the card someone is comparing.
 * Memoized: the virtualized grid re-renders as rows come and go while scrolling.
 */
export const GameCard = memo(function GameCard({ game, storeName, index, onOpen, deal, appear = true, onAppear }: Props) {
  const { best } = game
  const reduced = useReducedMotion()
  // The tilt follows a mouse: on a touch screen there's none, so it isn't set up.
  const fine = useFinePointer()
  const tilt = !reduced && fine
  // Fixed at mount: dropping whileInView later would send the card back to "hidden".
  const [scrollsIn] = useState(appear)

  // Pointer position over the card, 0..1 (centre = 0.5).
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const rotateX = useSpring(useTransform(py, [0, 1], [8, -8]), pointerSpring)
  const rotateY = useSpring(useTransform(px, [0, 1], [-10, 10]), pointerSpring)

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
  // element as in view. `transform` rather than `y`/`scale`, so the browser runs these
  // off the main thread and they stay smooth while the page scrolls.
  const card = {
    hidden: { opacity: 0, transform: "translateY(60px)" },
    shown: { opacity: 1, transform: "translateY(0px)", transition: { duration: 0.9, ease: ease.wg, delay } },
  }
  const art = {
    hidden: { clipPath: "inset(100% 0% 0% 0%)", transform: "scale(1.25)" },
    shown: { clipPath: "inset(0% 0% 0% 0%)", transform: "scale(1)", transition: { duration: 1.2, ease: ease.wg, delay: delay + 0.1 } },
  }

  return (
    <m.div
      variants={card}
      initial={reduced || !scrollsIn ? false : "hidden"}
      whileInView={scrollsIn ? "shown" : undefined}
      viewport={{ once: true, margin: "0px 0px -6% 0px" }}
      onViewportEnter={onAppear && (() => onAppear(game.id))}
      style={{ perspective: 1000 }}
    >
      {/* The tilting card holds the open button and, beside it, the shelf buttons (buttons can't nest). */}
      <m.div
        // The game dialog opens out of (and closes back into) the element with this attribute.
        data-game-card={game.id}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        style={tilt ? { rotateX, rotateY } : undefined}
        className="dark group/card relative aspect-[4/5] w-full rounded-2xl text-foreground"
      >
        {/* Opaque: the card is dark in either theme, and a cover still loading mustn't show a light page through */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl bg-raised">
          <m.button
            type="button"
            onClick={() => {
              onPointerLeave() // level the tilt so the dialog grows from the card's resting box
              onOpen(game.id)
            }}
            whileTap={{ scale: 0.97 }}
            className="absolute inset-0 block rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
          >
            {/* INK clip-path reveal, then a slow zoom on hover */}
            <m.div className="absolute inset-0" variants={art}>
              <CoverArt src={game.image} title={game.title} sizes={CARD_SIZES} className="transition-transform duration-[1.2s] ease-[cubic-bezier(0.3,0,0.04,1)] group-hover/card:scale-110" />
            </m.div>
  
            {/* The scrim the text sits on, so it needs no shadow of its own. Scaled rather than
                resized: it costs nothing on the cards the page scrolls past. */}
            <div className="absolute inset-0 origin-bottom bg-gradient-to-t from-black via-black/85 to-transparent transition-transform duration-700 ease-[cubic-bezier(0.3,0,0.04,1)] group-hover/card:scale-y-100 sm:scale-y-75" />
            <span className="pointer-events-none absolute inset-0 rounded-2xl border border-transparent transition-colors duration-300 group-hover/card:border-primary" />
  
            {/* WG black circle with the arrow that spins in on hover */}
            <span className="absolute top-3 right-3 grid size-10 scale-50 place-items-center rounded-full bg-black text-primary opacity-0 transition-[scale,opacity] duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] group-hover/card:scale-100 group-hover/card:opacity-100">
              <ArrowUpRight className="size-4 -rotate-90 transition-transform duration-700 ease-[cubic-bezier(0.645,0.045,0.355,1)] group-hover/card:rotate-0" />
            </span>
  
            {/* Sits one offers row (h-6) low, so that row starts below the card's edge; on hover
                the block slides up to show it. Moved, not resized: no layout while it plays. */}
            <div className="absolute inset-x-0 bottom-0 grid translate-y-6 gap-2 p-3 transition-transform duration-500 ease-[cubic-bezier(0.3,0,0.04,1)] group-hover/card:-translate-y-1 sm:p-4">
              {deal && (
                <span className="w-fit -rotate-2 rounded-sm bg-primary px-2 pt-1 pb-0.5 font-display text-2xl leading-none text-black uppercase sm:text-3xl">
                  {deal.sticker}
                </span>
              )}
              <Label className="transition-colors duration-300 group-hover/card:text-foreground">
                {[best.platform, best.condition && capitalize(best.condition)].filter(Boolean).join(" · ")}
              </Label>
              {/* Two lines at most; the full title is in the dialog (and read out here in full) */}
              <h3 className="line-clamp-2 font-display text-xl leading-[0.95] uppercase sm:text-2xl">{game.title}</h3>
              <div className="flex min-w-0 items-baseline justify-between gap-2">
                <span className={`text-lg font-semibold whitespace-nowrap sm:text-xl ${best.in_stock ? "text-primary" : "text-muted-foreground"}`}>
                  {deal && best.was && <s className="mr-1.5 text-sm font-normal text-muted-foreground">{formatPrice(best.was)}</s>}
                  {formatPrice(best.price)}
                </span>
                <span className="min-w-0 truncate text-[13px] text-muted-foreground sm:text-sm">{storeName}</span>
              </div>
              {deal ? (
                deal.note && <p className="text-[13px] text-muted-foreground">{deal.note}</p>
              ) : (
                <p className="flex h-5 flex-wrap gap-x-3 overflow-hidden text-[13px] leading-5 text-muted-foreground">
                  {!best.in_stock && <span className="text-destructive">Out of stock</span>}
                  {/* Phones keep the line to the saving, the reason to look closer */}
                  <span className={game.spread >= 100 ? "max-sm:hidden" : undefined}>
                    {game.storeCount} {game.storeCount === 1 ? "store" : "stores"}
                  </span>
                  {game.spread >= 100 && <span className="text-foreground">Save up to {formatPrice(game.spread)}</span>}
                </p>
              )}
              {/* Rises in on hover */}
              <div className="h-6 opacity-0 transition-opacity duration-500 ease-[cubic-bezier(0.3,0,0.04,1)] group-hover/card:opacity-100">
                <span className="mt-1 inline-flex text-[13px] font-semibold text-primary">
                  View {game.offerCount} {game.offerCount === 1 ? "offer" : "offers"} ↗
                </span>
              </div>
            </div>
          </m.button>
          <ShelfCardButtons game={game} className="absolute top-3 left-3" />
        </div>
      </m.div>
    </m.div>
  )
})
