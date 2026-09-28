import { useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Download, ShoppingBag, Upload } from "lucide-react"
import type { GamesResponse } from "@ugs/shared"
import { CountUp } from "@/components/motion/count-up"
import { RollText } from "@/components/motion/roll-text"
import { Button } from "@/components/ui/button"
import { Eyebrow } from "@/components/ui/eyebrow"
import { exportShelf, importShelf, removeFromShelf, type Shelf, type ShelfList } from "@/hooks/use-shelf"
import { formatPrice } from "@/lib/format"
import { ease } from "@/lib/motion"

const COPY = {
  wishlist: { count: "On your wishlist", total: "Buy them all today" },
  collection: { count: "In your collection", total: "To buy them again today" },
} as const

const games = (n: number) => `${n} ${n === 1 ? "game" : "games"}`

interface Props {
  list: ShelfList
  shelf: Shelf
  ids: string[]
  /** The first page of the lookup; its totals cover every match. */
  data: GamesResponse | undefined
  onShowAll: () => void
  /** Wishlist only: put every game on it in the cart optimizer. */
  onPlan?: () => void
}

/**
 * Totals for the reader's wishlist or collection: how many games, how many are in stock
 * and what buying them costs today (within the filters), plus what the filters hide and
 * which games no store lists any more. Backups live here too, since the lists are per browser.
 */
export function ShelfSummary({ list, shelf, ids, data, onShowAll, onPlan }: Props) {
  const missing = data?.missing ?? []
  const hidden = data ? ids.length - missing.length - data.total : 0

  return (
    <section aria-label={COPY[list].count} className="grid gap-6 rounded-2xl border border-border/50 bg-surface p-5 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <dl className="grid grid-cols-2 gap-x-10 gap-y-6 sm:flex sm:flex-wrap">
          <Figure label={COPY[list].count} value={<CountUp value={ids.length} duration={0.6} />} />
          <Figure label="In stock now" value={data?.inStock ? <CountUp value={data.inStock.games} duration={0.6} /> : "–"} />
          <Figure
            label={COPY[list].total}
            value={data?.inStock ? <CountUp value={data.inStock.cheapestSum} duration={0.8} format={formatPrice} /> : "–"}
            neon
            className="col-span-2"
          />
        </dl>
        <div className="grid justify-items-start gap-3 sm:justify-items-end">
          {onPlan && (
            <Button size="sm" onClick={onPlan}>
              <ShoppingBag />
              <RollText>Find the cheapest way to buy them</RollText>
            </Button>
          )}
          <BackupButtons />
        </div>
      </div>

      {(hidden > 0 || missing.length > 0) && (
        <div className="grid gap-2 text-sm text-muted-foreground">
          {hidden > 0 && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {games(hidden)} hidden by your filters.
              <Button variant="link" className="h-auto p-0 text-sm" onClick={onShowAll}>
                Show all
              </Button>
            </p>
          )}
          {missing.length > 0 && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                No store lists {missing.length === 1 ? "this one" : `these ${missing.length}`} any more: {missing.map((id) => shelf[id]?.title ?? id).join(", ")}.
              </span>
              <Button variant="link" className="h-auto p-0 text-sm" onClick={() => removeFromShelf(missing)}>
                Remove {missing.length === 1 ? "it" : "them"}
              </Button>
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function Figure({ label, value, neon, className }: { label: string; value: React.ReactNode; neon?: boolean; className?: string }) {
  return (
    <div className={`grid content-start gap-2 sm:col-span-1 ${className ?? ""}`}>
      <dt>
        <Eyebrow className="text-muted-foreground">{label}</Eyebrow>
      </dt>
      <dd className={`font-display text-4xl leading-none tabular-nums md:text-5xl ${neon ? "text-primary-ink" : ""}`}>{value}</dd>
    </div>
  )
}

/** Export the lists to a file, or merge one back in (another browser, a new phone). */
export function BackupButtons() {
  const input = useRef<HTMLInputElement>(null)
  const [note, setNote] = useState<string | null>(null)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      setNote(`Imported ${games(await importShelf(file))}`)
    } catch (e) {
      setNote((e as Error).message)
    }
    if (input.current) input.current.value = ""
  }

  return (
    <div className="grid justify-items-start gap-2 sm:justify-items-end">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={exportShelf}>
          <Download />
          <RollText>Export backup</RollText>
        </Button>
        <Button variant="secondary" size="sm" onClick={() => input.current?.click()}>
          <Upload />
          <RollText>Import backup</RollText>
        </Button>
        <input ref={input} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      <AnimatePresence>
        {note && (
          <motion.p
            key={note}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: ease.wg }}
            aria-live="polite"
            className="text-xs text-muted-foreground"
          >
            {note}
          </motion.p>
        )}
      </AnimatePresence>
      <p className="text-xs text-muted-foreground">Your lists are saved in this browser only.</p>
    </div>
  )
}
