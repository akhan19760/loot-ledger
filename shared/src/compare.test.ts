import { describe, expect, it } from "vitest";
import { groupVersions, versionInsights } from "./compare.ts";
import type { Listing } from "./types.ts";

const offer = (store: string, platform: string | null, price: number, extra: Partial<Listing> = {}): Listing => ({
  store, raw_title: "", variant: "", platform, condition: "new", format: "disc", price, was: null, in_stock: true, url: "", ...extra,
});

describe("groupVersions", () => {
  it("groups by platform, condition and format, newest console first, new before used, disc before digital", () => {
    const versions = groupVersions([
      offer("a", "PS4", 5000, { condition: "used" }),
      offer("a", null, 4000),
      offer("b", "PS5", 9000, { format: "digital" }),
      offer("a", "PS4", 7000),
      offer("b", "PS5", 12000),
      offer("c", "PlayStation", 8000),
    ]);
    expect(versions.map((v) => v.key)).toEqual(["PS5|new|disc", "PS5|new|digital", "PS4|new|disc", "PS4|used|disc", "PlayStation|new|disc", "|new|disc"]);
  });

  it("keeps each store's best offer, preferring in stock over cheaper out of stock", () => {
    const [v] = groupVersions([
      offer("a", "PS5", 9000, { in_stock: false }),
      offer("a", "PS5", 11000),
      offer("a", "PS5", 13000),
      offer("b", "PS5", 10000),
    ]);
    expect(v!.byStore.get("a")!.price).toBe(11000);
    expect(v!.byStore.get("b")!.price).toBe(10000);
    expect(v!.best!.price).toBe(10000);
    expect(v!.inStock).toBe(3);
    // The priciest *store*, by its best offer, not the priciest offer.
    expect(v!.high).toBe(11000);
  });

  it("has no best or high price when nothing is in stock", () => {
    const [v] = groupVersions([offer("a", "PS5", 9000, { in_stock: false })]);
    expect(v!.best).toBeNull();
    expect(v!.high).toBeNull();
    expect(v!.byStore.get("a")!.price).toBe(9000);
  });
});

describe("versionInsights", () => {
  const versions = groupVersions([
    offer("a", "PS5", 15000),
    offer("b", "PS5", 14500),
    offer("c", "PS5", 16000),
    offer("a", "PS5", 10000, { condition: "used" }),
    offer("a", "PS4", 11500),
    offer("b", "PS4", 12000),
    offer("b", "PS4", 7000, { condition: "used", in_stock: false }),
  ]);
  const insights = versionInsights(versions);

  it("finds the cheapest in-stock offer of any version", () => {
    expect(insights.cheapest!.listing.price).toBe(10000);
    expect(insights.cheapest!.version.key).toBe("PS5|used|disc");
  });

  it("finds the biggest gap between stores within one version", () => {
    expect(insights.storeGap).toMatchObject({ saving: 1500 });
    expect(insights.storeGap!.version.key).toBe("PS5|new|disc");
  });

  it("compares used against new of the same platform and format", () => {
    expect(insights.used).toMatchObject({ saving: 4500 });
    expect(insights.used!.newer.key).toBe("PS5|new|disc");
  });

  it("compares the older console's copy with the same condition and format", () => {
    expect(insights.olderPlatform).toMatchObject({ saving: 3000 });
    expect(insights.olderPlatform!.older.key).toBe("PS4|new|disc");
  });

  it("leaves out facts that don't apply", () => {
    const single = versionInsights(groupVersions([offer("a", "PS5", 9000)]));
    expect(single).toMatchObject({ storeGap: null, used: null, olderPlatform: null });
    expect(single.cheapest!.listing.price).toBe(9000);
    expect(versionInsights(groupVersions([offer("a", "PS5", 9000, { in_stock: false })])).cheapest).toBeNull();
  });
});
