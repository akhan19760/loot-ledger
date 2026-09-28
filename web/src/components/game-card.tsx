import type { GameSummary } from "@ugs/shared"
import { CoverArt } from "@/components/cover-art"
import { Badge } from "@/components/ui/badge"
import { Eyebrow } from "@/components/ui/eyebrow"
import { formatPrice } from "@/lib/format"

/** INK image card: art fills the card; eyebrow, uppercase title and price sit over the bottom. */
export function GameCard({ game, storeName, onOpen }: { game: GameSummary; storeName: string; onOpen: () => void }) {
  const { best } = game
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-surface text-left outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <CoverArt src={game.image} title={game.title} className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-105" />
      <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black via-black/80 to-transparent" />
      <span className="absolute inset-0 rounded-2xl border border-transparent transition-colors group-hover:border-primary" />

      <div className="absolute inset-x-0 bottom-0 grid gap-2 p-4">
        <Eyebrow className="text-muted-foreground">
          {[best.platform, best.condition].filter(Boolean).join(" · ")}
        </Eyebrow>
        <h3 className="line-clamp-3 font-display text-2xl leading-[0.95] uppercase">{game.title}</h3>
        <div className="flex items-baseline justify-between gap-2">
          <span className={best.in_stock ? "text-xl font-semibold text-primary tabular-nums" : "text-xl font-semibold text-muted-foreground tabular-nums"}>
            {formatPrice(best.price)}
          </span>
          <span className="truncate text-xs text-muted-foreground">{storeName}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {!best.in_stock && <Badge variant="destructive">Out of stock</Badge>}
          <Badge>
            {game.storeCount} {game.storeCount === 1 ? "store" : "stores"}
          </Badge>
          {game.spread >= 100 && <Badge variant="outline">Save up to {formatPrice(game.spread)}</Badge>}
        </div>
      </div>
    </button>
  )
}
