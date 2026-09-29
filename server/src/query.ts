// Search, filter, sort and paginate the library. Same rules the old
// site/index.html applied in the browser (compute / offersFor).
import {
  byStockThenPrice,
  listingMatches,
  normalizeSearch,
  PLATFORM_FILTERS,
  type FiltersResponse,
  type Game,
  type GameSummary,
  type GamesLookup,
  type GamesQuery,
  type GamesResponse,
  type Listing,
  type SortOrder,
} from "@ugs/shared";
import type { LibrarySnapshot } from "./library.ts";

const SORTS: Record<SortOrder, (a: GameSummary, b: GameSummary) => number> = {
  price: (a, b) => Number(b.best.in_stock) - Number(a.best.in_stock) || a.best.price - b.best.price,
  spread: (a, b) => b.spread - a.spread,
  stores: (a, b) => b.storeCount - a.storeCount || a.best.price - b.best.price,
  az: (a, b) => a.title.localeCompare(b.title),
};

/** What a grid card shows of a game, from the offers that match the filters (at least one). */
export function summarize(g: Game, offers: Listing[], best = offers.toSorted(byStockThenPrice)[0]!): GameSummary {
  const inStock = offers.filter((o) => o.in_stock).map((o) => o.price);
  return {
    id: g.id,
    title: g.title,
    kind: g.kind,
    genres: g.genres,
    image: g.image,
    best,
    offerCount: offers.length,
    storeCount: new Set(offers.map((o) => o.store)).size,
    spread: inStock.length > 1 ? Math.max(...inStock) - Math.min(...inStock) : 0,
  };
}

/** A lookup (with `ids`) only searches those games, and also reports missing ids and in-stock totals. */
export function queryGames(lib: LibrarySnapshot, query: GamesQuery | GamesLookup): GamesResponse {
  const q = normalizeSearch(query.q);
  const only = "ids" in query ? new Set(query.ids) : null;
  const found = new Set<string>();
  const rows: GameSummary[] = [];
  for (const g of lib.games) {
    if (only) {
      if (!only.has(g.id)) continue;
      found.add(g.id);
    }
    if (query.kind && g.kind !== query.kind) continue;
    if (query.genre && !g.genres.includes(query.genre)) continue;
    if (q && !g.searchText.includes(q)) continue;
    const offers = g.listings.filter((l) => listingMatches(l, query));
    if (offers.length) rows.push(summarize(g, offers));
  }
  rows.sort(SORTS[query.sort]);

  const start = (query.page - 1) * query.pageSize;
  const page: GamesResponse = {
    total: rows.length,
    page: query.page,
    pageSize: query.pageSize,
    items: rows.slice(start, start + query.pageSize),
  };
  if (!only) return page;

  const inStock = rows.filter((r) => r.best.in_stock);
  return {
    ...page,
    missing: [...only].filter((id) => !found.has(id)),
    inStock: { games: inStock.length, cheapestSum: inStock.reduce((sum, r) => sum + r.best.price, 0) },
  };
}

export function libraryFilters(lib: LibrarySnapshot): FiltersResponse {
  const genreCounts = new Map<string, number>();
  for (const g of lib.games) for (const genre of g.genres) genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
  const present = new Set(lib.games.flatMap((g) => g.listings.map((l) => l.platform)));
  return {
    generated: lib.builtAt,
    stores: lib.stores,
    genres: [...genreCounts].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
    // Groups always; single platforms only when some listing has them.
    platforms: PLATFORM_FILTERS.filter((p) => p === "PS" || p === "Xbox" || present.has(p)),
    totals: {
      games: lib.games.filter((g) => g.kind === "game").length,
      offers: lib.games.reduce((n, g) => n + g.listings.length, 0),
    },
  };
}
