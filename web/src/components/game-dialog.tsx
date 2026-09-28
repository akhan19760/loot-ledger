import { useQuery } from "@tanstack/react-query"
import { motion, useReducedMotion } from "motion/react"
import { cn } from "cn"
import { byStockThenPrice, listingMatches, type Listing } from "@ugs/shared"
import { CoverArt } from "@/components/cover-art"
import { RollText } from "@/components/motion/roll-text"
import { useScrollLock } from "@/components/motion/smooth-scroll"
import { SplitText } from "@/components/motion/split-text"
import { Badge } from "@/components/ui/badge"
import { Button, ButtonCircle } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Eyebrow } from "@/components/ui/eyebrow"
import { Skeleton } from "@/components/ui/skeleton"
import type { Filters } from "@/hooks/use-library-url"
import { api } from "@/lib/api"
import { formatPrice } from "@/lib/format"
import { ease } from "@/lib/motion"

interface Props {
  gameId: string | null
  filters: Filters
  storeNames: Map<string, string>
  onClose: () => void
}

export function GameDialog({ gameId, filters, storeNames, onClose }: Props) {
  const game = useQuery({ queryKey: ["game", gameId], queryFn: () => api.game(gameId!), enabled: !!gameId })
  useScrollLock(!!gameId)

  const offers = game.data ? game.data.listings.toSorted(byStockThenPrice) : []
  const matching = offers.filter((l) => listingMatches(l, filters))
  const others = offers.filter((l) => !listingMatches(l, filters))
  const inStock = offers.filter((l) => l.in_stock).map((l) => l.price)
  const cheapest = inStock.length ? Math.min(...inStock) : null
  const storeCount = new Set(offers.map((l) => l.store)).size

  return (
    <Dialog open={!!gameId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        {game.isPending ? (
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
              <motion.div
                initial={{ clipPath: "inset(100% 0% 0% 0%)", rotate: -8, scale: 1.1 }}
                animate={{ clipPath: "inset(0% 0% 0% 0%)", rotate: -3, scale: 1 }}
                whileHover={{ rotate: 0, scale: 1.05, transition: { duration: 0.5, ease: ease.wg } }}
                transition={{ duration: 1, ease: ease.wg, delay: 0.1 }}
                className="aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-sm bg-surface shadow-[0_20px_40px_-12px_rgb(0_0_0/0.8)] sm:w-28"
              >
                <CoverArt src={game.data.image} title={game.data.title} sizes="(min-width: 640px) 112px, 80px" />
              </motion.div>
              <div className="grid min-w-0 gap-3">
                <Eyebrow className="text-primary">{game.data.genres.join(" · ") || "Genre unknown"}</Eyebrow>
                <DialogTitle>
                  <SplitText text={game.data.title} onMount delay={0.15} stagger={0.05} />
                </DialogTitle>
                <DialogDescription>
                  {offers.length} {offers.length === 1 ? "offer" : "offers"} across {storeCount} {storeCount === 1 ? "store" : "stores"}
                </DialogDescription>
              </div>
            </DialogHeader>

            <OfferList offers={matching} storeNames={storeNames} cheapest={cheapest} startDelay={0.3} />

            {others.length > 0 && (
              <section className="grid gap-3">
                <Eyebrow className="text-muted-foreground">Other offers, outside your filters</Eyebrow>
                <OfferList offers={others} storeNames={storeNames} cheapest={cheapest} startDelay={0.3 + matching.length * 0.05} />
              </section>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function OfferList({ offers, storeNames, cheapest, startDelay }: { offers: Listing[]; storeNames: Map<string, string>; cheapest: number | null; startDelay: number }) {
  const reduced = useReducedMotion()
  return (
    <ul className="grid gap-2">
      {offers.map((l, i) => (
        <motion.li
          key={i}
          initial={reduced ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: ease.wg, delay: Math.min(startDelay + i * 0.05, 1.2) }}
        >
          <OfferRow listing={l} storeName={storeNames.get(l.store) ?? l.store} cheapest={l.in_stock && l.price === cheapest} />
        </motion.li>
      ))}
    </ul>
  )
}

function OfferRow({ listing: l, storeName, cheapest }: { listing: Listing; storeName: string; cheapest: boolean }) {
  return (
    <div
      className={cn(
        "group/row grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 rounded-2xl border border-transparent bg-surface p-4 transition-colors duration-300 hover:border-white/15 hover:bg-white/[0.08]",
        !l.in_stock && "opacity-60",
        cheapest && "glow-pulse",
      )}
    >
      <div className="grid min-w-0 gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-semibold">{storeName}</span>
          {cheapest && <Badge variant="default">Cheapest</Badge>}
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
        <span className={cn("text-xl font-semibold transition-colors duration-300", cheapest ? "text-primary" : "group-hover/row:text-primary")}>
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
