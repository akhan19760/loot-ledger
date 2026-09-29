import { describe, expect, it } from "vitest";
import { idFromShareSlug, sharePath, shareText } from "./share.ts";
import type { Listing } from "./types.ts";

const offer = (store: string, platform: string | null, price: number, extra: Partial<Listing> = {}): Listing => ({
  store, raw_title: "", variant: "", platform, condition: "new", format: "disc", price, was: null, in_stock: true, url: "", ...extra,
});
const names: Record<string, string> = { a: "Games4U", b: "GamePark" };
const store = (id: string) => names[id] ?? id;

describe("share paths", () => {
  it("drops the game: prefix and round-trips", () => {
    expect(sharePath("game:elden-ring")).toBe("/g/elden-ring");
    expect(idFromShareSlug("elden-ring")).toBe("game:elden-ring");
  });

  it("keeps other kinds' prefixes", () => {
    expect(sharePath("hardware:dualsense")).toBe("/g/hardware%3Adualsense");
    expect(idFromShareSlug(decodeURIComponent("hardware%3Adualsense"))).toBe("hardware:dualsense");
  });
});

describe("shareText", () => {
  it("leads with the cheapest in-stock offer and its markdown", () => {
    const text = shareText(
      {
        title: "Elden Ring",
        listings: [offer("b", "PS5", 12000), offer("a", "PS5", 9000, { was: 12000 }), offer("a", "PS4", 5000, { condition: "used", in_stock: false })],
      },
      store,
    );
    expect(text).toEqual({
      title: "Elden Ring: Rs 9,000 at Games4U",
      description: "PS5, new, down from Rs 12,000. The cheapest of 3 offers from 2 Pakistani stores, compared on LootLedger.",
      message: "Elden Ring is Rs 9,000 at Games4U (PS5, new), down from Rs 12,000. Every store's price:",
    });
  });

  it("says digital, and leaves out an unknown platform", () => {
    const text = shareText({ title: "Astro Bot", listings: [offer("a", null, 4000, { format: "digital" })] }, store);
    expect(text.title).toBe("Astro Bot: Rs 4,000 at Games4U");
    expect(text.description).toBe("New, digital. Pakistani game store prices, compared on LootLedger.");
  });

  it("doesn't quote a price nobody can buy at", () => {
    const text = shareText({ title: "Halo", listings: [offer("a", "Xbox One", 5000, { in_stock: false })] }, store);
    expect(text.title).toBe("Halo on LootLedger");
    expect(text.description).toBe("Out of stock everywhere right now. Pakistani game store prices, compared on LootLedger.");
  });
});
