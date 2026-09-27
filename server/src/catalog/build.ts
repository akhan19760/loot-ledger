/**
 * Turn raw store feeds into one library.
 *
 * Every store variant becomes a *listing* (store, platform, condition, price, link).
 * Listings for the same game are grouped under one *game* using a normalized title,
 * so the library can show "cheapest offer across all stores" per game.
 */
import type { Game, Kind, Listing, Store } from "@ugs/shared";
import { ADAPTERS, type RawListing, type StoreConfig } from "./adapters.ts";
import { DIGITAL, detectCondition, detectKind, detectPlatform } from "./detect.ts";
import { buildGenreIndex, lookupGenres, type WikidataGames } from "./genres.ts";
import { pyCompare, pyLen } from "./pyregex.ts";
import { cleanTitle, gameKey } from "./titles.ts";

export interface BuildInput {
  /** In stores.json order: it decides tie-breaks when sorting, as in build.py. */
  stores: StoreConfig[];
  feeds: Map<string, { fetchedAt: string; products: unknown[] }>;
  wikidata: WikidataGames | null;
}

export interface Library {
  stores: Store[];
  games: Game[];
}

type Classified = RawListing & Omit<Listing, keyof RawListing> & { kind: Kind; clean: string };

const LISTING_FIELDS = ["store", "raw_title", "variant", "platform", "condition", "format", "price", "was", "in_stock", "url"] as const;

export function buildLibrary({ stores: storeList, feeds, wikidata }: BuildInput): Library {
  const listings: Classified[] = [];
  const stores: Store[] = [];
  for (const store of storeList) {
    const feed = feeds.get(store.id);
    if (!feed) continue; // never fetched
    stores.push({ id: store.id, name: store.name, base: store.base, fetched_at: feed.fetchedAt });
    for (const p of feed.products) {
      for (const l of ADAPTERS[store.platform](store, p)) {
        if (l.price <= 0) continue; // "call for price" / placeholder products
        const meta = l.meta.join(" | ");
        listings.push({
          ...l,
          store: store.id,
          platform: detectPlatform(l.variant, l.raw_title, meta),
          condition: detectCondition(l.variant, l.raw_title, meta),
          format: DIGITAL.test(`${l.raw_title} ${l.variant}`) ? "digital" : "disc",
          kind: detectKind(l.raw_title, l.meta),
          clean: cleanTitle(l.raw_title),
        });
      }
    }
  }

  const groups = new Map<string, { kind: Kind; key: string; listings: Classified[] }>();
  for (const l of listings) {
    const key = gameKey(l.clean);
    const id = `${l.kind}\0${key}`;
    const group = groups.get(id) ?? groups.set(id, { kind: l.kind, key, listings: [] }).get(id)!;
    group.listings.push(l);
  }

  const genreIndex = buildGenreIndex(wikidata);
  const games: Game[] = [];
  for (const { kind, key, listings: ls } of groups.values()) {
    if (!key) continue;
    const title = mostCommonTitle(ls.map((l) => l.clean)); // before sorting: ties go to feed order
    ls.sort((a, b) => Number(!a.in_stock) - Number(!b.in_stock) || a.price - b.price);
    games.push({
      id: `${kind}:${key}`.replaceAll(" ", "-"),
      title,
      kind,
      genres: kind === "game" ? lookupGenres(key, genreIndex) : [],
      image: ls.find((l) => l.image)?.image ?? null,
      listings: ls.map((l) => Object.fromEntries(LISTING_FIELDS.map((f) => [f, l[f]])) as unknown as Listing),
    });
  }
  games.sort((a, b) => pyCompare(a.title.toLowerCase(), b.title.toLowerCase()));
  return { stores, games };
}

/** The spelling most listings use; ties go to the shortest, then the first seen. */
function mostCommonTitle(names: string[]): string {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  let best = "";
  let bestCount = 0;
  for (const [name, count] of counts) {
    if (count > bestCount || (count === bestCount && pyLen(name) < pyLen(best))) [best, bestCount] = [name, count];
  }
  return best;
}

/** The summary build.py printed after each build. */
export function libraryStats({ games }: Library): string[] {
  const kinds: Record<string, number> = {};
  for (const g of games) kinds[g.kind] = (kinds[g.kind] ?? 0) + 1;
  const listings = games.reduce((n, g) => n + g.listings.length, 0);
  const onlyGames = games.filter((g) => g.kind === "game");
  const multi = onlyGames.filter((g) => new Set(g.listings.map((l) => l.store)).size > 1).length;
  return [
    `${listings} listings in ${games.length} grouped items ${JSON.stringify(kinds)}`,
    `games sold by 2+ stores: ${multi}`,
    `games with a genre: ${onlyGames.filter((g) => g.genres.length).length}/${onlyGames.length}`,
  ];
}
