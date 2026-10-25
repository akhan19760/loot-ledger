import { AnimatePresence, m } from "motion/react"
import { Search, SlidersHorizontal, X } from "lucide-react"
import { useEffect, useEffectEvent, useId, useState } from "react"
import { cn } from "cn"
import type { FiltersResponse, SortOrder } from "@lootledger/shared"
import { CountUp } from "@/components/motion/count-up"
import { RollText } from "@/components/motion/roll-text"
import { useScrollLock } from "@/components/motion/smooth-scroll"
import { Button } from "@/components/ui/button"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import { DrawerContent } from "@/components/ui/drawer"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { DEFAULT_FILTERS, type Filters, type LibraryList } from "@/hooks/use-library-url"
import { CONDITIONS, PLATFORMS } from "@/lib/filter-options"
import { ease } from "@/lib/motion"
import { play } from "@/lib/sfx"

// Radix toggle/select items can't have an empty value, so "any" is spelled ALL here.
const ALL = "all"
const toUi = (v: string) => v || ALL
const fromUi = (v: string) => (v === ALL ? "" : v)

const KINDS = [["game", "Games"], ["hardware", "Hardware"], ["giftcard", "Gift cards"], ["", "Everything"]] as const
const SORTS: [SortOrder, string][] = [["price", "Lowest price"], ["spread", "Biggest price difference"], ["stores", "Most stores"], ["az", "A–Z"]]
const EXAMPLES = ["spider-man", "fc 26", "elden ring", "god of war", "gran turismo 7"]

/** The chip highlight glides between options (one shared layout per group), without a bounce. */
const pillSpring = { type: "spring", bounce: 0, duration: 0.6 } as const

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

  return (
    <>
      {/* Phones: just the search, with the filters a tap away in a drawer, so the games
          aren't a long scroll down */}
      <section aria-label="Search and filters" className="chamfer flex items-center gap-2 bg-surface p-2 md:hidden">
        <SearchField committed={filters.q} onCommit={(q) => onChange({ q })} lead="Search, e.g." className="min-w-0 flex-1" />
        <FilterDrawer filters={filters} meta={meta} list={list} counts={counts} onChange={onChange} onListChange={onListChange} />
      </section>

      <section aria-label="Filters" className="chamfer-lg hidden grid-cols-1 gap-8 bg-surface p-8 md:grid">
        <ListChips list={list} counts={counts} onChange={onListChange} />

        <SearchField committed={filters.q} onCommit={(q) => onChange({ q })} />

        <ChipFilters filters={filters} onChange={onChange} className="lg:grid-cols-[auto_auto_minmax(0,1fr)]" />

        <div className="flex flex-wrap items-center gap-2">
          <SelectFilters filters={filters} meta={meta} onChange={onChange} />

          <div className="ml-auto flex items-center gap-4">
            {total !== undefined && (
              <Label className="text-sm" aria-live="polite">
                <CountUp value={total} duration={0.6} /> {total === 1 ? "result" : "results"}
              </Label>
            )}
            <AnimatePresence>
              {changed && (
                <m.div
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.4, ease: ease.cine }}
                >
                  <Button variant="secondary" onClick={onReset}>
                    <RollText>Reset</RollText>
                  </Button>
                </m.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>
    </>
  )
}

/** Filters set apart from the defaults (search aside: it stays on show), plus a wishlist or collection view. */
function activeCount(filters: Filters, list: LibraryList) {
  const keys = (Object.keys(DEFAULT_FILTERS) as (keyof Filters)[]).filter((k) => k !== "q" && filters[k] !== DEFAULT_FILTERS[k])
  return keys.length + (list === "all" ? 0 : 1)
}

/**
 * Phones' filters: a button beside the search (its chip counts the filters in use) that
 * opens a drawer from the bottom. Choices there are a draft until "Show results" applies
 * them and closes it; closing it any other way (X, outside, Esc) leaves things as they were.
 */
function FilterDrawer({
  filters,
  meta,
  list,
  counts,
  onChange,
  onListChange,
}: Pick<Props, "filters" | "meta" | "list" | "counts" | "onChange" | "onListChange">) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({ filters, list })
  useScrollLock(open)
  const active = activeCount(filters, list)

  const toggle = (next: boolean) => {
    if (next) setDraft({ filters, list }) // start from what's showing
    setOpen(next)
    play(next ? "open" : "close")
  }
  const apply = () => {
    onChange({ ...draft.filters, q: filters.q })
    onListChange(draft.list)
    toggle(false)
  }
  const patch = (p: Partial<Filters>) => setDraft((d) => ({ ...d, filters: { ...d.filters, ...p } }))
  const draftActive = activeCount(draft.filters, draft.list)

  return (
    <Dialog open={open} onOpenChange={toggle}>
      <DialogTrigger asChild>
        <Button variant="round" size="icon" aria-label={active ? `Filters, ${active} in use` : "Filters"} className="relative">
          <SlidersHorizontal className="size-5" />
          <AnimatePresence>
            {active > 0 && (
              <m.span
                key={active}
                initial={{ scale: 0.4 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ duration: 0.4, ease: ease.cine }}
                className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center bg-primary px-1 text-[10px] font-bold text-ink tabular-nums"
              >
                {active}
              </m.span>
            )}
          </AnimatePresence>
        </Button>
      </DialogTrigger>
      <DrawerContent
        title="Filters"
        footer={
          <>
            <Button
              variant="secondary"
              disabled={draftActive === 0}
              onClick={() => setDraft({ filters: { ...DEFAULT_FILTERS, q: filters.q }, list: "all" })}
            >
              <RollText>Reset</RollText>
            </Button>
            <Button className="flex-1" onClick={apply}>
              <RollText>Show results</RollText>
            </Button>
          </>
        }
      >
        <ListChips list={draft.list} counts={counts} onChange={(l) => setDraft((d) => ({ ...d, list: l }))} />
        <ChipFilters filters={draft.filters} onChange={patch} />
        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
          <SelectFilters filters={draft.filters} meta={meta} onChange={patch} fill />
        </div>
      </DrawerContent>
    </Dialog>
  )
}

/** All games, or just the wishlist or collection. */
function ListChips({ list, counts, onChange }: { list: LibraryList; counts: Props["counts"]; onChange: (list: LibraryList) => void }) {
  return (
    <ChipGroup
      label="Show"
      value={list}
      options={[
        ["all", "All games"],
        ["wishlist", `Wishlist · ${counts.wishlist}`],
        ["collection", `Collection · ${counts.collection}`],
      ]}
      // ChipGroup spells "any" as ALL ("all"), so the all-games chip comes back as "".
      onChange={(v) => onChange((v || "all") as LibraryList)}
    />
  )
}

function ChipFilters({ filters, onChange, className }: { filters: Filters; onChange: Props["onChange"]; className?: string }) {
  // Keep a platform that came in by link (e.g. PC) visible as a chip.
  const platforms = PLATFORMS.some(([v]) => v === filters.platform) ? PLATFORMS : [...PLATFORMS, [filters.platform, filters.platform] as const]
  return (
    <div className={`grid grid-cols-1 gap-6 ${className ?? ""}`}>
      <ChipGroup label="Platform" value={filters.platform} options={platforms} onChange={(platform) => onChange({ platform })} />
      <ChipGroup
        label="Condition"
        value={filters.condition}
        options={CONDITIONS}
        onChange={(condition) => onChange({ condition: condition as Filters["condition"] })}
      />
      <ChipGroup label="Type" value={filters.kind} options={KINDS} onChange={(kind) => onChange({ kind: kind as Filters["kind"] })} />
    </div>
  )
}

/** Genre, store and sort, and In stock only. `fill` stretches each to its cell (the drawer's grid). */
function SelectFilters({ filters, meta, onChange, fill = false }: { filters: Filters; meta: Props["meta"]; onChange: Props["onChange"]; fill?: boolean }) {
  const width = fill ? "w-full" : undefined
  return (
    <>
      <FilterSelect
        label="Genre"
        value={filters.genre}
        onChange={(genre) => onChange({ genre })}
        options={[["", "All genres"], ...(meta?.genres ?? []).map((g) => [g.name, `${g.name} (${g.count})`] as const)]}
        className={width}
      />
      <FilterSelect
        label="Store"
        value={filters.store}
        onChange={(store) => onChange({ store })}
        options={[["", "All stores"], ...(meta?.stores ?? []).map((s) => [s.id, s.name] as const)]}
        className={width}
      />
      <FilterSelect
        label="Sort"
        value={filters.sort}
        defaultValue={DEFAULT_FILTERS.sort}
        onChange={(sort) => onChange({ sort: sort as SortOrder })}
        options={SORTS}
        className={width}
      />
      <StockToggle pressed={filters.inStock} onChange={(inStock) => onChange({ inStock })} className={fill ? "justify-self-start" : undefined} />
    </>
  )
}

/**
 * Chamfered search field: a magnifier, the text, and a clear button that turns in. A lime
 * bar runs along its foot on focus; while empty, the example after "Search games, e.g."
 * rolls to the next one (INK slide). `lg` is the hero's; `action` sits at its end.
 */
export function SearchField({
  committed,
  onCommit,
  lead = "Search games, e.g.",
  size = "default",
  action,
  className,
}: {
  committed: string
  onCommit: (value: string) => void
  lead?: string
  size?: "default" | "lg"
  /** A button at the field's end, e.g. the hero's submit. */
  action?: React.ReactNode
  className?: string
}) {
  const q = useDebouncedSearch(committed, onCommit)
  const [focused, setFocused] = useState(false)
  const example = useCycle(EXAMPLES.length, 2600, !q.value)
  const text = size === "lg" ? "text-base md:text-xl" : "text-base md:text-lg"

  return (
    <div
      className={cn(
        "chamfer relative flex items-center gap-3 bg-secondary pr-1.5 pl-4 shadow-[inset_0_-2px_0_transparent] transition-shadow duration-300 focus-within:shadow-[inset_0_-3px_0_var(--primary-ink)] md:pl-5",
        size === "lg" ? "h-14 md:h-16 md:pr-2" : "h-12 md:h-14",
        className,
      )}
    >
      <Search aria-hidden className={`size-5 shrink-0 transition-colors ${focused ? "text-foreground" : "text-muted-foreground"}`} />
      <div className="relative min-w-0 flex-1 self-stretch">
        <input
          type="search"
          aria-label="Search games"
          autoComplete="off"
          enterKeyHint="search"
          value={q.value}
          onChange={(e) => q.set(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={`size-full bg-transparent text-foreground outline-none [&::-webkit-search-cancel-button]:hidden ${text}`}
        />
        {!q.value && (
          <span aria-hidden className={`pointer-events-none absolute inset-0 flex items-center gap-[0.3em] overflow-hidden whitespace-nowrap ${text}`}>
            <span className="text-muted-foreground">{lead}</span>
            <span className="relative inline-flex h-[1.3em] min-w-0 items-center overflow-hidden">
              <AnimatePresence mode="popLayout" initial={false}>
                <m.span
                  key={example}
                  initial={{ y: "105%" }}
                  animate={{ y: "0%" }}
                  exit={{ y: "-105%" }}
                  transition={{ duration: 0.7, ease: ease.wgInOut }}
                  className="text-foreground"
                >
                  {EXAMPLES[example]}
                </m.span>
              </AnimatePresence>
            </span>
          </span>
        )}
      </div>

      <AnimatePresence>
        {q.value && (
          <m.span
            className="shrink-0"
            initial={{ opacity: 0, scale: 0.6, rotate: -45 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.6, rotate: 45 }}
            transition={{ duration: 0.4, ease: ease.cine }}
          >
            {/* type="button": inside the hero's form it must clear, not submit */}
            <Button type="button" variant="round" size="icon-sm" aria-label="Clear search" onClick={() => q.set("")}>
              <X />
            </Button>
          </m.span>
        )}
      </AnimatePresence>
      {action}
    </div>
  )
}

/** Chips with one lime block gliding between them, under a small label. "" is a value like any other. */
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
      <Label className="label-caps">{label}</Label>
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
              className="group/roll relative isolate active:scale-95 data-[state=on]:bg-transparent data-[state=on]:hover:bg-transparent"
            >
              {on && (
                <m.span
                  layoutId={layoutId}
                  transition={pillSpring}
                  className="chamfer-sm absolute inset-0 -z-10 bg-primary"
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

function StockToggle({ pressed, onChange, className }: { pressed: boolean; onChange: (pressed: boolean) => void; className?: string }) {
  return (
    <Toggle
      pressed={pressed}
      onPressedChange={onChange}
      aria-label="In stock only"
      className={`${className ?? ""} group/roll relative isolate active:scale-95 data-[state=on]:bg-transparent data-[state=on]:hover:bg-transparent`}
    >
      <AnimatePresence initial={false}>
        {pressed && (
          <m.span
            key="pill"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={pillSpring}
            className="chamfer-sm absolute inset-0 -z-10 bg-primary"
          />
        )}
      </AnimatePresence>
      <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
        <m.path
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
  className,
}: {
  label: string
  value: string
  defaultValue?: string
  options: readonly (readonly [string, string])[]
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <Select value={toUi(value)} onValueChange={(v) => onChange(fromUi(v))}>
      <SelectTrigger aria-label={label} chosen={value !== defaultValue} className={`min-w-40 ${className ?? ""}`}>
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
