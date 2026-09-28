import { describe, expect, it } from "vitest";
import { normalizeSearch, type GamesQuery, type Listing } from "@ugs/shared";
import type { IndexedGame, LibrarySnapshot } from "./library.ts";
import { libraryFilters, queryGames } from "./query.ts";

const offer = (store: string, platform: string | null, price: number, extra: Partial<Listing> = {}): Listing => ({
  store, raw_title: "", variant: "", platform, condition: "new", format: "disc", price, was: null, in_stock: true, url: "", ...extra,
});
const game = (id: string, title: string, listings: Listing[], extra: Partial<IndexedGame> = {}): IndexedGame => ({
  id, title, kind: "game", genres: [], image: null, listings, searchText: normalizeSearch(title), ...extra,
});

const lib: LibrarySnapshot = {
  builtAt: "2026-09-27T12:00:00.000Z",
  stores: [
    { id: "a", name: "Store A", base: "https://a", fetched_at: null },
    { id: "b", name: "Store B", base: "https://b", fetched_at: null },
  ],
  games: [
    game("game:elden-ring", "Elden Ring", [offer("a", "PS5", 9000), offer("b", "PS4", 7000, { condition: "used" }), offer("b", "PS5", 12000)], { genres: ["Action", "RPG"] }),
    game("game:god-of-war-ragnarok", "God of War Ragnarök", [offer("a", "PS5", 5000, { in_stock: false }), offer("b", "PS4", 8000)], { genres: ["Action"] }),
    game("game:halo-infinite", "Halo Infinite", [offer("a", "Xbox Series", 6000)]),
    game("game:mario-wonder", "Super Mario Bros. Wonder", [offer("b", "Switch", 11000, { in_stock: false })]),
    game("hardware:dualsense", "DualSense", [offer("a", "PS5", 20000)], { kind: "hardware" }),
  ],
  byId: new Map(),
};

const q = (over: Partial<GamesQuery> = {}): GamesQuery => ({
  q: "", genre: "", store: "", platform: "", condition: "", kind: "game", inStock: false, sort: "price", page: 1, pageSize: 60, ...over,
});
const ids = (over: Partial<GamesQuery>) => queryGames(lib, q(over)).items.map((g) => g.id);

describe("queryGames", () => {
  it("filters by kind", () => {
    expect(ids({ kind: "hardware" })).toEqual(["hardware:dualsense"]);
    expect(queryGames(lib, q({ kind: "" })).total).toBe(5);
  });

  it("groups PS and Xbox platforms, matches others exactly", () => {
    expect(ids({ platform: "PS", sort: "az" })).toEqual(["game:elden-ring", "game:god-of-war-ragnarok"]);
    expect(ids({ platform: "Xbox" })).toEqual(["game:halo-infinite"]);
    expect(ids({ platform: "PS4", sort: "az" })).toEqual(["game:elden-ring", "game:god-of-war-ragnarok"]);
    expect(ids({ platform: "Switch 2" })).toEqual([]);
  });

  it("searches without accents or punctuation", () => {
    expect(ids({ q: "ragnarok" })).toEqual(["game:god-of-war-ragnarok"]);
    expect(ids({ q: "super-mario bros" })).toEqual(["game:mario-wonder"]);
  });

  it("filters by genre, store, condition and stock", () => {
    expect(ids({ genre: "RPG" })).toEqual(["game:elden-ring"]);
    expect(ids({ store: "a", sort: "az" })).toEqual(["game:elden-ring", "game:god-of-war-ragnarok", "game:halo-infinite"]);
    expect(ids({ condition: "used" })).toEqual(["game:elden-ring"]);
    expect(ids({ inStock: true })).not.toContain("game:mario-wonder");
  });

  it("summarizes only the matching offers", () => {
    const [elden] = queryGames(lib, q({ platform: "PS5", q: "elden" })).items;
    expect(elden).toMatchObject({ offerCount: 2, storeCount: 2, spread: 3000, best: { store: "a", price: 9000 } });
    // In stock beats cheaper: 8000 in stock wins over 5000 out of stock.
    const [gow] = queryGames(lib, q({ q: "god of war" })).items;
    expect(gow!.best).toMatchObject({ store: "b", price: 8000, in_stock: true });
    expect(gow!.spread).toBe(0); // one in-stock offer
  });

  it("sorts: in stock + cheapest, biggest spread, most stores, A-Z", () => {
    expect(ids({})).toEqual(["game:halo-infinite", "game:elden-ring", "game:god-of-war-ragnarok", "game:mario-wonder"]);
    expect(ids({ sort: "spread" })[0]).toBe("game:elden-ring");
    expect(ids({ sort: "stores" }).slice(0, 2)).toEqual(["game:elden-ring", "game:god-of-war-ragnarok"]);
    expect(ids({ sort: "az" })).toEqual(["game:elden-ring", "game:god-of-war-ragnarok", "game:halo-infinite", "game:mario-wonder"]);
  });

  it("paginates", () => {
    const page2 = queryGames(lib, q({ sort: "az", page: 2, pageSize: 3 }));
    expect(page2).toMatchObject({ total: 4, page: 2, pageSize: 3 });
    expect(page2.items.map((g) => g.id)).toEqual(["game:mario-wonder"]);
    expect(queryGames(lib, q({ page: 9 })).items).toEqual([]);
  });
});

describe("libraryFilters", () => {
  it("counts genres, lists present platforms and totals", () => {
    const f = libraryFilters(lib);
    expect(f.genres).toEqual([{ name: "Action", count: 2 }, { name: "RPG", count: 1 }]);
    expect(f.platforms).toEqual(["PS", "Xbox", "PS5", "PS4", "Switch", "Xbox Series"]);
    expect(f.totals).toEqual({ games: 4, offers: 8 });
  });
});
