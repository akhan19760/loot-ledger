/**
 * In-memory copy of the built library, which the games API filters.
 *
 * The DB stays the source of truth. The snapshot is reloaded whenever
 * meta.library_built_at changes, so rebuilds from the scheduler or from a script
 * in another process show up on the next request.
 */
import { asc, isNotNull, sql } from "drizzle-orm";
import type { Game, Listing, Store } from "@ugs/shared";
import type { Db } from "./db/client.ts";
import { libraryBuiltAt } from "./db/library.ts";
import { games, listings, stores } from "./db/schema.ts";

export interface IndexedGame extends Game {
  /** normalizeSearch(title + every store's raw title). */
  searchText: string;
}

export interface LibrarySnapshot {
  builtAt: string | null;
  stores: Store[];
  /** In library order (by title), as built. */
  games: IndexedGame[];
  byId: Map<string, IndexedGame>;
}

let cached: LibrarySnapshot | null = null;

export function getLibrary(db: Db): LibrarySnapshot {
  const builtAt = libraryBuiltAt(db);
  if (!cached || cached.builtAt !== builtAt) cached = load(db, builtAt);
  return cached;
}

function load(db: Db, builtAt: string | null): LibrarySnapshot {
  // Rows come back in insertion order: the build's sort order for games and,
  // within a game, for its listings (in stock first, then cheapest).
  const listingRows = db.select().from(listings).orderBy(asc(listings.id)).all();
  const byGame = new Map<string, Listing[]>();
  for (const l of listingRows) {
    const list = byGame.get(l.gameId) ?? byGame.set(l.gameId, []).get(l.gameId)!;
    list.push({
      store: l.storeId,
      raw_title: l.rawTitle,
      variant: l.variant,
      platform: l.platform,
      condition: l.condition,
      format: l.format,
      price: l.price,
      was: l.was,
      in_stock: l.inStock,
      url: l.url,
    });
  }

  const gameList: IndexedGame[] = db
    .select()
    .from(games)
    .orderBy(sql`rowid`)
    .all()
    .map((g) => ({ id: g.id, title: g.title, kind: g.kind, genres: g.genres, image: g.image, listings: byGame.get(g.id) ?? [], searchText: g.searchText }));

  const storeList: Store[] = db
    .select({ id: stores.id, name: stores.name, base: stores.base, fetched_at: stores.lastFetchedAt })
    .from(stores)
    .where(isNotNull(stores.lastFetchedAt))
    .orderBy(sql`rowid`)
    .all();

  return { builtAt, stores: storeList, games: gameList, byId: new Map(gameList.map((g) => [g.id, g])) };
}
