import { describe, expect, it } from "vitest";
import { normalizeSearch, type DealsQuery, type Game, type Listing } from "@ugs/shared";
import { openDb } from "./db/client.ts";
import { readLibrary, saveLibrary } from "./db/library.ts";
import { stores } from "./db/schema.ts";
import { queryDeals } from "./deals.ts";
import { indexLibrary, stockSince, type IndexedGame, type LibrarySnapshot } from "./library.ts";

const offer = (store: string, platform: string | null, price: number, extra: Partial<Listing> = {}): Listing => ({
  store, raw_title: "", variant: "", platform, condition: "new", format: "disc", price, was: null, in_stock: true, url: "", ...extra,
});
const game = (id: string, listings: Listing[], extra: Partial<IndexedGame> = {}): IndexedGame => ({
  id, title: id, kind: "game", genres: [], image: null, listings, searchText: normalizeSearch(id), inStockSince: null, ...extra,
});

const NOW = "2026-09-28T12:00:00.000Z";
const EARLIER = "2026-09-28T06:00:00.000Z";

const lib = (games: IndexedGame[]): LibrarySnapshot => indexLibrary({ builtAt: NOW, pricesAt: NOW, stores: [], games });
const q = (over: Partial<DealsQuery> = {}): DealsQuery => ({ platform: "", condition: "", limit: 36, ...over });

describe("queryDeals: discounts", () => {
  it("ranks by percent off, then rupees off, one deal per game", () => {
    const deals = queryDeals(
      lib([
        game("a", [offer("s1", "PS5", 5000, { was: 10000 }), offer("s2", "PS5", 6000, { was: 20000 })]), // 70% at s2
        game("b", [offer("s1", "PS5", 1000, { was: 2000 })]), // 50%, Rs 1,000
        game("c", [offer("s1", "PS5", 8000, { was: 16000 })]), // 50%, Rs 8,000
      ]),
      q(),
    );
    expect(deals.discounts.map((d) => [d.game.id, d.pct, d.off, d.game.best.store])).toEqual([
      ["a", 70, 14000, "s2"],
      ["c", 50, 8000, "s1"],
      ["b", 50, 1000, "s1"],
    ]);
  });

  it("skips out-of-stock offers, other platforms and discounts under Rs 100", () => {
    const deals = queryDeals(
      lib([
        game("oos", [offer("s1", "PS5", 5000, { was: 9000, in_stock: false })]),
        game("xbox", [offer("s1", "Xbox One", 5000, { was: 9000 })]),
        game("tiny", [offer("s1", "PS5", 5000, { was: 5050 })]),
        game("hw", [offer("s1", "PS5", 5000, { was: 9000 })], { kind: "hardware" }),
      ]),
      q({ platform: "PS" }),
    );
    expect(deals.discounts).toEqual([]);
  });
});

describe("queryDeals: price gaps", () => {
  it("compares stores within one version, not a used PS4 copy against a new PS5 one", () => {
    const deals = queryDeals(
      lib([
        game("a", [
          offer("s1", "PS5", 9000),
          offer("s2", "PS5", 12000),
          offer("s3", "PS4", 2000, { condition: "used" }),
        ]),
      ]),
      q(),
    );
    expect(deals.gaps).toHaveLength(1);
    expect(deals.gaps[0]).toMatchObject({ gap: 3000, game: { best: { store: "s1", price: 9000 } }, high: { store: "s2", price: 12000 } });
  });

  it("needs two stores, and ignores a store's own dearer copies and unspecified PlayStation copies", () => {
    const deals = queryDeals(
      lib([
        game("one-store", [offer("s1", "PS5", 9000), offer("s1", "PS5", 14000)]),
        game("generic", [offer("s1", "PlayStation", 5000), offer("s2", "PlayStation", 15000)]),
        game("oos", [offer("s1", "PS5", 5000), offer("s2", "PS5", 15000, { in_stock: false })]),
      ]),
      q(),
    );
    expect(deals.gaps).toEqual([]);
  });

  it("ranks by the gap in rupees", () => {
    const deals = queryDeals(
      lib([
        game("small", [offer("s1", "PS5", 1000), offer("s2", "PS5", 2000)]),
        game("big", [offer("s1", "PS4", 5000), offer("s2", "PS4", 9000)]),
      ]),
      q({ limit: 1 }),
    );
    expect(deals.gaps.map((d) => d.game.id)).toEqual(["big"]);
  });
});

describe("queryDeals: newly in stock", () => {
  it("lists games that came into stock at the latest prices, cheapest first", () => {
    const deals = queryDeals(
      lib([
        game("new-dear", [offer("s1", "PS5", 9000)], { inStockSince: NOW }),
        game("new-cheap", [offer("s1", "PS5", 4000)], { inStockSince: NOW }),
        game("older", [offer("s1", "PS5", 3000)], { inStockSince: EARLIER }),
        game("untracked", [offer("s1", "PS5", 3000)]),
        game("new-xbox", [offer("s1", "Xbox One", 3000)], { inStockSince: NOW }),
      ]),
      q({ platform: "PS" }),
    );
    expect(deals.restocked.map((g) => g.id)).toEqual(["new-cheap", "new-dear"]);
  });
});

describe("stockSince", () => {
  const inStock = { listings: [offer("s1", "PS5", 1000)] };
  const outOfStock = { listings: [offer("s1", "PS5", 1000, { in_stock: false })] };
  const fresh = { now: NOW, before: EARLIER };

  it("marks a game new when no store had it before and one has it at new prices", () => {
    expect(stockSince(inStock, { inStock: false, since: null }, fresh)).toBe(NOW);
    expect(stockSince(inStock, undefined, fresh)).toBe(NOW); // a title no store listed before
  });

  it("keeps the time for a game still in stock, and clears it when it sells out", () => {
    expect(stockSince(inStock, { inStock: true, since: EARLIER }, fresh)).toBe(EARLIER);
    expect(stockSince(inStock, { inStock: true, since: null }, fresh)).toBeNull();
    expect(stockSince(outOfStock, { inStock: true, since: EARLIER }, fresh)).toBeNull();
  });

  it("marks nothing new without new prices, or without an earlier build to compare with", () => {
    expect(stockSince(inStock, undefined, { now: NOW, before: NOW })).toBeNull();
    expect(stockSince(inStock, undefined, { now: NOW, before: null })).toBeNull();
  });
});

describe("saveLibrary tracks when games come into stock", () => {
  const build = (fetchedAt: string, games: Game[]) => ({ stores: [{ id: "s1", name: "S1", base: "https://s1", fetched_at: fetchedAt }], games });
  const g = (id: string, inStockNow: boolean): Game => ({ id, title: id, kind: "game", genres: [], image: null, listings: [offer("s1", "PS5", 1000, { in_stock: inStockNow })] });

  it("carries the time across refreshes and rebuilds", () => {
    const db = openDb(":memory:");
    db.insert(stores).values({ id: "s1", name: "S1", platform: "shopify", base: "https://s1" }).run();
    const since = () => Object.fromEntries(readLibrary(db).games.map((x) => [x.id, x.inStockSince]));

    saveLibrary(db, build(EARLIER, [g("stocked", true), g("sold-out", false)]));
    expect(since()).toEqual({ stocked: null, "sold-out": null }); // first build: nothing to compare with
    expect(readLibrary(db).pricesAt).toBe(EARLIER);

    saveLibrary(db, build(NOW, [g("stocked", true), g("sold-out", true), g("brand-new", true)]));
    expect(since()).toEqual({ stocked: null, "sold-out": NOW, "brand-new": NOW });

    // A rebuild of the same prices (a rule change) keeps what was new.
    saveLibrary(db, build(NOW, [g("stocked", true), g("sold-out", true), g("brand-new", true)]));
    expect(since()).toEqual({ stocked: null, "sold-out": NOW, "brand-new": NOW });
    db.$client.close();
  });
});
