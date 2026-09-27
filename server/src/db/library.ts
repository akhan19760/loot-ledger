import { normalizeSearch } from "@ugs/shared";
import type { BuildInput, Library } from "../catalog/build.ts";
import type { WikidataGames } from "../catalog/genres.ts";
import type { Db } from "./client.ts";
import { games, listings, rawFeeds, stores } from "./schema.ts";

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

/** Replace the games and listings tables with a freshly built library. */
export function saveLibrary(db: Db, lib: Library) {
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
  });
}
