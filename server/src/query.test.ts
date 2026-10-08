import { describe, expect, it } from "vitest";
import { normalizeSearch, type GamesQuery, type Listing } from "@lootledger/shared";
import type { IndexedGame, LibrarySnapshot } from "./library.ts";
import { libraryFilters, queryGames } from "./query.ts";

const offer = (store: string, platform: string | null, price: number, extra: Partial<Listing> = {}): Listing => ({
  store, raw_title: "", variant: "", platform, condition: "new", format: "disc", price, was: null, in_stock: true, url: "", ...extra,
});
const game = (id: string, title: string, listings: Listing[], extra: Partial<IndexedGame> = {}): IndexedGame => ({
  id, title, kind: "game", genres: [], image: null, listings, searchText: normalizeSearch(title), inStockSince: null, ...extra,
});

const lib: LibrarySnapshot = {
  builtAt: "2026-09-27T12:00:00.000Z",
  pricesAt: "2026-09-27T12:00:00.000Z",
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

  it("counts a listing that only says PlayStation in the PS group, not in PS5/PS4", () => {
    const withGeneric: LibrarySnapshot = {
      ...lib,
      games: [...lib.games, game("game:wolverine", "Marvel's Wolverine", [offer("a", "PlayStation", 18999)])],
    };
    const find = (platform: string) => queryGames(withGeneric, q({ platform })).items.some((g) => g.id === "game:wolverine");
    expect(find("PS")).toBe(true);
    expect(find("PS5")).toBe(false);
    expect(find("PS4")).toBe(false);
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

describe("queryGames with ids (lookup)", () => {
  const lookup = (ids: string[], over: Partial<GamesQuery> = {}) => queryGames(lib, { ...q(over), ids });

  it("only searches the given games, with the usual filters and sort", () => {
    const res = lookup(["game:elden-ring", "game:halo-infinite", "game:mario-wonder"], { sort: "az" });
    expect(res.items.map((g) => g.id)).toEqual(["game:elden-ring", "game:halo-infinite", "game:mario-wonder"]);
    expect(lookup(["game:elden-ring", "game:halo-infinite"], { platform: "PS" }).items.map((g) => g.id)).toEqual(["game:elden-ring"]);
  });

  it("reports ids no game has, but not ones hidden by filters", () => {
    expect(lookup(["game:elden-ring", "game:gone", "game:halo-infinite"], { platform: "PS" }).missing).toEqual(["game:gone"]);
  });

  it("totals the cheapest in-stock price over every match, not just the page", () => {
    const res = lookup(["game:elden-ring", "game:god-of-war-ragnarok", "game:mario-wonder"], { pageSize: 1 });
    expect(res.items).toHaveLength(1);
    // Elden Ring 7000 (used PS4) + God of War 8000; Mario Wonder is out of stock.
    expect(res.inStock).toEqual({ games: 2, cheapestSum: 15000 });
  });

  it("leaves plain queries without lookup fields", () => {
    expect(queryGames(lib, q())).not.toHaveProperty("missing");
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
