import { asc, eq, isNotNull, sql } from "drizzle-orm";
import { normalizeSearch, type Listing, type Store } from "@ugs/shared";
import type { BuildInput, Library } from "../catalog/build.ts";
import type { WikidataGames } from "../catalog/genres.ts";
import { indexLibrary, type IndexedGame, type LibraryData, type LibrarySnapshot } from "../library.ts";
import type { Db } from "./client.ts";
import { games, listings, meta, rawFeeds, stores } from "./schema.ts";

/** Everything buildLibrary needs, read from the stored raw feeds. */
export function loadBuildInput(db: Db, storeOrder: string[]): BuildInput {
  const rows = db.select().from(stores).all();
  const byId = new Map(rows.map((s) => [s.id, s]));
  const feeds = new Map(db.select().from(rawFeeds).all().map((f) => [f.sourceId, f]));
  const wikidata = feeds.get("wikidata");
  return {
    stores: storeOrder.flatMap((id) => {
      const s = byId.get(id);
      return s ? [{ id: s.id, name: s.name, platform: s.platform, base: s.base, linkStyle: s.linkStyle }] : [];
    }),
    feeds: new Map(
      [...feeds].filter(([id]) => byId.has(id)).map(([id, f]) => [id, { fetchedAt: f.fetchedAt, products: f.payload as unknown[] }]),
    ),
    wikidata: wikidata ? (wikidata.payload as WikidataGames) : null,
  };
}

const CHUNK = 500; // rows per INSERT, well under SQLite's bound-parameter limit

/**
 * Replace the games and listings tables with a freshly built library. `builtAt`
 * defaults to now; pass the previous time when only the rules changed, not the data.
 */
export function saveLibrary(db: Db, lib: Library, builtAt = new Date().toISOString()) {
  db.transaction((tx) => {
    tx.delete(listings).run();
    tx.delete(games).run();
    const gameRows = lib.games.map((g) => ({
      id: g.id,
      title: g.title,
      kind: g.kind,
      genres: g.genres,
      image: g.image,
      searchText: normalizeSearch([g.title, ...g.listings.map((l) => l.raw_title)].join(" ")),
    }));
    const listingRows = lib.games.flatMap((g) =>
      g.listings.map((l) => ({
        gameId: g.id,
        storeId: l.store,
        rawTitle: l.raw_title,
        variant: l.variant,
        platform: l.platform,
        condition: l.condition,
        format: l.format,
        price: l.price,
        was: l.was,
        inStock: l.in_stock,
        url: l.url,
      })),
    );
    for (let i = 0; i < gameRows.length; i += CHUNK) tx.insert(games).values(gameRows.slice(i, i + CHUNK)).run();
    for (let i = 0; i < listingRows.length; i += CHUNK) tx.insert(listings).values(listingRows.slice(i, i + CHUNK)).run();
    const row = { key: "library_built_at", value: builtAt };
    tx.insert(meta).values(row).onConflictDoUpdate({ target: meta.key, set: row }).run();
  });
}

export function libraryBuiltAt(db: Db): string | null {
  return db.select().from(meta).where(eq(meta.key, "library_built_at")).get()?.value ?? null;
}

// ---------------------------------------------------------------- reading the built library

let cached: LibrarySnapshot | null = null;

/**
 * In-memory copy of the built library, which the games API filters. The DB stays
 * the source of truth: the copy is reloaded whenever meta.library_built_at changes,
 * so rebuilds from the scheduler or from a script in another process show up on
 * the next request.
 */
export function getLibrary(db: Db): LibrarySnapshot {
  const builtAt = libraryBuiltAt(db);
  if (!cached || cached.builtAt !== builtAt) cached = indexLibrary(readLibrary(db));
  return cached;
}

export function readLibrary(db: Db): LibraryData {
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

  return { builtAt: libraryBuiltAt(db), stores: storeList, games: gameList };
}
