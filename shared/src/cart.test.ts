import { describe, expect, it } from "vitest";
import { deliveryFee, planCart, type CartLine, type CartWant, type Zone } from "./cart.ts";
import type { Delivery, Listing } from "./types.ts";

const offer = (store: string, price: number, extra: Partial<Listing> = {}): Listing => ({
  store, raw_title: "", variant: "", platform: "PS5", condition: "new", format: "disc", price, was: null, in_stock: true, url: "", ...extra,
});
const ANY: CartWant = { platform: null, condition: null, format: null };
const line = (gameId: string, listings: Listing[], want: Partial<CartWant> = {}): CartLine => ({ gameId, want: { ...ANY, ...want }, listings });
const flat = (fee: number): Delivery => ({ karachi: [fee], elsewhere: [fee], checked: "2026-09-29" });
const storeIds = (plan: { orders: { store: string }[] } | null) => plan?.orders.map((o) => o.store).sort();

describe("deliveryFee", () => {
  const tiers: Delivery = { karachi: [250, 500, 750], elsewhere: [500, 800], checked: "2026-09-29" };

  it("picks the fee for the number of games, the last one for bigger orders", () => {
    expect(deliveryFee(tiers, "karachi", 1)).toBe(250);
    expect(deliveryFee(tiers, "karachi", 3)).toBe(750);
    expect(deliveryFee(tiers, "karachi", 9)).toBe(750);
    expect(deliveryFee(tiers, "elsewhere", 2)).toBe(800);
  });

  it("is free with nothing to deliver, unknown without checked fees", () => {
    expect(deliveryFee(tiers, "karachi", 0)).toBe(0);
    expect(deliveryFee(null, "karachi", 2)).toBeNull();
  });
});

describe("planCart", () => {
  const stores = [
    { id: "a", delivery: flat(500) },
    { id: "b", delivery: flat(500) },
    { id: "c", delivery: flat(500) },
  ];

  it("buys from one store when splitting saves less than the extra delivery", () => {
    const plans = planCart(
      [line("x", [offer("a", 5000), offer("b", 5200)]), line("y", [offer("b", 3000), offer("c", 2900)]), line("z", [offer("b", 4000)])],
      stores,
      "karachi",
    );
    // Each at its cheapest: a 5000 + c 2900 + b 4000 + 3 x 500 delivery = 13,400.
    expect(plans.eachCheapest).toMatchObject({ items: 11900, delivery: 1500, total: 13400 });
    // All from b: 12,200 + 500.
    expect(plans.best).toMatchObject({ items: 12200, delivery: 500, total: 12700 });
    expect(storeIds(plans.best)).toEqual(["b"]);
    expect(plans.singleStore!.total).toBe(12700);
  });

  it("splits when a store's price gap beats its delivery fee", () => {
    const plans = planCart([line("x", [offer("a", 5000), offer("b", 9000)]), line("y", [offer("b", 3000), offer("a", 6000)])], stores, "karachi");
    expect(plans.best).toMatchObject({ total: 9000 }); // 5000 + 3000 + 2 x 500
    expect(storeIds(plans.best)).toEqual(["a", "b"]);
    expect(plans.singleStore!.total).toBe(11500); // all from a: 11000 + 500
  });

  it("uses fee tiers: it can pay to move a game off a store that jumps a tier", () => {
    const tiered = [
      { id: "a", delivery: { karachi: [100, 100, 2000], elsewhere: [100], checked: "2026-09-29" } },
      { id: "b", delivery: flat(300) },
    ];
    const plans = planCart(
      [line("x", [offer("a", 1000), offer("b", 1500)]), line("y", [offer("a", 1000), offer("b", 1500)]), line("z", [offer("a", 1000), offer("b", 1200)])],
      tiered,
      "karachi",
    );
    // All three from a would cost 3000 + 2000; two from a and z from b costs 2000 + 100 + 1200 + 300.
    expect(plans.best).toMatchObject({ total: 3600 });
    expect(plans.best!.orders.find((o) => o.store === "b")!.lines.map((l) => l.gameId)).toEqual(["z"]);
  });

  it("uses each zone's fees", () => {
    const zoned = [{ id: "a", delivery: { karachi: [200], elsewhere: [900], checked: "2026-09-29" } }, { id: "b", delivery: flat(400) }];
    const lines = [line("x", [offer("a", 1000), offer("b", 1300)])];
    expect(storeIds(planCart(lines, zoned, "karachi").best)).toEqual(["a"]);
    expect(storeIds(planCart(lines, zoned, "elsewhere").best)).toEqual(["b"]);
  });

  it("only uses in-stock offers that match the line, and reports games it can't place", () => {
    const plans = planCart(
      [
        line("x", [offer("a", 1000, { in_stock: false }), offer("b", 3000), offer("c", 2000, { platform: "PS4" })], { platform: "PS5" }),
        line("y", [offer("a", 900, { condition: "used" })], { condition: "new" }),
      ],
      stores,
      "karachi",
    );
    expect(plans.best!.orders).toEqual([{ store: "b", lines: [{ gameId: "x", listing: expect.objectContaining({ price: 3000 }) }], subtotal: 3000, delivery: 500 }]);
    expect(plans.unavailable).toEqual(["y"]);
  });

  it("charges no delivery for digital codes", () => {
    const plans = planCart([line("x", [offer("a", 4000, { format: "digital" })])], stores, "karachi");
    expect(plans.best).toMatchObject({ total: 4000, delivery: 0 });
  });

  it("counts stores without checked fees as free, and says so", () => {
    const plans = planCart([line("x", [offer("d", 1000)])], [...stores, { id: "d" }], "karachi");
    expect(plans.best!.total).toBe(1000);
    expect(plans.unknownDelivery).toEqual(["d"]);
  });

  it("has no single-store plan when no store has everything", () => {
    const plans = planCart([line("x", [offer("a", 1000)]), line("y", [offer("b", 1000)])], stores, "karachi");
    expect(plans.singleStore).toBeNull();
    expect(plans.best!.total).toBe(3000);
  });

  it("finds the same total as trying every combination", () => {
    // A small seeded generator, so a failure can be replayed.
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const ids = ["a", "b", "c", "d"];
    const tieredStores = ids.map((id) => ({
      id,
      delivery: { karachi: [200, 200, 450, 700].map((f) => f + Math.floor(rand() * 4) * 100), elsewhere: [600], checked: "2026-09-29" },
    }));

    for (let round = 0; round < 60; round++) {
      const lines = Array.from({ length: 2 + Math.floor(rand() * 4) }, (_, g) =>
        line(`g${g}`, ids.filter(() => rand() < 0.7).map((s) => offer(s, 1000 + Math.floor(rand() * 20) * 100))),
      ).filter((l) => l.listings.length);
      if (!lines.length) continue;
      const zone: Zone = "karachi";

      let brute = Infinity;
      const walk = (i: number, counts: Map<string, number>, prices: number) => {
        if (i === lines.length) {
          const fees = [...counts].reduce((n, [s, c]) => n + (c ? deliveryFee(tieredStores.find((x) => x.id === s)!.delivery, zone, c)! : 0), 0);
          brute = Math.min(brute, prices + fees);
          return;
        }
        for (const l of lines[i]!.listings) {
          counts.set(l.store, (counts.get(l.store) ?? 0) + 1);
          walk(i + 1, counts, prices + l.price);
          counts.set(l.store, counts.get(l.store)! - 1);
        }
      };
      walk(0, new Map(), 0);

      const plans = planCart(lines, tieredStores, zone);
      expect(plans.best!.total, `round ${round}`).toBe(brute);
      expect(plans.exact).toBe(true);
    }
  });
});
