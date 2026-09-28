import { useCallback, useMemo, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowDown } from "lucide-react"
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { FilterBar } from "@/components/filter-bar"
import { GameCard } from "@/components/game-card"
import { GameDialog } from "@/components/game-dialog"
import { Hero } from "@/components/hero"
import { Grain } from "@/components/motion/grain"
import { IntroLoader } from "@/components/motion/intro-loader"
import { Reveal } from "@/components/motion/reveal"
import { RollText } from "@/components/motion/roll-text"
import { useScrollTo } from "@/components/motion/smooth-scroll"
import { SplitText } from "@/components/motion/split-text"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { Button, ButtonCircle } from "@/components/ui/button"
import { Eyebrow } from "@/components/ui/eyebrow"
import { Skeleton } from "@/components/ui/skeleton"
import { DEFAULT_FILTERS, useLibraryUrl } from "@/hooks/use-library-url"
import { api } from "@/lib/api"
import { ease } from "@/lib/motion"

const PAGE_SIZE = 60

export default function App() {
  const { filters, gameId, setFilters, resetFilters, setGameId } = useLibraryUrl()
  const scrollTo = useScrollTo()
  const [introDone, setIntroDone] = useState(false)
  const onIntroDone = useCallback(() => setIntroDone(true), [])

  const meta = useQuery({ queryKey: ["filters"], queryFn: api.filters, refetchInterval: 5 * 60_000 })
  // Art for the hero: games sold by the most stores tend to have the best covers.
  const covers = useQuery({
    queryKey: ["hero-covers"],
    queryFn: () => api.games({ ...DEFAULT_FILTERS, platform: "", sort: "stores", page: 1, pageSize: 24 }),
    select: (r) => r.items.filter((g) => g.image).slice(0, 6),
    staleTime: Infinity,
  })
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
      <IntroLoader ready={!meta.isPending} onDone={onIntroDone} />
      <Grain />
      <SiteHeader filters={meta.data} online={!meta.isError} introDone={introDone} />

      {/* Full width: only the 8px edge padding, matching the header's inset (WG --gap) */}
      <main className="grid grid-cols-1 gap-2 px-2 pt-[calc(var(--height-bar-mobile)+1rem)] pb-2 md:pt-[calc(var(--height-bar)+1rem)]">
        <Hero meta={meta.data} covers={covers.data ?? []} play={introDone} onBrowse={() => scrollTo("library")} onStores={() => scrollTo("stores")} />

        <section id="library" className="grid scroll-mt-24 grid-cols-1 gap-2">
          <Reveal className="grid gap-4 px-2 pt-16 pb-8 md:px-6 md:pt-28 md:pb-12">
            <Eyebrow className="text-primary">The library</Eyebrow>
            <h2 className="font-display text-[clamp(3rem,9vw,8.5rem)] leading-[0.85] uppercase">
              <SplitText text="Cheapest offer first." stagger={0.08} partClassName={(w) => (w === "first." ? "text-neon" : undefined)} />
            </h2>
          </Reveal>

          <Reveal>
            <FilterBar filters={filters} meta={meta.data} total={total} onChange={setFilters} onReset={resetFilters} />
          </Reveal>

          {games.isError ? (
            <Message title="Couldn't load games" body={games.error.message} action={<Button onClick={() => games.refetch()}><RollText>Try again</RollText></Button>} />
          ) : games.isPending ? (
            <Grid>
              {Array.from({ length: 12 }, (_, i) => (
                <Skeleton key={i} className="aspect-[4/5]" style={{ animationDelay: `${i * 80}ms` }} />
              ))}
            </Grid>
          ) : items.length === 0 ? (
            <Message
              title="No games match these filters"
              body="Try another search, or widen the platform, condition or stock filters."
              action={
                <Button variant="secondary" onClick={resetFilters}>
                  <RollText>Reset filters</RollText>
                </Button>
              }
            />
          ) : (
            <>
              <Grid className={games.isPlaceholderData ? "opacity-50 blur-[2px] transition-[opacity,filter] duration-300" : "transition-[opacity,filter] duration-300"}>
                {/* Cards that stay glide to their new place; the rest fade out and in. */}
                <AnimatePresence mode="popLayout">
                  {items.map((g, i) => (
                    <motion.div
                      key={g.id}
                      layout="position"
                      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.25 } }}
                      transition={{ layout: { duration: 0.7, ease: ease.wg } }}
                    >
                      <GameCard game={g} index={i} storeName={storeNames.get(g.best.store) ?? g.best.store} onOpen={() => setGameId(g.id)} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </Grid>
              {games.hasNextPage && (
                <div className="flex justify-center py-10">
                  <Button size="lg" onClick={() => games.fetchNextPage()} disabled={games.isFetchingNextPage}>
                    <RollText>{games.isFetchingNextPage ? "Loading…" : `Show more · ${(total ?? 0) - items.length} left`}</RollText>
                    <ButtonCircle icon={ArrowDown} />
                  </Button>
                </div>
              )}
            </>
          )}
        </section>

        {meta.data && <SiteFooter stores={meta.data.stores} />}
      </main>

      <GameDialog gameId={gameId} filters={filters} storeNames={storeNames} onClose={() => setGameId(null)} />
    </>
  )
}

function Grid({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7 ${className}`}>{children}</div>
}

function Message({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <Reveal className="grid justify-items-center gap-4 rounded-2xl border border-white/5 bg-surface px-6 py-20 text-center">
      <Eyebrow className="text-muted-foreground">Library</Eyebrow>
      <h2 className="font-display text-4xl uppercase md:text-6xl">
        <SplitText text={title} onMount stagger={0.05} />
      </h2>
      <p className="max-w-md text-muted-foreground">{body}</p>
      {action}
    </Reveal>
  )
}
