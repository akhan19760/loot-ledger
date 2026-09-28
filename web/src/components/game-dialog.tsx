import { useQuery } from "@tanstack/react-query"
import { byStockThenPrice, listingMatches, type Listing } from "@ugs/shared"
import { CoverArt } from "@/components/cover-art"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Eyebrow } from "@/components/ui/eyebrow"
import { Skeleton } from "@/components/ui/skeleton"
import type { Filters } from "@/hooks/use-library-url"
import { api } from "@/lib/api"
import { formatPrice } from "@/lib/format"

interface Props {
  gameId: string | null
  filters: Filters
  storeNames: Map<string, string>
  onClose: () => void
}

export function GameDialog({ gameId, filters, storeNames, onClose }: Props) {
  const game = useQuery({ queryKey: ["game", gameId], queryFn: () => api.game(gameId!), enabled: !!gameId })

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
              <div className="aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-sm bg-surface sm:w-28">
                <CoverArt src={game.data.image} title={game.data.title} />
              </div>
              <div className="grid min-w-0 gap-3">
                <Eyebrow className="text-primary">{game.data.genres.join(" · ") || "Genre unknown"}</Eyebrow>
                <DialogTitle>{game.data.title}</DialogTitle>
                <DialogDescription>
                  {offers.length} {offers.length === 1 ? "offer" : "offers"} across {storeCount} {storeCount === 1 ? "store" : "stores"}
                </DialogDescription>
              </div>
            </DialogHeader>

            <ul className="grid gap-2">
              {matching.map((l, i) => (
                <OfferRow key={i} listing={l} storeName={storeNames.get(l.store) ?? l.store} cheapest={l.in_stock && l.price === cheapest} />
              ))}
            </ul>

            {others.length > 0 && (
              <section className="grid gap-3">
                <Eyebrow className="text-muted-foreground">Other offers, outside your filters</Eyebrow>
                <ul className="grid gap-2">
                  {others.map((l, i) => (
                    <OfferRow key={i} listing={l} storeName={storeNames.get(l.store) ?? l.store} cheapest={l.in_stock && l.price === cheapest} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function OfferRow({ listing: l, storeName, cheapest }: { listing: Listing; storeName: string; cheapest: boolean }) {
  return (
    <li className={`grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 rounded-2xl bg-surface p-4 ${l.in_stock ? "" : "opacity-60"}`}>
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
        <span className="text-xl font-semibold">{formatPrice(l.price)}</span>
      </div>

      <Button asChild variant={l.in_stock ? "default" : "secondary"} size="sm" className="col-span-2 sm:col-span-1 sm:col-start-2">
        <a href={l.url} target="_blank" rel="noopener">
          {l.in_stock ? "Buy" : "View"} at {storeName} ↗
        </a>
      </Button>
    </li>
  )
}
