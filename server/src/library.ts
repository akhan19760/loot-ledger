/**
 * The built library as the games API sees it. No database access here, so the
 * same routes can run from the DB (src/index.ts) or from a snapshot baked at
 * deploy time (src/netlify.ts); db/library.ts loads it from the DB.
 */
import type { Game, Store } from "@lootledger/shared";

export interface IndexedGame extends Game {
  /** normalizeSearch(title + every store's raw title). */
  searchText: string;
  /** The price refresh at which a store last put this game back in stock (see stockSince). */
  inStockSince: string | null;
}

/** The library as stored: plain data, so it can be written out as JSON. */
export interface LibraryData {
  builtAt: string | null;
  /** When the prices it was built from were fetched: the latest store fetch. */
  pricesAt: string | null;
  stores: Store[];
  /** In library order (by title), as built. */
  games: IndexedGame[];
}

export interface LibrarySnapshot extends LibraryData {
  byId: Map<string, IndexedGame>;
}

export const indexLibrary = (data: LibraryData): LibrarySnapshot => ({ ...data, byId: new Map(data.games.map((g) => [g.id, g])) });

/** The latest fetch among the stores a library was built from. */
export const latestFetch = (stores: Pick<Store, "fetched_at">[]): string | null =>
  stores.reduce<string | null>((latest, s) => (s.fetched_at && (!latest || s.fetched_at > latest) ? s.fetched_at : latest), null);

/** What the previous build knew about a game. */
export interface PreviousStock {
  inStock: boolean;
  since: string | null;
}

/**
 * When a game came (back) into stock, carried from build to build. A game that no
 * store had in stock at the previous prices, and some store has now, came in at the
 * new prices. A rebuild without new prices (after a rule change, say) marks nothing
 * new, and neither does the first build to compare, since there's nothing to compare with.
 */
export function stockSince(game: Pick<Game, "listings">, previous: PreviousStock | undefined, prices: { now: string | null; before: string | null }): string | null {
  if (!game.listings.some((l) => l.in_stock)) return null;
  if (previous?.inStock) return previous.since;
  const fresh = prices.now !== null && prices.before !== null && prices.now !== prices.before;
  return fresh ? prices.now : null;
}
