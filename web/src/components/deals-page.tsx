import { useDeferredValue, useEffect, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ArrowDown, ArrowLeft } from "lucide-react"
import type { GameSummary } from "@lootledger/shared"
import { ChipGroup } from "@/components/filter-bar"
import { GameCard } from "@/components/game-card"
import { GameGrid } from "@/components/game-grid"
import { useGridColumns } from "@/hooks/use-grid-columns"
import { Reveal } from "@/components/motion/reveal"
import { RollText } from "@/components/motion/roll-text"
import { useScrollTo } from "@/components/motion/smooth-scroll"
import { SplitText } from "@/components/motion/split-text"
import { Button, ButtonCircle } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import type { Filters } from "@/hooks/use-library-url"
import { api } from "@/lib/api"
import { CONDITIONS, PLATFORMS } from "@/lib/filter-options"
import { formatPrice, timeAgo } from "@/lib/format"

/** Deals per list the API sends; the page shows the first rows, then the rest on request. */
const LIMIT = 36
/** Whole rows shown before "Show more", at whatever the grid's column count. */
const ROWS = 2

interface Props {
  filters: Filters
  onFiltersChange: (patch: Partial<Filters>) => void
  storeNames: Map<string, string>
  onOpenGame: (id: string) => void
  onBack: () => void
}

interface Card {
  game: GameSummary
  sticker: string
  note?: string
}

/**
 * The deals page: the biggest markdowns (a store's price against its own "was" price),
 * the biggest gaps between stores for the same version, and games newly in stock since
 * the previous refresh. Platform and condition carry over from the library.
 */
export function DealsPage({ filters, onFiltersChange, storeNames, onOpenGame, onBack }: Props) {
  const query = { platform: filters.platform, condition: filters.condition, limit: LIMIT }
  const deals = useQuery({ queryKey: ["deals", query], queryFn: () => api.deals(query), placeholderData: keepPreviousData })
  const store = (id: string) => storeNames.get(id) ?? id
  const scrollTo = useScrollTo()
  useEffect(() => {
    const previous = document.title
    document.title = "Deals · LootLedger"
    return () => void (document.title = previous)
  }, [])
  // Rendered in slices React can pause between frames, not one long task as the data lands.
  const data = useDeferredValue(deals.data)
  const updated = data?.pricesAt ? timeAgo(data.pricesAt) : null
  // Keep a platform that came in by link (e.g. PC) visible as a chip.
  const platforms = PLATFORMS.some(([v]) => v === filters.platform) ? PLATFORMS : [...PLATFORMS, [filters.platform, filters.platform] as const]

  const lists: { id: string; label: string; title: string; body: string; empty: string; cards: Card[] | undefined }[] = [
    {
      id: "discounts",
      label: "Biggest discounts",
      title: "Marked down.",
      body: "The biggest discounts: priced below what the store itself charged before, biggest percentage off first.",
      empty: "No store has marked down a game that matches these filters.",
      cards: data?.discounts.map((d) => ({ game: d.game, sticker: `−${d.pct}%`, note: `${formatPrice(d.off)} off at ${store(d.game.best.store)}` })),
    },
    {
      id: "gaps",
      label: "Biggest price gaps",
      title: "Shop around.",
      body: "The biggest price gaps: the same game, platform and condition at very different prices in two stores.",
      empty: "No game that matches these filters is sold by two stores at different prices.",
      cards: data?.gaps.map((d) => ({ game: d.game, sticker: `Save ${formatPrice(d.gap)}`, note: `${formatPrice(d.high.price)} at ${store(d.high.store)}` })),
    },
    {
      id: "restocked",
      label: "Newly in stock",
      title: "Just in.",
      body: `Newly in stock: no store had these before the last price check${updated ? `, ${updated}` : ""}. Cheapest first.`,
      empty: "Nothing that matches these filters came into stock at the last price check. Stores are checked every few hours.",
      cards: data?.restocked.map((g) => ({ game: g, sticker: "In stock", note: `At ${g.storeCount} ${g.storeCount === 1 ? "store" : "stores"} now` })),
    },
  ]

  // A short top: the first deals start on the first screen, below the title and the filters.
  return (
    <section id="deals" className="grid grid-cols-1 gap-3">
      <Reveal className="grid justify-items-start gap-5 pt-10 pb-4 md:pt-14 md:pb-8">
        <span className="label-caps text-muted-foreground">Deals</span>
        <h1 className="font-display text-[clamp(2.75rem,7.5vw,7.5rem)] leading-[0.86] uppercase">
          <SplitText text="Today's deals." stagger={0.08} />
        </h1>
        <p className="max-w-3xl text-lg text-muted-foreground md:text-xl">
          Markdowns, the biggest gaps between stores, and what just came into stock, across every store we compare.
          {updated && ` Prices checked ${updated}.`}
        </p>
      </Reveal>

      <Reveal>
        <div className="chamfer-lg flex flex-wrap items-end gap-x-8 gap-y-5 bg-surface p-5 md:p-8">
          <ChipGroup label="Platform" value={filters.platform} options={platforms} onChange={(platform) => onFiltersChange({ platform })} />
          <ChipGroup
            label="Condition"
            value={filters.condition}
            options={CONDITIONS}
            onChange={(condition) => onFiltersChange({ condition: condition as Filters["condition"] })}
          />
          {/* Phones show two rows per list, so the lists are a short scroll apart anyway */}
          <nav aria-label="The lists" className="grid gap-3 max-sm:hidden xl:ml-auto">
            <Label className="label-caps">Jump to</Label>
            <div className="flex flex-wrap gap-2">
              {lists.map((l) => (
                <Button key={l.id} variant="secondary" className="h-11" onClick={() => scrollTo(l.id)}>
                  <RollText>{l.label}</RollText>
                  {l.cards && <span className="text-muted-foreground">{l.cards.length}</span>}
                </Button>
              ))}
            </div>
          </nav>
        </div>
      </Reveal>

      {deals.isError ? (
        <Panel title="Couldn't load the deals" body={deals.error.message}>
          <Button onClick={() => deals.refetch()}>
            <RollText>Try again</RollText>
          </Button>
        </Panel>
      ) : (
        lists.map((l) => (
          <DealList key={l.id} {...l} stale={deals.isPlaceholderData} storeName={store} onOpenGame={onOpenGame} />
        ))
      )}

      <div className="flex justify-center py-10">
        <Button variant="secondary" size="lg" onClick={onBack}>
          <ArrowLeft />
          <RollText>Back to the library</RollText>
        </Button>
      </div>
    </section>
  )
}

function DealList({
  id,
  label,
  title,
  body,
  empty,
  cards,
  stale,
  storeName,
  onOpenGame,
}: {
  id: string
  label: string
  title: string
  body: string
  empty: string
  cards: Card[] | undefined
  stale: boolean
  storeName: (id: string) => string
  onOpenGame: (id: string) => void
}) {
  const [all, setAll] = useState(false)
  // Whole rows, so a list never opens on a ragged last row
  const first = useGridColumns() * ROWS
  const shown = cards && (all ? cards : cards.slice(0, first))

  return (
    <section id={id} aria-labelledby={`${id}-title`} className="grid scroll-mt-24 grid-cols-1 gap-3">
      <Reveal className="grid gap-3 pt-16 pb-6 md:pt-24 md:pb-8">
        <span className="label-caps text-muted-foreground">
          {label}
          {cards ? ` · ${cards.length}` : ""}
        </span>
        <h2 id={`${id}-title`} className="font-display text-[clamp(2.25rem,5.5vw,5.5rem)] leading-[0.86] uppercase">
          <SplitText text={title} stagger={0.08} />
        </h2>
        <p className="max-w-3xl text-muted-foreground md:text-lg">{body}</p>
      </Reveal>

      {!shown ? (
        <GameGrid>
          {Array.from({ length: first }, (_, i) => (
            <Skeleton key={i} className="aspect-[4/5]" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </GameGrid>
      ) : shown.length === 0 ? (
        <Panel title="Nothing here yet" body={empty} />
      ) : (
        <>
          {/* Faded while new filters load: the old deals stay put, plainly out of date */}
          <GameGrid className={stale ? "opacity-40 transition-opacity duration-300" : "transition-opacity duration-300"}>
            {shown.map((c, i) => (
              <GameCard
                key={c.game.id}
                game={c.game}
                index={i}
                storeName={storeName(c.game.best.store)}
                onOpen={onOpenGame}
                deal={{ sticker: c.sticker, note: c.note }}
              />
            ))}
          </GameGrid>
          {!all && cards!.length > first && (
            <div className="flex justify-center py-8">
              <Button size="lg" onClick={() => setAll(true)}>
                <RollText>{`Show more · ${cards!.length - first} left`}</RollText>
                <ButtonCircle icon={ArrowDown} />
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function Panel({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <Reveal className="grid justify-items-center gap-4 chamfer bg-surface px-6 py-16 text-center">
      <h3 className="font-display text-3xl uppercase md:text-5xl">{title}</h3>
      <p className="max-w-md text-muted-foreground">{body}</p>
      {children}
    </Reveal>
  )
}
