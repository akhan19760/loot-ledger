import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { ArrowDown } from "lucide-react"
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query"
import type { GamesResponse } from "@lootledger/shared"
import { Achievements } from "@/components/achievements"
import { BonusRound } from "@/components/bonus-round"
import { FilterBar } from "@/components/filter-bar"
import { GameGrid } from "@/components/game-grid"
import { HERO_COVER_WIDTH, Hero, type TitleEntrance } from "@/components/hero"
import { LoadingScreen } from "@/components/intro"
import { Reveal } from "@/components/motion/reveal"
import { RollText } from "@/components/motion/roll-text"
import { useScrollTo } from "@/components/motion/smooth-scroll"
import { SplitText } from "@/components/motion/split-text"
import { SiteFooter } from "@/components/site-footer"
import { BackupButtons, ShelfSummary } from "@/components/shelf-summary"
import { ShelfView } from "@/components/shelf-view"
import { SiteHeader } from "@/components/site-header"
import { Button, ButtonCircle } from "@/components/ui/button"
import { PillToggle } from "@/components/ui/pill-toggle"
import { Skeleton } from "@/components/ui/skeleton"
import { Versus } from "@/components/versus"
import { VirtualGameGrid } from "@/components/virtual-game-grid"
import { countGameOpened } from "@/hooks/use-achievements"
import { DEFAULT_FILTERS, gameOpen, useGameId, useLibraryUrl, type Filters, type LibraryList, type Page } from "@/hooks/use-library-url"
import { useLibraryView, type LibraryView } from "@/hooks/use-library-view"
import { addToCart, useCart } from "@/hooks/use-cart"
import { idsOn, useShelf } from "@/hooks/use-shelf"
import { useDialogSound, useSoundEffects } from "@/hooks/use-sound-effects"
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
const NO_GAMES: GamesResponse["items"] = []

const HEADINGS: Record<LibraryList, string> = {
  all: "Every game. Cheapest first.",
  wishlist: "Your wishlist.",
  collection: "Your collection.",
}

const VIEWS: readonly (readonly [LibraryView, string])[] = [
  ["shelf", "Shelf"],
  ["grid", "Grid"],
]

const EMPTY_LIST = {
  wishlist: { title: "Your wishlist is empty", body: "Tap the heart on any game to save it here, with today's cheapest price for everything on it." },
  collection: { title: "Your collection is empty", body: "Tap the tick on any game you own to build your shelf here." },
} as const

/** Every listing filter off: what "Show all" means on a wishlist or collection. */
const SHOW_ALL: Partial<Filters> = { q: "", genre: "", store: "", platform: "", condition: "", kind: "", inStock: false }

export default function App() {
  const { page, filters, list, setFilters, resetFilters, setList, setGameId, setPage } = useLibraryUrl()
  const shelf = useShelf()
  const shelfIds = useMemo(() => (list === "all" ? null : idsOn(shelf, list)), [shelf, list])
  const counts = useMemo(() => ({ wishlist: idsOn(shelf, "wishlist").length, collection: idsOn(shelf, "collection").length }), [shelf])
  const listEmpty = shelfIds?.length === 0
  const cart = useCart()
  const [cartOpen, setCartOpen] = useState(false)
  const [view, setView] = useLibraryView()
  useSoundEffects()
  useDialogSound("cart", cartOpen)
  const wishlist = useMemo(() => idsOn(shelf, "wishlist").map((id) => ({ id, title: shelf[id]!.title, image: shelf[id]!.image })), [shelf])
  // Games added to the cart accept what the library is filtered to (platform, condition).
  const cartWant = { platform: filters.platform || null, condition: filters.condition || null, format: null }
  const openCart = () => {
    if (gameOpen()) setGameId(null)
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
  // The hero's first two covers, at the size it shows them: the loading screen preloads them.
  const heroArt = useMemo(() => (covers.data ?? []).slice(0, 2).map((g) => thumb(g.image!, HERO_COVER_WIDTH)), [covers.data])
  // The face-offs (today's biggest gaps), narrowed like the library; the deals page shares the fetch.
  const dealsQuery = { platform: filters.platform, condition: filters.condition, limit: 36 }
  const deals = useQuery({ queryKey: ["deals", dealsQuery], queryFn: () => api.deals(dealsQuery), placeholderData: keepPreviousData, enabled: page === "library" })
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
  // The cards and the hero's art render a moment after their data, in slices React can
  // pause between frames, rather than in one long task as the data lands.
  const shownItems = useDeferredValue(items)
  const shownCovers = useDeferredValue(covers.data ?? NO_GAMES)
  // The hero's search button: to the library's field, cursor in it (the one showing at this width).
  const goSearch = () => {
    scrollTo("search")
    const field = [...document.querySelectorAll<HTMLInputElement>("#search input[type=search]")].find((i) => i.offsetParent)
    field?.focus({ preventScroll: true })
  }
  const total = games.data?.pages[0]?.total
  const fading = games.isPlaceholderData ? "opacity-40 transition-opacity duration-300" : "transition-opacity duration-300"

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
      <SiteHeader
        filters={meta.data}
        online={!meta.isError}
        introDone={introDone}
        cartCount={cart.items.length}
        onOpenCart={openCart}
        page={page}
        onNavigate={navigate}
        onList={setList}
        counts={counts}
      />

      {/* inert until the loading screen has gone, so focus can't wander behind it */}
      <main inert={!introDone} className="grid grid-cols-1">
        {page === "deals" ? (
          <div className="px-4 pt-[calc(var(--height-bar-mobile)+1rem)] pb-24 md:px-8 md:pt-[calc(var(--height-bar)+1rem)]">
            <Suspense fallback={<div className="min-h-svh" />}>
              <DealsPage filters={filters} onFiltersChange={setFilters} storeNames={storeNames} onOpenGame={setGameId} onBack={() => navigate("library", "library")} />
            </Suspense>
          </div>
        ) : (
          <>
            <Hero
              meta={meta.data}
              covers={shownCovers}
              storeNames={storeNames}
              play={introDone}
              title={titleEntrance}
              onOpen={setGameId}
              onSearch={goSearch}
            />

            <Versus deals={deals.data} storeNames={storeNames} onOpen={setGameId} onAllDeals={() => navigate("deals")} />

            <BonusRound games={shownCovers} storeNames={storeNames} />

            <section id="library" aria-labelledby="library-title" className="grid scroll-mt-24 grid-cols-1 gap-6 px-4 pt-16 pb-24 md:gap-8 md:px-8 md:pt-28">
              <Reveal className="grid gap-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <span className="label-caps text-muted-foreground">
                    The library{total !== undefined && !listEmpty ? ` · ${total.toLocaleString("en-PK")} ${total === 1 ? "game" : "games"}` : ""}
                  </span>
                  <PillToggle label="Layout" value={view} options={VIEWS} onChange={setView} />
                </div>
                <h2 id="library-title" className="font-display text-[clamp(2.4rem,6.6vw,6.75rem)] leading-[0.88] uppercase text-balance">
                  <SplitText key={list} text={HEADINGS[list]} stagger={0.07} />
                </h2>
              </Reveal>

              {/* The hero's search lands here, on the query and the results under it. A fade
                  only: a block still rising when the page arrives would land it off target. */}
              <Reveal id="search" y={0} className="scroll-mt-24">
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
                  {view === "shelf" ? (
                    <ShelfView games={shownItems} storeNames={storeNames} onOpen={setGameId} className={fading} />
                  ) : (
                    // Faded while a new filter loads: the old results stay put, plainly out of date
                    <VirtualGameGrid games={shownItems} storeNames={storeNames} onOpen={setGameId} className={fading} />
                  )}
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

        {meta.data && <SiteFooter meta={meta.data} onTitle={() => (page === "library" ? scrollTo(0) : navigate("library"))} />}
      </main>

      <Achievements />
      <Suspense fallback={null}>
        <GameDialogHost filters={filters} storeNames={storeNames} onOpenCart={openCart} />
        {cartUsed && <CartDialog open={cartOpen} onOpenChange={setCartOpen} stores={meta.data?.stores} wishlist={wishlist} defaultWant={cartWant} />}
      </Suspense>
    </>
  )
}

/**
 * The game dialog, the one part of the page that follows ?game: opening or closing a game
 * re-renders this, not the library behind it. Loads on first use, then stays mounted so
 * it can animate closed.
 */
function GameDialogHost({ filters, storeNames, onOpenCart }: { filters: Filters; storeNames: Map<string, string>; onOpenCart: () => void }) {
  const gameId = useGameId()
  const { setGameId } = useLibraryUrl()
  useDialogSound("game", gameId !== null)
  useEffect(() => {
    if (gameId) countGameOpened(gameId)
  }, [gameId])
  const [used, setUsed] = useState(gameId !== null)
  if (gameId && !used) setUsed(true)
  return used ? <GameDialog gameId={gameId} filters={filters} storeNames={storeNames} onClose={() => setGameId(null)} onOpenCart={onOpenCart} /> : null
}

function Message({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <Reveal className="chamfer-lg grid justify-items-center gap-4 bg-surface px-6 py-20 text-center">
      <h2 className="font-display text-3xl uppercase md:text-5xl">
        <SplitText text={title} onMount stagger={0.05} />
      </h2>
      <p className="max-w-md text-muted-foreground">{body}</p>
      {action}
    </Reveal>
  )
}
