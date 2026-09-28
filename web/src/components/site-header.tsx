import type { FiltersResponse } from "@ugs/shared"
import { Stat } from "@/components/ui/stat"
import { formatCount, timeAgo } from "@/lib/format"

/** WG header bar: floating 8px from the edges, blurred, status stats either side of the title. */
export function SiteHeader({ filters, online }: { filters: FiltersResponse | undefined; online: boolean }) {
  return (
    <header className="fixed inset-x-2 top-2 z-40 flex h-(--height-bar-mobile) items-center justify-between gap-4 rounded-2xl bg-neutral-800/40 px-4 backdrop-blur-[16px] md:h-(--height-bar) md:px-5">
      <div className="flex items-center gap-5">
        <Stat dot={online ? "live" : "idle"} label={online ? "Online" : "Offline"} />
        {filters && (
          <>
            <Stat className="hidden sm:flex" value={formatCount(filters.totals.games)} label="Games" />
            <Stat className="hidden sm:flex" value={formatCount(filters.totals.offers)} label="Offers" />
            <Stat className="hidden sm:flex" value={filters.stores.length} label="Stores" />
          </>
        )}
      </div>

      <h1 className="absolute left-1/2 -translate-x-1/2 font-display text-xl leading-none uppercase md:text-3xl">Game Library</h1>

      {filters?.generated && <Stat value={timeAgo(filters.generated)} label="Updated" title={new Date(filters.generated).toLocaleString()} />}
    </header>
  )
}
