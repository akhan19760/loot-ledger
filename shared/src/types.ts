// Shapes shared by the API and the web app. They mirror what build.py produced
// in site/data.js, so the port can be checked field by field.

export type Kind = "game" | "hardware" | "giftcard" | "other";
export type Condition = "new" | "used";
export type Format = "disc" | "digital";

export interface Store {
  id: string;
  name: string;
  base: string;
  fetched_at: string | null;
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
