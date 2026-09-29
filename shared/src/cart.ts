import { platformMatches } from "./filters.ts";
import type { Condition, Delivery, Format, Listing } from "./types.ts";

/** Where the order goes: the stores' fees differ for Karachi and the rest of Pakistan. */
export type Zone = "karachi" | "elsewhere";

/** Which copies of a game will do; null means any. `platform` takes the filter values ("PS", "PS5", ...). */
export interface CartWant {
  platform: string | null;
  condition: Condition | null;
  format: Format | null;
}

export interface CartLine {
  gameId: string;
  want: CartWant;
  /** Every offer for the game (from /api/games/:id). */
  listings: Listing[];
}

export interface PlanOrder {
  store: string;
  lines: { gameId: string; listing: Listing }[];
  subtotal: number;
  delivery: number;
}

/** One way to buy the cart: an order per store. */
export interface Plan {
  orders: PlanOrder[];
  /** Sum of the games' prices. */
  items: number;
  delivery: number;
  total: number;
}

export interface CartPlans {
  /** The cheapest mix of stores, delivery included. */
  best: Plan | null;
  /** The cheapest single store that has every game; null when none does. */
  singleStore: Plan | null;
  /** Each game from whichever store sells it cheapest, delivery ignored when choosing. */
  eachCheapest: Plan | null;
  /** Games with no in-stock offer that matches what the line wants; left out of every plan. */
  unavailable: string[];
  /** Stores without checked delivery fees; counted as free, so the plan may be low. */
  unknownDelivery: string[];
  /** False when the search hit its limit and `best` may not be the cheapest. */
  exact: boolean;
}

export const wantMatches = (l: Listing, want: CartWant) =>
  (!want.platform || platformMatches(l.platform, want.platform)) &&
  (!want.condition || l.condition === want.condition) &&
  (!want.format || l.format === want.format);

/** A store's fee for an order with this many physical games (digital codes aren't delivered). */
export function deliveryFee(delivery: Delivery | null | undefined, zone: Zone, games: number): number | null {
  if (games === 0) return 0;
  if (!delivery) return null;
  const fees = delivery[zone];
  return fees[Math.min(games, fees.length) - 1]!;
}

/** Nodes the exact search may visit before settling for the best plan found so far. */
const SEARCH_LIMIT = 2_000_000;

/**
 * Plan the cheapest way to buy the cart. Each game can come from any store with an
 * in-stock offer that matches its line; each store used adds its delivery fee, which
 * depends on how many games it ships. The best plan is found by branch and bound: the
 * prices so far, the cheapest prices left and, per store, the lowest fee it could still
 * charge as its order grows make a lower bound, and any branch that can't beat the best
 * plan yet is dropped.
 */
export function planCart(lines: CartLine[], stores: { id: string; delivery?: Delivery | null }[], zone: Zone): CartPlans {
  const deliveryOf = new Map(stores.map((s) => [s.id, s.delivery]));
  const unknownDelivery = new Set<string>();
  const fee = (store: string, physical: number) => {
    const f = deliveryFee(deliveryOf.get(store), zone, physical);
    if (f === null) unknownDelivery.add(store);
    return f ?? 0;
  };
  // The least a store can charge once it ships at least this many games. Fees usually
  // only go up, but the search mustn't depend on it.
  const feeFloor = (store: string, physical: number) => {
    const fees = deliveryOf.get(store)?.[zone];
    if (physical === 0 || !fees) return 0;
    return Math.min(...fees.slice(Math.min(physical, fees.length) - 1));
  };

  // Per line, the cheapest matching in-stock offer at each store, cheapest store first.
  const unavailable: string[] = [];
  const options: { gameId: string; offers: Listing[] }[] = [];
  for (const line of lines) {
    const byStore = new Map<string, Listing>();
    for (const l of line.listings)
      if (l.in_stock && wantMatches(l, line.want) && (!byStore.has(l.store) || l.price < byStore.get(l.store)!.price)) byStore.set(l.store, l);
    if (!byStore.size) unavailable.push(line.gameId);
    else options.push({ gameId: line.gameId, offers: [...byStore.values()].sort((a, b) => a.price - b.price) });
  }
  if (!options.length) return { best: null, singleStore: null, eachCheapest: null, unavailable, unknownDelivery: [], exact: true };

  const plan = (picks: Listing[]): Plan => {
    const orders = new Map<string, PlanOrder>();
    picks.forEach((l, i) => {
      const order = orders.get(l.store) ?? { store: l.store, lines: [], subtotal: 0, delivery: 0 };
      order.lines.push({ gameId: options[i]!.gameId, listing: l });
      order.subtotal += l.price;
      orders.set(l.store, order);
    });
    for (const o of orders.values()) o.delivery = fee(o.store, o.lines.filter((x) => x.listing.format !== "digital").length);
    const list = [...orders.values()].sort((a, b) => b.lines.length - a.lines.length || a.store.localeCompare(b.store));
    const items = list.reduce((n, o) => n + o.subtotal, 0);
    const delivery = list.reduce((n, o) => n + o.delivery, 0);
    return { orders: list, items, delivery, total: items + delivery };
  };

  const eachCheapest = plan(options.map((o) => o.offers[0]!));

  let singleStore: Plan | null = null;
  const everyStore = new Set(options.flatMap((o) => o.offers.map((l) => l.store)));
  for (const store of everyStore) {
    const picks = options.map((o) => o.offers.find((l) => l.store === store));
    if (picks.every((l) => l)) {
      const p = plan(picks as Listing[]);
      if (!singleStore || p.total < singleStore.total) singleStore = p;
    }
  }

  // Branch and bound, in options' order: lines with the fewest stores first prune soonest.
  const order = options.map((_, i) => i).sort((a, b) => options[a]!.offers.length - options[b]!.offers.length);
  const cheapestLeft = new Array<number>(order.length + 1).fill(0);
  for (let k = order.length - 1; k >= 0; k--) cheapestLeft[k] = cheapestLeft[k + 1]! + options[order[k]!]!.offers[0]!.price;

  // Start from the better of the two easy plans (ties go to one store: fewer parcels).
  let best = singleStore && singleStore.total <= eachCheapest.total ? singleStore : eachCheapest;
  let bestPicks: Listing[] | null = null;
  const picks = new Array<Listing>(options.length);
  const physical = new Map<string, number>();
  let visited = 0;

  // `fees` is what the orders so far would pay; `floor` the least they can end up paying.
  const search = (k: number, prices: number, fees: number, floor: number) => {
    if (++visited > SEARCH_LIMIT) return;
    if (prices + floor + cheapestLeft[k]! >= best.total) return;
    if (k === order.length) {
      if (prices + fees < best.total) {
        best = { orders: [], items: prices, delivery: fees, total: prices + fees };
        bestPicks = [...picks];
      }
      return;
    }
    const i = order[k]!;
    for (const l of options[i]!.offers) {
      const before = physical.get(l.store) ?? 0;
      const after = before + (l.format === "digital" ? 0 : 1);
      picks[i] = l;
      physical.set(l.store, after);
      search(
        k + 1,
        prices + l.price,
        fees + fee(l.store, after) - fee(l.store, before),
        floor + feeFloor(l.store, after) - feeFloor(l.store, before),
      );
      physical.set(l.store, before);
    }
  };
  search(0, 0, 0, 0);

  return {
    best: bestPicks ? plan(bestPicks) : best,
    singleStore,
    eachCheapest,
    unavailable,
    unknownDelivery: [...unknownDelivery],
    exact: visited <= SEARCH_LIMIT,
  };
}
