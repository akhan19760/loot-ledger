import { useEffect, useEffectEvent, useState } from "react"
import type { FiltersResponse, SortOrder } from "@ugs/shared"
import { Button } from "@/components/ui/button"
import { Eyebrow } from "@/components/ui/eyebrow"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { DEFAULT_FILTERS, type Filters } from "@/hooks/use-library-url"
import { formatCount } from "@/lib/format"

// Radix toggle/select items can't have an empty value, so "any" is spelled ALL here.
const ALL = "all"
const toUi = (v: string) => v || ALL
const fromUi = (v: string) => (v === ALL ? "" : v)

const PLATFORMS = [["PS", "PlayStation"], ["PS5", "PS5"], ["PS4", "PS4"], ["Switch", "Switch"], ["Xbox", "Xbox"], ["", "All"]] as const
const CONDITIONS = [["", "New + used"], ["new", "New"], ["used", "Used"]] as const
const KINDS = [["game", "Games"], ["hardware", "Hardware"], ["giftcard", "Gift cards"], ["", "Everything"]] as const
const SORTS: [SortOrder, string][] = [["price", "Lowest price"], ["spread", "Biggest price difference"], ["stores", "Most stores"], ["az", "A–Z"]]

interface Props {
  filters: Filters
  meta: FiltersResponse | undefined
  total: number | undefined
  onChange: (patch: Partial<Filters>) => void
  onReset: () => void
}

export function FilterBar({ filters, meta, total, onChange, onReset }: Props) {
  const q = useDebouncedSearch(filters.q, (value) => onChange({ q: value }))
  const changed = (Object.keys(DEFAULT_FILTERS) as (keyof Filters)[]).some((k) => filters[k] !== DEFAULT_FILTERS[k])
  // Keep a platform that came in by link (e.g. PC) visible as a chip.
  const platforms = PLATFORMS.some(([v]) => v === filters.platform) ? PLATFORMS : [...PLATFORMS, [filters.platform, filters.platform] as const]

  return (
    <section aria-label="Filters" className="grid grid-cols-1 gap-6 rounded-2xl bg-surface p-5 md:gap-8 md:p-8">
      <Input
        type="search"
        aria-label="Search games"
        placeholder="Search games, e.g. spider-man, fc 26, elden ring"
        autoComplete="off"
        value={q.value}
        onChange={(e) => q.set(e.target.value)}
      />

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
        <Toggle pressed={filters.inStock} onPressedChange={(inStock) => onChange({ inStock })} aria-label="In stock only">
          In stock only
        </Toggle>

        <div className="ml-auto flex items-center gap-4">
          {total !== undefined && (
            <Eyebrow className="text-muted-foreground" aria-live="polite">
              {formatCount(total)} {total === 1 ? "result" : "results"}
            </Eyebrow>
          )}
          {changed && (
            <Button variant="secondary" onClick={onReset}>
              Reset
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}

function ChipGroup({
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
        {options.map(([v, text]) => (
          <ToggleGroupItem key={toUi(v)} value={toUi(v)}>
            {text}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
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
        {options.map(([v, text]) => (
          <SelectItem key={toUi(v)} value={toUi(v)}>
            {text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
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
