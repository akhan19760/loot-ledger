// The deals page: the biggest discounts, the biggest price gaps between stores, and
// games newly in stock. Games only, in-stock offers only, narrowed by platform and
// condition like the library.
import { groupVersions, listingMatches, type DealsQuery, type DealsResponse, type DiscountDeal, type GapDeal, type GameSummary, type Listing } from "@lootledger/shared";
import type { LibrarySnapshot } from "./library.ts";
import { summarize } from "./query.ts";

/** Below this, a "discount" or a gap is rounding, not a deal. */
const MIN_RUPEES = 100;

/** Versions whose platform is known exactly; "PlayStation" could be a PS4 or a PS5 copy. */
const comparable = (platform: string | null) => platform !== null && platform !== "PlayStation";

export function queryDeals(lib: LibrarySnapshot, query: DealsQuery): DealsResponse {
  const discounts: DiscountDeal[] = [];
  const gaps: GapDeal[] = [];
  const restocked: GameSummary[] = [];
  const filters = { platform: query.platform, condition: query.condition, store: "", inStock: true };

  for (const g of lib.games) {
    if (g.kind !== "game") continue;
    const offers = g.listings.filter((l) => listingMatches(l, filters));
    if (!offers.length) continue;

    // The offer furthest below the store's own "was" price.
    let discount: { listing: Listing; off: number; pct: number } | null = null;
    for (const l of offers) {
      if (l.was === null || l.was - l.price < MIN_RUPEES) continue;
      const off = l.was - l.price;
      const pct = Math.round((100 * off) / l.was);
      if (!discount || pct > discount.pct || (pct === discount.pct && off > discount.off)) discount = { listing: l, off, pct };
    }
    if (discount) discounts.push({ game: summarize(g, offers, discount.listing), off: discount.off, pct: discount.pct });

    // The widest gap between two stores selling the same version.
    let gap: { low: Listing; high: Listing; gap: number } | null = null;
    for (const v of groupVersions(offers)) {
      if (!comparable(v.platform) || v.byStore.size < 2 || !v.best) continue;
      const high = [...v.byStore.values()].reduce((a, b) => (b.price > a.price ? b : a));
      const size = high.price - v.best.price;
      if (size >= MIN_RUPEES && (!gap || size > gap.gap)) gap = { low: v.best, high, gap: size };
    }
    if (gap) gaps.push({ game: summarize(g, offers, gap.low), high: gap.high, gap: gap.gap });

    if (lib.pricesAt && g.inStockSince === lib.pricesAt) restocked.push(summarize(g, offers));
  }

  discounts.sort((a, b) => b.pct - a.pct || b.off - a.off);
  gaps.sort((a, b) => b.gap - a.gap);
  restocked.sort((a, b) => a.best.price - b.best.price);
  return {
    pricesAt: lib.pricesAt,
    discounts: discounts.slice(0, query.limit),
    gaps: gaps.slice(0, query.limit),
    restocked: restocked.slice(0, query.limit),
  };
}
