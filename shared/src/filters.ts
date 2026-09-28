import type { GamesQuery, Listing } from "./types.ts";

/** Platform filter values: groups first, then single platforms as the build names them. */
export const PLATFORM_FILTERS = ["PS", "Xbox", "PS5", "PS4", "PS3", "Switch 2", "Switch", "Xbox Series", "Xbox One", "PC"] as const;

export function platformMatches(listingPlatform: string | null, filter: string): boolean {
  if (!filter) return true;
  const p = listingPlatform ?? "";
  if (filter === "PS") return /^PS[345]$/.test(p);
  if (filter === "Xbox") return p.startsWith("Xbox");
  return p === filter;
}

/** Does one offer pass the listing-level filters (platform, condition, store, stock)? */
export function listingMatches(l: Listing, f: Pick<GamesQuery, "platform" | "condition" | "store" | "inStock">): boolean {
  return (
    platformMatches(l.platform, f.platform) &&
    (!f.condition || l.condition === f.condition) &&
    (!f.store || l.store === f.store) &&
    (!f.inStock || l.in_stock)
  );
}

/** In stock first, then cheapest. */
export const byStockThenPrice = (a: Listing, b: Listing) => Number(b.in_stock) - Number(a.in_stock) || a.price - b.price;
