import { useMemo } from "react"
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { FilterBar } from "@/components/filter-bar"
import { GameCard } from "@/components/game-card"
import { GameDialog } from "@/components/game-dialog"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Eyebrow } from "@/components/ui/eyebrow"
import { Skeleton } from "@/components/ui/skeleton"
import { useLibraryUrl } from "@/hooks/use-library-url"
import { api } from "@/lib/api"

const PAGE_SIZE = 60

export default function App() {
  const { filters, gameId, setFilters, resetFilters, setGameId } = useLibraryUrl()

  const meta = useQuery({ queryKey: ["filters"], queryFn: api.filters, refetchInterval: 5 * 60_000 })
  const games = useInfiniteQuery({
    queryKey: ["games", filters],
    queryFn: ({ pageParam }) => api.games({ ...filters, page: pageParam, pageSize: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
    placeholderData: keepPreviousData, // keep the grid while a new filter loads
  })

  const storeNames = useMemo(() => new Map(meta.data?.stores.map((s) => [s.id, s.name])), [meta.data])
  const items = games.data?.pages.flatMap((p) => p.items) ?? []
  const total = games.data?.pages[0]?.total

  return (
    <>
      <SiteHeader filters={meta.data} online={!meta.isError} />

      <main className="mx-auto grid max-w-[1600px] grid-cols-1 gap-2 px-2 pt-[calc(var(--height-bar-mobile)+1rem)] pb-2 md:pt-[calc(var(--height-bar)+1rem)]">
        <FilterBar filters={filters} meta={meta.data} total={total} onChange={setFilters} onReset={resetFilters} />

        {games.isError ? (
          <Message title="Couldn't load games" body={games.error.message} action={<Button onClick={() => games.refetch()}>Try again</Button>} />
        ) : games.isPending ? (
          <Grid>
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} className="aspect-[4/5]" />
            ))}
          </Grid>
        ) : items.length === 0 ? (
          <Message
            title="No games match these filters"
            body="Try another search, or widen the platform, condition or stock filters."
            action={
              <Button variant="secondary" onClick={resetFilters}>
                Reset filters
              </Button>
            }
          />
        ) : (
          <>
            <Grid className={games.isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"}>
              {items.map((g) => (
                <GameCard key={g.id} game={g} storeName={storeNames.get(g.best.store) ?? g.best.store} onOpen={() => setGameId(g.id)} />
              ))}
            </Grid>
            {games.hasNextPage && (
              <div className="flex justify-center py-6">
                <Button onClick={() => games.fetchNextPage()} disabled={games.isFetchingNextPage}>
                  {games.isFetchingNextPage ? "Loading…" : `Show more (${(total ?? 0) - items.length} left)`}
                </Button>
              </div>
            )}
          </>
        )}

        {meta.data && <SiteFooter stores={meta.data.stores} />}
      </main>

      <GameDialog gameId={gameId} filters={filters} storeNames={storeNames} onClose={() => setGameId(null)} />
    </>
  )
}

function Grid({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 ${className}`}>{children}</div>
}

function Message({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <section className="grid justify-items-center gap-4 rounded-2xl bg-surface px-6 py-16 text-center">
      <Eyebrow className="text-muted-foreground">Library</Eyebrow>
      <h2 className="font-display text-4xl uppercase md:text-5xl">{title}</h2>
      <p className="max-w-md text-muted-foreground">{body}</p>
      {action}
    </section>
  )
}
