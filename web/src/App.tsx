import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowDown } from "lucide-react"
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query"
import type { GamesResponse } from "@ugs/shared"
import { FilterBar } from "@/components/filter-bar"
import { GameGrid } from "@/components/game-grid"
import { Hero, type TitleEntrance } from "@/components/hero"
import { LoadingScreen } from "@/components/intro"
import { Grain } from "@/components/motion/grain"
import { Reveal } from "@/components/motion/reveal"
import { RollText } from "@/components/motion/roll-text"
import { useScrollTo } from "@/components/motion/smooth-scroll"
import { SplitText } from "@/components/motion/split-text"
import { SiteFooter } from "@/components/site-footer"
import { BackupButtons, ShelfSummary } from "@/components/shelf-summary"
import { SiteHeader } from "@/components/site-header"
import { Button, ButtonCircle } from "@/components/ui/button"
import { Eyebrow } from "@/components/ui/eyebrow"
import { Skeleton } from "@/components/ui/skeleton"
import { VirtualGameGrid } from "@/components/virtual-game-grid"
import { DEFAULT_FILTERS, useLibraryUrl, type Filters, type LibraryList, type Page } from "@/hooks/use-library-url"
import { addToCart, useCart } from "@/hooks/use-cart"
import { idsOn, useShelf } from "@/hooks/use-shelf"
import { useSoundEffects } from "@/hooks/use-sound-effects"
import { api } from "@/lib/api"
import { thumb } from "@/lib/images"

const PAGE_SIZE = 60

// Code the first screen doesn't need is loaded when it's asked for, and fetched ahead
// once the page is idle so it's usually there by then.
const loadGameDialog = () => import("@/components/game-dialog")
const loadCartDialog = () => import("@/components/cart-dialog")
const loadDealsPage = () => import("@/components/deals-page")
const GameDialog = lazy(() => loadGameDialog().then((m) => ({ default: m.GameDialog })))
const CartDialog = lazy(() => loadCartDialog().then((m) => ({ default: m.CartDialog })))
const DealsPage = lazy(() => loadDealsPage().then((m) => ({ default: m.DealsPage })))

function prefetchWhenIdle() {
  const prefetch = () => void Promise.all([loadGameDialog(), loadCartDialog(), loadDealsPage()]).catch(() => undefined)
  if (!("requestIdleCallback" in window)) {
    const t = setTimeout(prefetch, 1500)
    return () => clearTimeout(t)
  }
  const id = requestIdleCallback(prefetch, { timeout: 4000 })
  return () => cancelIdleCallback(id)
}

const withArt = (r: GamesResponse) => r.items.filter((g) => g.image)

const HEADINGS: Record<LibraryList, { text: string; neon: string }> = {
  all: { text: "Cheapest offer first.", neon: "first." },
  wishlist: { text: "Your wishlist.", neon: "wishlist." },
  collection: { text: "Your collection.", neon: "collection." },
}

const EMPTY_LIST = {
  wishlist: { title: "Your wishlist is empty", body: "Tap the heart on any game to save it here, with today's cheapest price for everything on it." },
  collection: { title: "Your collection is empty", body: "Tap the tick on any game you own to build your shelf here." },
} as const

/** Every listing filter off: what "Show all" means on a wishlist or collection. */
const SHOW_ALL: Partial<Filters> = { q: "", genre: "", store: "", platform: "", condition: "", kind: "", inStock: false }

export default function App() {
  const { page, filters, list, gameId, setFilters, resetFilters, setList, setGameId, setPage } = useLibraryUrl()
  const shelf = useShelf()
  const shelfIds = useMemo(() => (list === "all" ? null : idsOn(shelf, list)), [shelf, list])
  const counts = useMemo(() => ({ wishlist: idsOn(shelf, "wishlist").length, collection: idsOn(shelf, "collection").length }), [shelf])
  const listEmpty = shelfIds?.length === 0
  const cart = useCart()
  const [cartOpen, setCartOpen] = useState(false)
  useSoundEffects(gameId !== null || cartOpen)
  const wishlist = useMemo(() => idsOn(shelf, "wishlist").map((id) => ({ id, title: shelf[id]!.title, image: shelf[id]!.image })), [shelf])
  // Games added to the cart accept what the library is filtered to (platform, condition).
  const cartWant = { platform: filters.platform || null, condition: filters.condition || null, format: null }
  const openCart = () => {
    if (gameId) setGameId(null)
    setCartOpen(true)
  }
  const scrollTo = useScrollTo()
  // A new page starts at its top, or at the section asked for.
  const landing = useRef<string | 0>(0)
  const navigate = useCallback(
    (next: Page, section?: string) => {
      landing.current = section ?? 0
      setPage(next)
    },
    [setPage],
  )
  const shownPage = useRef(page)
  useEffect(() => {
    if (shownPage.current === page) return
    shownPage.current = page
    scrollTo(landing.current, { instant: true })
    landing.current = 0
  }, [page, scrollTo])
  const [introDone, setIntroDone] = useState(false)
  const onIntroDone = useCallback(() => setIntroDone(true), [])
  // The loading screen can fly its letters into the hero's title (loading-screen.tsx).
  const [titleEntrance, setTitleEntrance] = useState<TitleEntrance>("slide")
  useEffect(() => (introDone ? prefetchWhenIdle() : undefined), [introDone])
  // The dialogs load on first use and then stay mounted, so they can animate closed.
  const [dialogUsed, setDialogUsed] = useState(gameId !== null)
  if (gameId && !dialogUsed) setDialogUsed(true)
  const [cartUsed, setCartUsed] = useState(false)
  if (cartOpen && !cartUsed) setCartUsed(true)

  const meta = useQuery({ queryKey: ["filters"], queryFn: api.filters, refetchInterval: 5 * 60_000 })
  // Art for the hero: games sold by the most stores tend to have the best covers.
  const covers = useQuery({
    queryKey: ["hero-covers"],
    queryFn: () => api.games({ ...DEFAULT_FILTERS, platform: "", sort: "stores", page: 1, pageSize: 24 }),
    select: withArt,
    staleTime: Infinity,
  })
  const heroCovers = useMemo(() => covers.data?.slice(0, 6) ?? [], [covers.data])
  // The same 400px copies the hero shows, so the loading screen's preload is what the hero reuses.
  const heroArt = useMemo(() => heroCovers.map((g) => thumb(g.image!, 400)), [heroCovers])
  const games = useInfiniteQuery({
    queryKey: ["games", filters, shelfIds],
    queryFn: ({ pageParam }) => {
      const query = { ...filters, page: pageParam, pageSize: PAGE_SIZE }
      return shelfIds ? api.lookup({ ...query, ids: shelfIds }) : api.games(query)
    },
    enabled: !listEmpty,
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
    placeholderData: keepPreviousData, // keep the grid while a new filter loads
  })

  const storeNames = useMemo(() => new Map(meta.data?.stores.map((s) => [s.id, s.name])), [meta.data])
  const items = useMemo(() => games.data?.pages.flatMap((p) => p.items) ?? [], [games.data])
  const total = games.data?.pages[0]?.total

  return (
    <>
      <LoadingScreen
        meta={meta.data}
        metaFailed={meta.isError}
        matches={listEmpty ? 0 : games.data?.pages[0]?.total}
        matchesFailed={games.isError}
        art={covers.data ? heroArt : undefined}
        artFailed={covers.isError}
        onDone={onIntroDone}
        onTitle={setTitleEntrance}
      />
      <Grain />
      <SiteHeader
        filters={meta.data}
        online={!meta.isError}
        introDone={introDone}
        cartCount={cart.items.length}
        onOpenCart={openCart}
        page={page}
        onNavigate={navigate}
      />

      {/* Full width: only the 8px edge padding, matching the header's inset (WG --gap) */}
      {/* inert until the loading screen has gone, so focus can't wander behind it */}
      <main inert={!introDone} className="grid grid-cols-1 gap-2 px-2 pt-[calc(var(--height-bar-mobile)+1rem)] pb-2 md:pt-[calc(var(--height-bar)+1rem)]">
        {page === "deals" ? (
          <Suspense fallback={<div className="min-h-svh" />}>
            <DealsPage filters={filters} onFiltersChange={setFilters} storeNames={storeNames} onOpenGame={setGameId} onBack={() => navigate("library", "library")} />
          </Suspense>
        ) : (
          <>
            <Hero
              meta={meta.data}
              covers={heroCovers}
              play={introDone}
              title={titleEntrance}
              onBrowse={() => scrollTo("library")}
              onStores={() => scrollTo("stores")}
              onDeals={() => navigate("deals")}
            />

            <section id="library" className="grid scroll-mt-24 grid-cols-1 gap-2">
              <Reveal className="grid gap-4 px-2 pt-16 pb-8 md:px-6 md:pt-28 md:pb-12">
                <Eyebrow className="text-primary-ink">The library</Eyebrow>
                <h2 className="font-display text-[clamp(3rem,9vw,8.5rem)] leading-[0.85] uppercase">
                  <SplitText
                    key={list}
                    text={HEADINGS[list].text}
                    stagger={0.08}
                    partClassName={(w) => (w === HEADINGS[list].neon ? "text-neon" : undefined)}
                  />
                </h2>
              </Reveal>

              <Reveal>
                <FilterBar
                  filters={filters}
                  meta={meta.data}
                  total={listEmpty ? 0 : total}
                  onChange={setFilters}
                  onReset={resetFilters}
                  list={list}
                  counts={counts}
                  onListChange={setList}
                />
              </Reveal>

              {list !== "all" && shelfIds && !listEmpty && (
                <ShelfSummary
                  list={list}
                  shelf={shelf}
                  ids={shelfIds}
                  data={games.data?.pages[0]}
                  onShowAll={() => setFilters(SHOW_ALL)}
                  onPlan={
                    list === "wishlist"
                      ? () => {
                          addToCart(wishlist, cartWant)
                          openCart()
                        }
                      : undefined
                  }
                />
              )}

              {list !== "all" && listEmpty ? (
                <Message
                  title={EMPTY_LIST[list].title}
                  body={EMPTY_LIST[list].body}
                  action={
                    <div className="grid justify-items-center gap-4">
                      <Button onClick={() => setList("all")}>
                        <RollText>Browse all games</RollText>
                      </Button>
                      <BackupButtons />
                    </div>
                  }
                />
              ) : games.isError ? (
                <Message title="Couldn't load games" body={games.error.message} action={<Button onClick={() => games.refetch()}><RollText>Try again</RollText></Button>} />
              ) : games.isPending ? (
                <GameGrid>
                  {Array.from({ length: 12 }, (_, i) => (
                    <Skeleton key={i} className="aspect-[4/5]" style={{ animationDelay: `${i * 80}ms` }} />
                  ))}
                </GameGrid>
              ) : items.length === 0 ? (
                <Message
                  title="No games match these filters"
                  body="Try another search, or widen the platform, condition or stock filters."
                  action={
                    <Button variant="secondary" onClick={list === "all" ? resetFilters : () => setFilters(SHOW_ALL)}>
                      <RollText>{list === "all" ? "Reset filters" : "Show all"}</RollText>
                    </Button>
                  }
                />
              ) : (
                <>
                  <VirtualGameGrid
                    games={items}
                    storeNames={storeNames}
                    onOpen={setGameId}
                    className={games.isPlaceholderData ? "opacity-50 blur-[2px] transition-[opacity,filter] duration-300" : "transition-[opacity,filter] duration-300"}
                  />
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
          </>
        )}

        {meta.data && <SiteFooter stores={meta.data.stores} />}
      </main>

      <Suspense fallback={null}>
        {dialogUsed && <GameDialog gameId={gameId} filters={filters} storeNames={storeNames} onClose={() => setGameId(null)} onOpenCart={openCart} />}
        {cartUsed && <CartDialog open={cartOpen} onOpenChange={setCartOpen} stores={meta.data?.stores} wishlist={wishlist} defaultWant={cartWant} />}
      </Suspense>
    </>
  )
}

function Message({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <Reveal className="grid justify-items-center gap-4 rounded-2xl border border-border/50 bg-surface px-6 py-20 text-center">
      <Eyebrow className="text-muted-foreground">Library</Eyebrow>
      <h2 className="font-display text-4xl uppercase md:text-6xl">
        <SplitText text={title} onMount stagger={0.05} />
      </h2>
      <p className="max-w-md text-muted-foreground">{body}</p>
      {action}
    </Reveal>
  )
}
