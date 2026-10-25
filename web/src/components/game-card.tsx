import { m, useReducedMotion } from "motion/react"
import { memo, useState } from "react"
import type { GameSummary } from "@lootledger/shared"
import { CoverArt } from "@/components/cover-art"
import { ShelfCardButtons } from "@/components/shelf-buttons"
import { capitalize, formatPrice } from "@/lib/format"
import { ease } from "@/lib/motion"

// Card width per grid breakpoint in App.tsx: 2 columns, then 3 / 4 / 5 / 6 / 7.
const CARD_SIZES = "(min-width: 2200px) 14vw, (min-width: 1536px) 17vw, (min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"

/** The text under every cover is this tall, so the virtualized grid knows each row's height. */
export const CARD_META_HEIGHT = 124

interface Props {
  game: GameSummary
  storeName: string
  /** Position in the grid (or column in a row), for the stagger when cards scroll in. */
  index: number
  onOpen: (id: string) => void
  /** On the deals page: a lime sticker ("−60%") and a note that replaces the usual line. */
  deal?: { sticker: string; note?: string }
  /** False skips the scroll-in, e.g. for a card the virtualized grid brings back into the DOM. */
  appear?: boolean
  /** Called once the card has scrolled into view. */
  onAppear?: (id: string) => void
}

/**
 * A game in the grid (DESIGN.md, "Library"): its cover, big and unboxed, with the name, price
 * and shop written beneath in the two voices (the name in the text face, the price in the
 * display face). Reached for, the cover steps back into a lime chamfered frame, like a game
 * menu's selected tile. It wipes up into view with the cinematic ease.
 * Memoized: the virtualized grid re-renders as rows come and go while scrolling.
 */
export const GameCard = memo(function GameCard({ game, storeName, index, onOpen, deal, appear = true, onAppear }: Props) {
  const { best } = game
  const reduced = useReducedMotion()
  // Fixed at mount: dropping whileInView later would send the card back to "hidden".
  const [scrollsIn] = useState(appear)

  const delay = (index % 7) * 0.05
  // The wrapper watches the viewport and drives the cover through variants: the cover itself
  // starts fully clipped, and Chrome never reports a fully clipped element as in view.
  // `transform` rather than `y`/`scale`, so it runs off the main thread while the page scrolls.
  const card = {
    hidden: { opacity: 0, transform: "translateY(48px)" },
    shown: { opacity: 1, transform: "translateY(0px)", transition: { duration: 0.9, ease: ease.cine, delay } },
  }
  const art = {
    hidden: { clipPath: "inset(100% 0% 0% 0%)", transform: "scale(1.2)" },
    shown: { clipPath: "inset(0% 0% 0% 0%)", transform: "scale(1)", transition: { duration: 1.1, ease: ease.cine, delay: delay + 0.08 } },
  }
  const version = [best.platform, best.condition && capitalize(best.condition)].filter(Boolean).join(" · ")

  return (
    <m.div
      variants={card}
      initial={reduced || !scrollsIn ? false : "hidden"}
      whileInView={scrollsIn ? "shown" : undefined}
      viewport={{ once: true, margin: "0px 0px -6% 0px" }}
      onViewportEnter={onAppear && (() => onAppear(game.id))}
    >
      {/* The game dialog opens out of (and closes back into) the element with this attribute. */}
      <div data-game-card={game.id} className="group/card relative text-foreground">
        <button type="button" onClick={() => onOpen(game.id)} className="grid w-full text-left outline-none">
          <span className="relative block aspect-[4/5]">
            {/* The frame the cover steps back into */}
            <span aria-hidden className="chamfer absolute inset-0 bg-primary opacity-0 transition-opacity duration-300 group-hover/card:opacity-100 group-has-[button:focus-visible]/card:opacity-100" />
            <span className="chamfer absolute inset-0 overflow-hidden bg-raised transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/card:scale-[0.9] group-hover/card:-rotate-2 group-has-[button:focus-visible]/card:scale-[0.9] group-active/card:scale-[0.87]">
              <m.span className="absolute inset-0 block" variants={art}>
                <CoverArt src={game.image} title={game.title} sizes={CARD_SIZES} />
              </m.span>
            </span>
            {deal && (
              <span className="chamfer-xs absolute -bottom-2 left-3 max-w-[calc(100%-1.5rem)] -rotate-3 truncate bg-primary px-2 pt-1.5 pb-1 font-display text-base leading-none text-ink uppercase sm:text-lg">
                {deal.sticker}
              </span>
            )}
            {!best.in_stock && <span className="chamfer-xs absolute bottom-3 left-3 bg-ink px-2 py-1 label-caps text-bone">Out of stock</span>}
          </span>

          <span className="grid content-start gap-1.5 overflow-hidden pt-3.5" style={{ height: CARD_META_HEIGHT }}>
            <span className="truncate label-caps text-muted-foreground">{version}</span>
            <span className="line-clamp-2 text-sm leading-[1.2] font-bold tracking-[0.01em] uppercase sm:text-[15px]">{game.title}</span>
            <span className="flex min-w-0 items-baseline justify-between gap-2">
              <span className={`font-display text-lg leading-none whitespace-nowrap sm:text-xl ${best.in_stock ? "text-primary-ink" : "text-muted-foreground"}`}>
                {formatPrice(best.price)}
              </span>
              <span className="min-w-0 truncate text-xs text-muted-foreground">{storeName}</span>
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {deal ? (
                deal.note
              ) : (
                <>
                  {game.storeCount} {game.storeCount === 1 ? "shop" : "shops"}
                  {game.spread >= 100 && <span className="text-foreground"> · save up to {formatPrice(game.spread)}</span>}
                </>
              )}
            </span>
          </span>
        </button>
        <ShelfCardButtons game={game} className="absolute top-2.5 right-2.5" />
      </div>
    </m.div>
  )
})
