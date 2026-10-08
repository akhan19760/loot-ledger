import { m, useReducedMotion } from "motion/react"
import { cn } from "cn"
import { listingMatches, type Insights, type Listing, type Version } from "@lootledger/shared"
import { Eyebrow } from "@/components/ui/eyebrow"
import type { Filters } from "@/hooks/use-library-url"
import { formatPrice, versionLabel } from "@/lib/format"
import { ease } from "@/lib/motion"

interface Props {
  versions: Version[]
  insights: Insights
  /** Stores with any offer for this game, in the library's order: one column each. */
  stores: { id: string; name: string }[]
  filters: Filters
}

const capitalize = (s: string) => s[0]!.toUpperCase() + s.slice(1)

const platformLabel = (p: string | null) => p ?? "Platform unknown"


/**
 * The offers as a grid: one panel per version (platform × condition × format), one cell per
 * store in the same order in every panel, so the stores line up in columns like a table and
 * still wrap on a phone. A bar on a scale shared by every version shows where each sits.
 */
export function CompareView({ versions, insights, stores, filters }: Props) {
  const reduced = useReducedMotion()
  const matches = (v: Version) => v.offers.some((l) => listingMatches(l, filters))
  // Versions outside the filters go last, dimmed; the rest keep their order.
  const ordered = [...versions.filter(matches), ...versions.filter((v) => !matches(v))]

  const prices = versions.flatMap((v) => [...v.byStore.values()].map((l) => l.price))
  const scale = { min: Math.min(...prices), max: Math.max(...prices) }
  const nameOf = (id: string) => stores.find((s) => s.id === id)?.name ?? id

  return (
    <div className="grid gap-6">
      <Highlights insights={insights} nameOf={nameOf} />

      <section className="grid gap-2">
        <div className="flex items-end justify-between gap-4 px-4">
          <Eyebrow className="text-muted-foreground">By version</Eyebrow>
          {scale.max > scale.min && (
            <span className="text-xs text-muted-foreground tabular-nums">
              Scale {formatPrice(scale.min)} to {formatPrice(scale.max)}
            </span>
          )}
        </div>
        <ul className="grid gap-2">
          {ordered.map((v, i) => (
            <m.li
              key={v.key}
              initial={reduced ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: ease.wg, delay: Math.min(0.1 + i * 0.06, 1) }}
            >
              <VersionPanel version={v} stores={stores} scale={scale} filters={filters} dimmed={!matches(v)} nameOf={nameOf} />
            </m.li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Highlights({ insights, nameOf }: { insights: Insights; nameOf: (id: string) => string }) {
  const { cheapest, storeGap, used, olderPlatform } = insights
  const tiles = [
    cheapest && {
      label: "Lowest price",
      value: formatPrice(cheapest.listing.price),
      detail: `${versionLabel(cheapest.version)} at ${nameOf(cheapest.listing.store)}`,
    },
    storeGap && {
      label: "Shopping around",
      value: `Save ${formatPrice(storeGap.saving)}`,
      detail: `${versionLabel(storeGap.version)}: ${formatPrice(storeGap.version.best!.price)} to ${formatPrice(storeGap.version.high!)} across stores`,
    },
    used && {
      label: "Buying used",
      value: `Save ${formatPrice(used.saving)}`,
      detail: `${platformLabel(used.used.platform)} ${used.used.format}: ${formatPrice(used.used.best!.price)} used, ${formatPrice(used.newer.best!.price)} new`,
    },
    olderPlatform && {
      label: `${olderPlatform.older.platform} copy`,
      value: `Save ${formatPrice(olderPlatform.saving)}`,
      detail: `${capitalize(olderPlatform.older.condition)} ${olderPlatform.older.format}: ${formatPrice(olderPlatform.older.best!.price)} on ${olderPlatform.older.platform}, ${formatPrice(olderPlatform.newer.best!.price)} on ${olderPlatform.newer.platform}. Most ${olderPlatform.older.platform} games play on ${olderPlatform.newer.platform}`,
    },
  ].filter((t) => !!t)

  if (!tiles.length) return null
  return (
    <dl className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
      {tiles.map((t) => (
        <div key={t.label} className="grid content-start gap-2 rounded-2xl bg-surface p-4">
          <dt>
            <Eyebrow className="text-muted-foreground">{t.label}</Eyebrow>
          </dt>
          <dd className="grid gap-1">
            <span className="text-xl font-semibold text-primary-ink tabular-nums">{t.value}</span>
            <span className="text-sm text-muted-foreground">{t.detail}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

interface PanelProps {
  version: Version
  stores: { id: string; name: string }[]
  scale: { min: number; max: number }
  filters: Filters
  dimmed: boolean
  nameOf: (id: string) => string
}

function VersionPanel({ version: v, stores, scale, filters, dimmed, nameOf }: PanelProps) {
  const inStockStores = [...v.byStore.values()].filter((l) => l.in_stock)
  const summary = !v.best
    ? "Out of stock at every store right now"
    : inStockStores.length === 1
      ? `Only in stock at ${nameOf(v.best.store)}`
      : v.high! > v.best.price
        ? `${formatPrice(v.high! - v.best.price)} less than the priciest store`
        : `Same price at ${inStockStores.length} stores`

  return (
    <div className={cn("grid gap-4 rounded-2xl bg-surface p-4 transition-opacity", dimmed && "opacity-60")}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="grid gap-1">
          <h3 className="font-semibold">{versionLabel(v)}</h3>
          <p className="text-sm text-muted-foreground">
            {summary}
            {dimmed && " · outside your filters"}
          </p>
        </div>
        {v.best && (
          <p className="text-right tabular-nums">
            <span className="text-xl font-semibold text-primary-ink">{formatPrice(v.best.price)}</span>
            <span className="ml-2 text-sm text-muted-foreground">at {nameOf(v.best.store)}</span>
          </p>
        )}
      </div>

      <RangeBar version={v} scale={scale} nameOf={nameOf} />

      <ul className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
        {stores.map((s) => (
          <li key={s.id} className="grid">
            <StoreCell storeName={s.name} listing={v.byStore.get(s.id)} best={v.best} filters={filters} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Each store's price as a dot on the shared scale; the version's span is highlighted. */
function RangeBar({ version: v, scale, nameOf }: { version: Version; scale: { min: number; max: number }; nameOf: (id: string) => string }) {
  const at = (price: number) => (scale.max > scale.min ? ((price - scale.min) / (scale.max - scale.min)) * 100 : 50)
  const dots = [...v.byStore.values()].toSorted((a, b) => Number(a.in_stock) - Number(b.in_stock))

  return (
    <div aria-hidden className="relative mx-1.5 h-3">
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
      {v.best && (
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary-ink/40"
          style={{ left: `${at(v.best.price)}%`, width: `${at(v.high!) - at(v.best.price)}%` }}
        />
      )}
      {dots.map((l) => (
        <span
          key={l.store}
          title={`${nameOf(l.store)}: ${formatPrice(l.price)}${l.in_stock ? "" : " (out of stock)"}`}
          className={cn(
            "absolute top-1/2 size-2.5 -translate-1/2 rounded-full",
            !l.in_stock ? "border border-muted-foreground bg-transparent" : l === v.best ? "bg-primary glow-primary" : "bg-foreground/60",
          )}
          style={{ left: `${at(l.price)}%` }}
        />
      ))}
    </div>
  )
}

function StoreCell({ storeName, listing: l, best, filters }: { storeName: string; listing?: Listing; best: Listing | null; filters: Filters }) {
  if (!l)
    return (
      <div className="grid gap-1 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm">
        <span className="truncate text-xs text-muted-foreground">{storeName}</span>
        <span className="text-muted-foreground">Not listed</span>
      </div>
    )

  const isBest = l === best
  const extra = best && l.in_stock && !isBest ? l.price - best.price : 0
  return (
    <a
      href={l.url}
      target="_blank"
      rel="noopener"
      title={`${l.raw_title}${l.variant ? ` (${l.variant})` : ""}`}
      className={cn(
        "group/cell grid content-start gap-1 rounded-xl border border-transparent bg-surface px-3 py-2.5 text-sm transition-colors duration-300 hover:border-foreground/15 hover:bg-foreground/[0.08] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        isBest && "border-primary-ink",
        (!l.in_stock || !listingMatches(l, filters)) && "opacity-60",
      )}
    >
      <span className="truncate text-xs text-muted-foreground">{storeName}</span>
      <span className={cn("font-semibold tabular-nums transition-colors", isBest ? "text-primary-ink" : "group-hover/cell:text-primary-ink")}>
        {formatPrice(l.price)}
      </span>
      <span className={cn("text-xs tabular-nums", l.in_stock ? "text-muted-foreground" : "text-destructive")}>
        {!l.in_stock ? "Out of stock" : isBest ? "Cheapest" : extra > 0 ? `+${formatPrice(extra)}` : "Same price"}
      </span>
    </a>
  )
}
