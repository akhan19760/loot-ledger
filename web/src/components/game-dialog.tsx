import { useLayoutEffect, useRef, useState } from "react"
import { useQuery, type UseQueryResult } from "@tanstack/react-query"
import { AnimatePresence, m, useReducedMotion } from "motion/react"
import { cn } from "cn"
import { byStockThenPrice, groupVersions, listingMatches, versionInsights, type Game, type Insights, type Listing, type Version } from "@lootledger/shared"
import { CompareView } from "@/components/compare-view"
import { CoverArt } from "@/components/cover-art"
import { RollText } from "@/components/motion/roll-text"
import { useScrollLock } from "@/components/motion/smooth-scroll"
import { SplitText } from "@/components/motion/split-text"
import { AddToCartButton } from "@/components/cart-dialog"
import { ShareButton } from "@/components/share-button"
import { ShelfActions } from "@/components/shelf-buttons"
import { Badge } from "@/components/ui/badge"
import { Button, ButtonCircle } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Eyebrow } from "@/components/ui/eyebrow"
import { Skeleton } from "@/components/ui/skeleton"
import { PillToggle } from "@/components/ui/pill-toggle"
import type { Filters } from "@/hooks/use-library-url"
import { api } from "@/lib/api"
import { formatPrice } from "@/lib/format"
import { ease } from "@/lib/motion"

interface Props {
  gameId: string | null
  filters: Filters
  storeNames: Map<string, string>
  onClose: () => void
  onOpenCart: () => void
}

// A type, not an interface, so motion accepts it as animation values.
type Box = {
  top: number
  left: number
  width: number
  height: number
}

/** A panel flying between a card in the grid and the open dialog. */
interface Flight {
  dir: "open" | "close"
  card: Box
  image: string | null
  /** Where a closing flight starts; an opening one heads for the dialog's live box. */
  dialog?: Box
}

type View = "list" | "compare"

const VIEW_KEY = "lootledger-offer-view"

function storedView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "compare" ? "compare" : "list"
  } catch {
    return "list"
  }
}

/** The offers view the reader picked last time (a list by default). */
function useOfferView() {
  const [view, setView] = useState<View>(storedView)
  const choose = (next: View) => {
    setView(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      // Storage blocked: the choice lasts until reload.
    }
  }
  return [view, choose] as const
}

const boxOf = (el: Element): Box => {
  const { top, left, width, height } = el.getBoundingClientRect()
  return { top, left, width, height }
}

/** The grid card for a game, if it's on screen to fly from or back to. */
function findCard(id: string) {
  const el = document.querySelector(`[data-game-card="${CSS.escape(id)}"]`)
  if (!el) return null
  const card = boxOf(el)
  const visible = card.top < innerHeight && card.top + card.height > 0 && card.left < innerWidth && card.left + card.width > 0
  return visible ? { card, image: el.querySelector("img")?.currentSrc || null } : null
}

export function GameDialog({ gameId, filters, storeNames, onClose, onOpenCart }: Props) {
  const game = useQuery({ queryKey: ["game", gameId], queryFn: () => api.game(gameId!), enabled: !!gameId })
  useScrollLock(!!gameId)
  const reduced = useReducedMotion()
  const [view, setView] = useOfferView()

  // Container transform: opening, a panel carrying the card's cover grows from the card
  // to the dialog's box while the cover fades out, then hands over to the dialog; closing
  // runs the other way. Without a card to fly from (a shared link), the dialog rises in.
  const [content, setContent] = useState<HTMLDivElement | null>(null)
  const [box, setBox] = useState<Box | null>(null)
  const [flight, setFlight] = useState<Flight | null>(null)
  const [fromCard, setFromCard] = useState(false)
  const prevId = useRef<string | null>(null)

  useLayoutEffect(() => {
    const prev = prevId.current
    if (prev === gameId) return
    prevId.current = gameId
    if (reduced) return
    if (gameId) {
      const found = findCard(gameId)
      setFromCard(!!found)
      setFlight(found && { dir: "open", ...found })
    } else if (prev && fromCard) {
      const found = findCard(prev)
      setFlight(found && content ? { dir: "close", ...found, dialog: boxOf(content) } : null)
      setFromCard(false)
    }
  }, [gameId, reduced, fromCard, content])

  // The dialog's box, followed as it resizes (say, when the offers arrive mid-flight).
  useLayoutEffect(() => {
    if (!content) return setBox(null)
    const measure = () => setBox(boxOf(content))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(content)
    return () => observer.disconnect()
  }, [content])

  const inFlight = flight?.dir === "open"

  const offers = game.data ? game.data.listings.toSorted(byStockThenPrice) : []
  const matching = offers.filter((l) => listingMatches(l, filters))
  const others = offers.filter((l) => !listingMatches(l, filters))
  const inStock = offers.filter((l) => l.in_stock).map((l) => l.price)
  const cheapest = inStock.length ? Math.min(...inStock) : null
  const storeCount = new Set(offers.map((l) => l.store)).size
  const versions = groupVersions(offers)
  const insights = versionInsights(versions)
  const stores = [...storeNames]
    .filter(([id]) => offers.some((l) => l.store === id))
    .map(([id, name]) => ({ id, name }))

  return (
    <>
      <Dialog open={!!gameId} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          ref={setContent}
          className={cn(
            "sm:max-w-3xl",
            // The flying panel stands in for the dialog's own entrance and exit. The dialog
            // waits, invisible but laid out (so the panel knows where to go), then fades in.
            fromCard && "transition-opacity data-open:animate-none! data-closed:animate-none! data-open:duration-300!",
            inFlight && "opacity-0",
          )}
        >
          {/* Mounted afresh when the panel lands, so the entrance plays where it can be seen */}
          <div key={inFlight ? "measuring" : "shown"} className="contents">
            <DialogBody
              game={game}
              offers={offers}
              matching={matching}
              others={others}
              cheapest={cheapest}
              storeCount={storeCount}
              storeNames={storeNames}
              view={view}
              onViewChange={setView}
              versions={versions}
              insights={insights}
              stores={stores}
              filters={filters}
              onOpenCart={onOpenCart}
            />
          </div>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {flight && (flight.dir === "close" || box) && (
          <m.div
            key={flight.dir}
            aria-hidden
            initial={flight.dir === "open" ? flight.card : flight.dialog}
            animate={flight.dir === "open" ? box! : flight.card}
            exit={{ opacity: 0, transition: { duration: 0.3, ease: "easeOut" } }}
            transition={{ duration: flight.dir === "open" ? 0.65 : 0.5, ease: ease.wg }}
            onAnimationComplete={() => setFlight(null)}
            className="pointer-events-none fixed z-[60] overflow-hidden rounded-2xl border border-border bg-popover shadow-[0_30px_80px_-20px_rgb(0_0_0/0.6)]"
          >
            {flight.image && (
              <m.img
                src={flight.image}
                alt=""
                initial={{ opacity: flight.dir === "open" ? 1 : 0 }}
                animate={{ opacity: flight.dir === "open" ? 0 : 1 }}
                transition={{ duration: 0.4, ease: "easeInOut", delay: flight.dir === "open" ? 0.1 : 0.05 }}
                className="size-full object-cover"
              />
            )}
          </m.div>
        )}
      </AnimatePresence>
    </>
  )
}

interface BodyProps {
  game: UseQueryResult<Game>
  offers: Listing[]
  matching: Listing[]
  others: Listing[]
  cheapest: number | null
  storeCount: number
  storeNames: Map<string, string>
  view: View
  onViewChange: (view: View) => void
  versions: Version[]
  insights: Insights
  stores: { id: string; name: string }[]
  filters: Filters
  onOpenCart: () => void
}

function DialogBody({ game, offers, matching, others, cheapest, storeCount, storeNames, view, onViewChange, versions, insights, stores, filters, onOpenCart }: BodyProps) {
  // "Cheapest" marks the best offer of each version (a used PS4 disc isn't competing with a
  // new PS5 one) when it beat another offer, and always the cheapest overall.
  const badged = new Set(versions.flatMap((v) => (v.best && (v.inStock > 1 || v.best.price === cheapest) ? [v.best] : [])))
  return game.isPending ? (
    <div className="grid gap-4" aria-busy>
      <Skeleton className="h-28" />
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
    </div>
  ) : game.isError ? (
    <DialogHeader>
      <DialogTitle>Couldn't load this game</DialogTitle>
      <DialogDescription className="text-destructive">{game.error.message}</DialogDescription>
    </DialogHeader>
  ) : (
    <>
      <DialogHeader className="flex-row items-start gap-4 pr-10 text-left sm:gap-6">
        <m.div
          initial={{ clipPath: "inset(100% 0% 0% 0%)", rotate: -8, scale: 1.1 }}
          animate={{ clipPath: "inset(0% 0% 0% 0%)", rotate: -3, scale: 1 }}
          whileHover={{ rotate: 0, scale: 1.05, transition: { duration: 0.5, ease: ease.wg } }}
          transition={{ duration: 1, ease: ease.wg, delay: 0.1 }}
          className="aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-sm bg-surface shadow-[0_20px_40px_-12px_rgb(0_0_0/0.8)] sm:w-28"
        >
          <CoverArt src={game.data.image} title={game.data.title} />
        </m.div>
        <div className="grid min-w-0 gap-3">
          <Eyebrow className="text-primary-ink">{game.data.genres.join(" · ") || "Genre unknown"}</Eyebrow>
          <DialogTitle>
            <SplitText text={game.data.title} onMount delay={0.15} stagger={0.05} />
          </DialogTitle>
          <DialogDescription>
            {offers.length} {offers.length === 1 ? "offer" : "offers"} across {storeCount} {storeCount === 1 ? "store" : "stores"}
          </DialogDescription>
          <div className="flex flex-wrap gap-2">
            <ShelfActions game={game.data} />
            <AddToCartButton
              game={game.data}
              want={{ platform: filters.platform || null, condition: filters.condition || null, format: null }}
              onOpenCart={onOpenCart}
            />
            <ShareButton game={game.data} storeNames={storeNames} />
          </div>
        </div>
      </DialogHeader>

      {offers.length > 1 && <PillToggle label="Offers view" value={view} options={VIEWS} onChange={onViewChange} />}

      {view === "compare" && offers.length > 1 ? (
        <CompareView versions={versions} insights={insights} stores={stores} filters={filters} />
      ) : (
        <>
          <OfferList offers={matching} storeNames={storeNames} cheapest={cheapest} badged={badged} startDelay={0.3} />

          {others.length > 0 && (
            <section className="grid gap-3">
              <Eyebrow className="text-muted-foreground">Other offers, outside your filters</Eyebrow>
              <OfferList offers={others} storeNames={storeNames} cheapest={cheapest} badged={badged} startDelay={0.3 + matching.length * 0.05} />
            </section>
          )}
        </>
      )}
    </>
  )
}

const VIEWS: [View, string][] = [
  ["list", "All offers"],
  ["compare", "Compare"],
]

function OfferList({
  offers,
  storeNames,
  cheapest,
  badged,
  startDelay,
}: {
  offers: Listing[]
  storeNames: Map<string, string>
  cheapest: number | null
  badged: Set<Listing>
  startDelay: number
}) {
  const reduced = useReducedMotion()
  return (
    <ul className="grid gap-2">
      {offers.map((l, i) => (
        <m.li
          key={i}
          initial={reduced ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: ease.wg, delay: Math.min(startDelay + i * 0.05, 1.2) }}
        >
          <OfferRow listing={l} storeName={storeNames.get(l.store) ?? l.store} cheapest={l.in_stock && l.price === cheapest} badge={badged.has(l)} />
        </m.li>
      ))}
    </ul>
  )
}

function OfferRow({ listing: l, storeName, cheapest, badge }: { listing: Listing; storeName: string; cheapest: boolean; badge: boolean }) {
  return (
    <div
      className={cn(
        "group/row grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 rounded-2xl border border-transparent bg-surface p-4 transition-colors duration-300 hover:border-foreground/15 hover:bg-foreground/[0.08]",
        !l.in_stock && "opacity-60",
        cheapest && "glow-pulse",
      )}
    >
      <div className="grid min-w-0 gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-semibold">{storeName}</span>
          {badge && <Badge variant="default">Cheapest</Badge>}
          {l.platform && <Badge>{l.platform}</Badge>}
          <Badge variant={l.condition === "new" ? "outline" : "secondary"}>{l.condition}</Badge>
          {l.format === "digital" && <Badge>digital</Badge>}
          {!l.in_stock && <Badge variant="destructive">out of stock</Badge>}
        </div>
        <p className="truncate text-sm text-muted-foreground" title={l.raw_title + (l.variant ? ` (${l.variant})` : "")}>
          {l.raw_title}
          {l.variant && ` (${l.variant})`}
        </p>
      </div>

      <div className="text-right tabular-nums">
        {l.was && <s className="mr-2 text-sm text-muted-foreground">{formatPrice(l.was)}</s>}
        <span className={cn("text-xl font-semibold transition-colors duration-300", cheapest ? "text-primary-ink" : "group-hover/row:text-primary-ink")}>
          {formatPrice(l.price)}
        </span>
      </div>

      <Button asChild variant={l.in_stock ? "default" : "secondary"} size="sm" className="col-span-2 pr-1 sm:col-span-1 sm:col-start-2">
        <a href={l.url} target="_blank" rel="noopener">
          <RollText>
            {l.in_stock ? "Buy" : "View"} at {storeName}
          </RollText>
          <ButtonCircle className="size-7" />
        </a>
      </Button>
    </div>
  )
}
