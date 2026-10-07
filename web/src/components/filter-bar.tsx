import { AnimatePresence, motion } from "motion/react"
import { X } from "lucide-react"
import { useEffect, useEffectEvent, useId, useState } from "react"
import type { FiltersResponse, SortOrder } from "@ugs/shared"
import { CountUp } from "@/components/motion/count-up"
import { RollText } from "@/components/motion/roll-text"
import { Button } from "@/components/ui/button"
import { Eyebrow } from "@/components/ui/eyebrow"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { DEFAULT_FILTERS, type Filters, type LibraryList } from "@/hooks/use-library-url"
import { CONDITIONS, PLATFORMS } from "@/lib/filter-options"
import { ease } from "@/lib/motion"

// Radix toggle/select items can't have an empty value, so "any" is spelled ALL here.
const ALL = "all"
const toUi = (v: string) => v || ALL
const fromUi = (v: string) => (v === ALL ? "" : v)

const KINDS = [["game", "Games"], ["hardware", "Hardware"], ["giftcard", "Gift cards"], ["", "Everything"]] as const
const SORTS: [SortOrder, string][] = [["price", "Lowest price"], ["spread", "Biggest price difference"], ["stores", "Most stores"], ["az", "A–Z"]]
const EXAMPLES = ["spider-man", "fc 26", "elden ring", "god of war", "gran turismo 7"]

/** The chip highlight glides between options (one shared layout per group). */
const pillSpring = { type: "spring", bounce: 0.22, duration: 0.55 } as const

interface Props {
  filters: Filters
  meta: FiltersResponse | undefined
  total: number | undefined
  onChange: (patch: Partial<Filters>) => void
  onReset: () => void
  list: LibraryList
  /** Games on the reader's wishlist and in their collection. */
  counts: { wishlist: number; collection: number }
  onListChange: (list: LibraryList) => void
}

export function FilterBar({ filters, meta, total, onChange, onReset, list, counts, onListChange }: Props) {
  const changed = (Object.keys(DEFAULT_FILTERS) as (keyof Filters)[]).some((k) => filters[k] !== DEFAULT_FILTERS[k])
  // Keep a platform that came in by link (e.g. PC) visible as a chip.
  const platforms = PLATFORMS.some(([v]) => v === filters.platform) ? PLATFORMS : [...PLATFORMS, [filters.platform, filters.platform] as const]

  return (
    <section aria-label="Filters" className="grid grid-cols-1 gap-6 rounded-2xl border border-border/50 bg-surface p-5 md:gap-8 md:p-8">
      <ChipGroup
        label="Show"
        value={list}
        options={[
          ["all", "All games"],
          ["wishlist", `Wishlist · ${counts.wishlist}`],
          ["collection", `Collection · ${counts.collection}`],
        ]}
        // ChipGroup spells "any" as ALL ("all"), so the all-games chip comes back as "".
        onChange={(v) => onListChange((v || "all") as LibraryList)}
      />

      <SearchField committed={filters.q} onCommit={(q) => onChange({ q })} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_auto_minmax(0,1fr)]">
        <ChipGroup label="Platform" value={filters.platform} options={platforms} onChange={(platform) => onChange({ platform })} />
        <ChipGroup
          label="Condition"
          value={filters.condition}
          options={CONDITIONS}
          onChange={(condition) => onChange({ condition: condition as Filters["condition"] })}
        />
        <ChipGroup label="Type" value={filters.kind} options={KINDS} onChange={(kind) => onChange({ kind: kind as Filters["kind"] })} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="Genre"
          value={filters.genre}
          onChange={(genre) => onChange({ genre })}
          options={[["", "All genres"], ...(meta?.genres ?? []).map((g) => [g.name, `${g.name} (${g.count})`] as const)]}
        />
        <FilterSelect
          label="Store"
          value={filters.store}
          onChange={(store) => onChange({ store })}
          options={[["", "All stores"], ...(meta?.stores ?? []).map((s) => [s.id, s.name] as const)]}
        />
        <FilterSelect label="Sort" value={filters.sort} defaultValue={DEFAULT_FILTERS.sort} onChange={(sort) => onChange({ sort: sort as SortOrder })} options={SORTS} />
        <StockToggle pressed={filters.inStock} onChange={(inStock) => onChange({ inStock })} />

        <div className="ml-auto flex items-center gap-4">
          {total !== undefined && (
            <Eyebrow className="text-muted-foreground" aria-live="polite">
              <CountUp value={total} duration={0.6} /> {total === 1 ? "result" : "results"}
            </Eyebrow>
          )}
          <AnimatePresence>
            {changed && (
              <motion.div
                initial={{ opacity: 0, scale: 0.6, filter: "blur(6px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.6, filter: "blur(6px)" }}
                transition={{ duration: 0.4, ease: ease.inkRoll }}
              >
                <Button variant="secondary" onClick={onReset}>
                  <RollText>Reset</RollText>
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}

/**
 * WG underline field. A neon line draws in from the left on focus; while empty,
 * the example after "Search games, e.g." rolls to the next one (INK slide).
 */
function SearchField({ committed, onCommit }: { committed: string; onCommit: (value: string) => void }) {
  const q = useDebouncedSearch(committed, onCommit)
  const [focused, setFocused] = useState(false)
  const example = useCycle(EXAMPLES.length, 2600, !q.value)

  return (
    <div className="relative">
      <Input
        type="search"
        aria-label="Search games"
        autoComplete="off"
        value={q.value}
        onChange={(e) => q.set(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="pr-14"
      />
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left bg-primary shadow-[0_0_12px_var(--primary)] transition-transform duration-700 ease-[cubic-bezier(0.3,0,0.04,1)] light:bg-foreground light:shadow-none ${focused ? "scale-x-100" : "scale-x-0"}`}
      />

      {!q.value && (
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-4 flex gap-[0.3em] overflow-hidden text-xl leading-none tracking-[-1px] whitespace-nowrap md:text-2xl">
          <span className={focused ? "text-foreground transition-colors" : "text-muted-foreground transition-colors"}>Search games, e.g.</span>
          <span className="relative inline-flex h-[1.1em] min-w-0 overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={example}
                initial={{ y: "105%" }}
                animate={{ y: "0%" }}
                exit={{ y: "-105%" }}
                transition={{ duration: 0.7, ease: ease.wgInOut }}
                className="text-neon"
              >
                {EXAMPLES[example]}
              </motion.span>
            </AnimatePresence>
          </span>
        </span>
      )}

      <AnimatePresence>
        {q.value && (
          <motion.span
            className="absolute right-0 bottom-2.5"
            initial={{ opacity: 0, scale: 0.4, rotate: -90 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.4, rotate: 90 }}
            transition={{ duration: 0.4, ease: ease.inkRoll }}
          >
            <Button variant="round" size="icon-sm" aria-label="Clear search" onClick={() => q.set("")}>
              <X />
            </Button>
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

/** WG chips with one neon pill gliding between them, under an eyebrow label. "" is a value like any other. */
export function ChipGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: readonly (readonly [string, string])[]
  onChange: (value: string) => void
}) {
  const layoutId = useId()
  return (
    <div className="grid min-w-0 content-start gap-3">
      <Eyebrow className="text-muted-foreground">{label}</Eyebrow>
      <ToggleGroup
        type="single"
        aria-label={label}
        value={toUi(value)}
        // Radix reports "" when the pressed chip is clicked again: keep the current value.
        onValueChange={(v) => v && onChange(fromUi(v))}
      >
        {options.map(([v, text]) => {
          const on = toUi(v) === toUi(value)
          return (
            <ToggleGroupItem
              key={toUi(v)}
              value={toUi(v)}
              className="group/roll relative isolate active:scale-95 data-[state=on]:bg-transparent data-[state=on]:hover:bg-transparent light:data-[state=on]:bg-transparent light:data-[state=on]:hover:bg-transparent"
            >
              {on && (
                <motion.span
                  layoutId={layoutId}
                  transition={pillSpring}
                  className="absolute inset-0 -z-10 rounded-2xl chip-on"
                />
              )}
              <RollText>{text}</RollText>
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>
    </div>
  )
}

function StockToggle({ pressed, onChange }: { pressed: boolean; onChange: (pressed: boolean) => void }) {
  return (
    <Toggle
      pressed={pressed}
      onPressedChange={onChange}
      aria-label="In stock only"
      className="group/roll relative isolate active:scale-95 data-[state=on]:bg-transparent data-[state=on]:hover:bg-transparent light:data-[state=on]:bg-transparent light:data-[state=on]:hover:bg-transparent"
    >
      <AnimatePresence initial={false}>
        {pressed && (
          <motion.span
            key="pill"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={pillSpring}
            className="absolute inset-0 -z-10 rounded-2xl chip-on"
          />
        )}
      </AnimatePresence>
      <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
        <motion.path
          d="M3 8.5l3.2 3L13 4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: pressed ? 1 : 0, opacity: pressed ? 1 : 0.3 }}
          transition={{ duration: 0.45, ease: ease.wg }}
        />
      </svg>
      <RollText>In stock only</RollText>
    </Toggle>
  )
}

function FilterSelect({
  label,
  value,
  defaultValue = "",
  options,
  onChange,
}: {
  label: string
  value: string
  defaultValue?: string
  options: readonly (readonly [string, string])[]
  onChange: (value: string) => void
}) {
  return (
    <Select value={toUi(value)} onValueChange={(v) => onChange(fromUi(v))}>
      <SelectTrigger aria-label={label} chosen={value !== defaultValue} className="min-w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, text], i) => (
          <SelectItem key={toUi(v)} value={toUi(v)} style={{ animationDelay: `${Math.min(i, 12) * 28}ms` }}>
            {text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Index 0..n-1 that advances every `ms` while `running`. */
function useCycle(n: number, ms: number, running: boolean) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setI((x) => (x + 1) % n), ms)
    return () => clearInterval(t)
  }, [n, ms, running])
  return i
}

/** Local text for the search field, committed to the URL 250 ms after typing stops. */
function useDebouncedSearch(committed: string, commit: (value: string) => void) {
  const [value, set] = useState(committed)
  // Follow outside changes (Reset, Back button) by adjusting state during render.
  const [seen, setSeen] = useState(committed)
  if (committed !== seen) {
    setSeen(committed)
    set(committed)
  }
  const onCommit = useEffectEvent(commit)
  useEffect(() => {
    if (value === committed) return
    const t = setTimeout(() => onCommit(value), 250)
    return () => clearTimeout(t)
  }, [value, committed])
  return { value, set }
}
