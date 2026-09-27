// Search, filter, sort and paginate the library. Same rules the old
// site/index.html applied in the browser (compute / offersFor).
import {
  byStockThenPrice,
  listingMatches,
  normalizeSearch,
  PLATFORM_FILTERS,
  type FiltersResponse,
  type GameSummary,
  type GamesQuery,
  type GamesResponse,
  type SortOrder,
} from "@ugs/shared";
import type { LibrarySnapshot } from "./library.ts";

const SORTS: Record<SortOrder, (a: GameSummary, b: GameSummary) => number> = {
  price: (a, b) => Number(b.best.in_stock) - Number(a.best.in_stock) || a.best.price - b.best.price,
  spread: (a, b) => b.spread - a.spread,
  stores: (a, b) => b.storeCount - a.storeCount || a.best.price - b.best.price,
  az: (a, b) => a.title.localeCompare(b.title),
};

export function queryGames(lib: LibrarySnapshot, query: GamesQuery): GamesResponse {
  const q = normalizeSearch(query.q);
  const rows: GameSummary[] = [];
  for (const g of lib.games) {
    if (query.kind && g.kind !== query.kind) continue;
    if (query.genre && !g.genres.includes(query.genre)) continue;
    if (q && !g.searchText.includes(q)) continue;
    const offers = g.listings.filter((l) => listingMatches(l, query));
    if (!offers.length) continue;
    const inStock = offers.filter((o) => o.in_stock).map((o) => o.price);
    rows.push({
      id: g.id,
      title: g.title,
      kind: g.kind,
      genres: g.genres,
      image: g.image,
      best: offers.toSorted(byStockThenPrice)[0]!,
      offerCount: offers.length,
      storeCount: new Set(offers.map((o) => o.store)).size,
      spread: inStock.length > 1 ? Math.max(...inStock) - Math.min(...inStock) : 0,
    });
  }
  rows.sort(SORTS[query.sort]);

  const start = (query.page - 1) * query.pageSize;
  return {
    total: rows.length,
    page: query.page,
    pageSize: query.pageSize,
    items: rows.slice(start, start + query.pageSize),
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
