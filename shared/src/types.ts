// Shapes shared by the API and the web app. They mirror what build.py produced
// in site/data.js, so the port can be checked field by field.

export type Kind = "game" | "hardware" | "giftcard" | "other";
export type Condition = "new" | "used";
export type Format = "disc" | "digital";

/**
 * What a store charges to deliver an order of games, read from its own checkout
 * (server/scripts/check-delivery.ts). `fees[i]` is the fee for i+1 games; the last
 * one applies to bigger orders.
 */
export interface Delivery {
  karachi: number[];
  /** Anywhere else in Pakistan (checked with a Lahore address). */
  elsewhere: number[];
  /** When the fees were read (YYYY-MM-DD). */
  checked: string;
  note?: string;
}

export interface Store {
  id: string;
  name: string;
  base: string;
  fetched_at: string | null;
  /** Missing when the store's fees haven't been checked. */
  delivery?: Delivery | null;
}

/** One store variant: a single price for a single product option. */
export interface Listing {
  store: string;
  raw_title: string;
  variant: string;
  platform: string | null;
  condition: Condition;
  format: Format;
  price: number;
  was: number | null;
  in_stock: boolean;
  url: string;
}

/** Listings for the same title grouped across stores. */
export interface Game {
  id: string;
  title: string;
  kind: Kind;
  genres: string[];
  image: string | null;
  listings: Listing[];
}

export interface HealthResponse {
  ok: true;
  time: string;
}

// ---------------------------------------------------------------- /api/games, /api/filters

export type SortOrder = "price" | "spread" | "stores" | "az";

/** Query for /api/games. Empty strings mean "any". */
export interface GamesQuery {
  q: string;
  genre: string;
  store: string;
  /** A platform name, or a group: "PS" (PS3/4/5), "Xbox" (every Xbox). */
  platform: string;
  condition: Condition | "";
  kind: Kind | "";
  inStock: boolean;
  sort: SortOrder;
  page: number;
  pageSize: number;
}

/**
 * Body of POST /api/games/lookup: the usual query, limited to these games (a reader's
 * wishlist or collection, which lives in their browser). POST because a collection's
 * ids can outgrow a URL.
 */
export interface GamesLookup extends GamesQuery {
  ids: string[];
}

/** A game with only what a grid card needs; details come from /api/games/:id. */
export interface GameSummary {
  id: string;
  title: string;
  kind: Kind;
  genres: string[];
  image: string | null;
  /** Cheapest matching offer (in stock first). */
  best: Listing;
  /** Offers and stores matching the listing filters. */
  offerCount: number;
  storeCount: number;
  /** Highest minus lowest in-stock matching price; 0 with fewer than 2. */
  spread: number;
}

export interface GamesResponse {
  total: number;
  page: number;
  pageSize: number;
  items: GameSummary[];
  /** Lookup only: ids no game has any more (no store lists it now). */
  missing?: string[];
  /** Lookup only, over every match rather than this page: matches in stock, and the sum of their cheapest prices. */
  inStock?: { games: number; cheapestSum: number };
}

export interface FiltersResponse {
  /** When the library was last built (ISO), null before the first build. */
  generated: string | null;
  stores: Store[];
  /** Genres by number of games, most first. */
  genres: { name: string; count: number }[];
  platforms: string[];
  totals: { games: number; offers: number };
}

// ---------------------------------------------------------------- /api/deals

/** Query for /api/deals: games only, in stock only, narrowed like the library. */
export interface DealsQuery {
  platform: string;
  condition: Condition | "";
  /** Most deals per list. */
  limit: number;
}

/** A store selling below the price it says it used to charge. `game.best` is that offer. */
export interface DiscountDeal {
  game: GameSummary;
  /** Rupees off the store's "was" price. */
  off: number;
  /** Percent off, rounded. */
  pct: number;
}

/**
 * The same version (platform, condition, format) at very different prices in two
 * stores. `game.best` is the cheap one, `high` the dearest other store's.
 */
export interface GapDeal {
  game: GameSummary;
  high: Listing;
  gap: number;
}

export interface DealsResponse {
  /** When the prices were last fetched, null before the first refresh. */
  pricesAt: string | null;
  /** Biggest percent off first. */
  discounts: DiscountDeal[];
  /** Biggest gap in rupees first. */
  gaps: GapDeal[];
  /** Games no store had in stock before the last refresh, and some store has now. Cheapest first. */
  restocked: GameSummary[];
}

// ---------------------------------------------------------------- /api/status

export type RunType = "prices" | "genres";

export interface RefreshRun {
  id: number;
  type: RunType;
  status: "running" | "ok" | "partial" | "failed";
  startedAt: string;
  finishedAt: string | null;
  /** Per source (store id or "wikidata"): item count on success, error otherwise. */
  results: Record<string, { ok: true; count: number; ms: number } | { ok: false; error: string; ms: number }> | null;
  error: string | null;
}

export interface StatusResponse {
  running: RunType | null;
  schedule: {
    timezone: string;
    jobs: Record<RunType, { cron: string; nextRun: string | null; lastRun: RefreshRun | null }>;
  };
  recentRuns: RefreshRun[];
  stores: { id: string; name: string; lastFetchedAt: string | null; lastStatus: "ok" | "failed" | null; lastError: string | null }[];
  library: { builtAt: string | null; games: number; listings: number };
}
