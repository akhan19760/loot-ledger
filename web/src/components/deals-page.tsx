import { useEffect, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ArrowDown, ArrowLeft } from "lucide-react"
import type { GameSummary } from "@ugs/shared"
import { ChipGroup } from "@/components/filter-bar"
import { GameCard } from "@/components/game-card"
import { GameGrid } from "@/components/game-grid"
import { Reveal } from "@/components/motion/reveal"
import { RollText } from "@/components/motion/roll-text"
import { useScrollTo } from "@/components/motion/smooth-scroll"
import { SplitText } from "@/components/motion/split-text"
import { Button, ButtonCircle } from "@/components/ui/button"
import { Eyebrow } from "@/components/ui/eyebrow"
import { Skeleton } from "@/components/ui/skeleton"
import type { Filters } from "@/hooks/use-library-url"
import { api } from "@/lib/api"
import { CONDITIONS, PLATFORMS } from "@/lib/filter-options"
import { formatPrice, timeAgo } from "@/lib/format"

/** Deals per list the API sends; the page shows the first rows, then the rest on request. */
const LIMIT = 36
/** Whole rows at 2, 3, 4 and 6 columns. */
const FIRST = 12

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
  const data = deals.data
  const updated = data?.pricesAt ? timeAgo(data.pricesAt) : null
  // Keep a platform that came in by link (e.g. PC) visible as a chip.
  const platforms = PLATFORMS.some(([v]) => v === filters.platform) ? PLATFORMS : [...PLATFORMS, [filters.platform, filters.platform] as const]

  const lists: { id: string; eyebrow: string; title: string; neon: string; body: string; empty: string; cards: Card[] | undefined }[] = [
    {
      id: "discounts",
      eyebrow: "Biggest discounts",
      title: "Marked down.",
      neon: "down.",
      body: "Priced below what the store itself charged before. Biggest percentage off first.",
      empty: "No store has marked down a game that matches these filters.",
      cards: data?.discounts.map((d) => ({ game: d.game, sticker: `−${d.pct}%`, note: `${formatPrice(d.off)} off at ${store(d.game.best.store)}` })),
    },
    {
      id: "gaps",
      eyebrow: "Biggest price gaps",
      title: "Shop around.",
      neon: "around.",
      body: "The same game, platform and condition at very different prices in two stores. Biggest gap first.",
      empty: "No game that matches these filters is sold by two stores at different prices.",
      cards: data?.gaps.map((d) => ({ game: d.game, sticker: `Save ${formatPrice(d.gap)}`, note: `${formatPrice(d.high.price)} at ${store(d.high.store)}` })),
    },
    {
      id: "restocked",
      eyebrow: "Newly in stock",
      title: "Just in.",
      neon: "in.",
      body: `No store had these in stock before the last price check${updated ? `, ${updated}` : ""}. Cheapest first.`,
      empty: "Nothing that matches these filters came into stock at the last price check. Stores are checked every few hours.",
      cards: data?.restocked.map((g) => ({ game: g, sticker: "In stock", note: `At ${g.storeCount} ${g.storeCount === 1 ? "store" : "stores"} now` })),
    },
  ]

  return (
    <section id="deals" className="grid grid-cols-1 gap-2">
      <Reveal className="grid justify-items-start gap-6 px-2 pt-16 pb-8 md:px-6 md:pt-28 md:pb-12">
        <Eyebrow className="text-primary-ink">Deals{updated && ` · prices checked ${updated}`}</Eyebrow>
        <h1 className="font-display text-[clamp(3rem,9vw,8.5rem)] leading-[0.85] uppercase">
          <SplitText text="Today's deals." stagger={0.08} partClassName={(w) => (w === "deals." ? "text-neon" : undefined)} />
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground md:text-xl">
          Markdowns, the biggest gaps between stores, and what just came into stock, across every store we compare.
        </p>
        <div className="flex flex-wrap gap-2">
          {lists.map((l) => (
            <Button key={l.id} variant="secondary" size="sm" onClick={() => scrollTo(l.id)}>
              <RollText>{l.eyebrow}</RollText>
              {l.cards && <span className="text-muted-foreground tabular-nums">{l.cards.length}</span>}
            </Button>
          ))}
        </div>
      </Reveal>

      <Reveal>
        <section aria-label="Filters" className="grid grid-cols-1 gap-6 rounded-2xl border border-border/50 bg-surface p-5 md:p-8 lg:grid-cols-[auto_minmax(0,1fr)]">
          <ChipGroup label="Platform" value={filters.platform} options={platforms} onChange={(platform) => onFiltersChange({ platform })} />
          <ChipGroup
            label="Condition"
            value={filters.condition}
            options={CONDITIONS}
            onChange={(condition) => onFiltersChange({ condition: condition as Filters["condition"] })}
          />
        </section>
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
  eyebrow,
  title,
  neon,
  body,
  empty,
  cards,
  stale,
  storeName,
  onOpenGame,
}: {
  id: string
  eyebrow: string
  title: string
  neon: string
  body: string
  empty: string
  cards: Card[] | undefined
  stale: boolean
  storeName: (id: string) => string
  onOpenGame: (id: string) => void
}) {
  const [all, setAll] = useState(false)
  const shown = cards && (all ? cards : cards.slice(0, FIRST))

  return (
    <section id={id} aria-labelledby={`${id}-title`} className="grid scroll-mt-24 grid-cols-1 gap-2">
      <Reveal className="grid gap-4 px-2 pt-16 pb-6 md:px-6 md:pt-24 md:pb-8">
        <Eyebrow className="text-primary-ink">{eyebrow}</Eyebrow>
        <h2 id={`${id}-title`} className="font-display text-[clamp(2.5rem,6vw,5.5rem)] leading-[0.85] uppercase">
          <SplitText text={title} stagger={0.08} partClassName={(w) => (w === neon ? "text-neon" : undefined)} />
        </h2>
        <p className="max-w-xl text-muted-foreground">{body}</p>
      </Reveal>

      {!shown ? (
        <GameGrid>
          {Array.from({ length: FIRST }, (_, i) => (
            <Skeleton key={i} className="aspect-[4/5]" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </GameGrid>
      ) : shown.length === 0 ? (
        <Panel title="Nothing here yet" body={empty} />
      ) : (
        <>
          <GameGrid className={stale ? "opacity-50 blur-[2px] transition-[opacity,filter] duration-300" : "transition-[opacity,filter] duration-300"}>
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
          {!all && cards!.length > FIRST && (
            <div className="flex justify-center py-8">
              <Button size="lg" onClick={() => setAll(true)}>
                <RollText>{`Show more · ${cards!.length - FIRST} left`}</RollText>
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
    <Reveal className="grid justify-items-center gap-4 rounded-2xl border border-border/50 bg-surface px-6 py-16 text-center">
      <h3 className="font-display text-3xl uppercase md:text-5xl">{title}</h3>
      <p className="max-w-md text-muted-foreground">{body}</p>
      {children}
    </Reveal>
  )
}
