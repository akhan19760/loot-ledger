import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { Condition, Format, Kind } from "@ugs/shared";

// Timestamps are ISO-8601 UTC strings.

/** Stores we fetch from. Synced from stores.json on startup. */
export const stores = sqliteTable("stores", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  platform: text("platform", { enum: ["shopify", "woocommerce"] }).notNull(),
  base: text("base").notNull(),
  // "query": link products as ?product=<slug> because the store's pretty URLs 404.
  linkStyle: text("link_style", { enum: ["query"] }),
  lastFetchedAt: text("last_fetched_at"),
  lastStatus: text("last_status", { enum: ["ok", "failed"] }),
  lastError: text("last_error"),
});

/**
 * Latest raw feed per source: a store id, or "wikidata" for the genre list.
 * Kept so the library can be rebuilt without fetching again (like raw/*.json was).
 */
export const rawFeeds = sqliteTable("raw_feeds", {
  sourceId: text("source_id").primaryKey(),
  fetchedAt: text("fetched_at").notNull(),
  itemCount: integer("item_count").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
});

/** Listings for the same title grouped across stores. id is "<kind>:<normalized-title>". */
export const games = sqliteTable("games", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  kind: text("kind").$type<Kind>().notNull(),
  genres: text("genres", { mode: "json" }).$type<string[]>().notNull(),
  image: text("image"),
  searchText: text("search_text").notNull(),
});

/** One store variant: a single price for a single product option. */
export const listings = sqliteTable(
  "listings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    gameId: text("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
    storeId: text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    rawTitle: text("raw_title").notNull(),
    variant: text("variant").notNull(),
    platform: text("platform"),
    condition: text("condition").$type<Condition>().notNull(),
    format: text("format").$type<Format>().notNull(),
    price: real("price").notNull(),
    was: real("was"),
    inStock: integer("in_stock", { mode: "boolean" }).notNull(),
    url: text("url").notNull(),
  },
  (t) => [index("listings_game_idx").on(t.gameId), index("listings_store_idx").on(t.storeId)],
);

/** One row per scheduled refresh (store prices or Wikidata genres). */
export const refreshRuns = sqliteTable("refresh_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["prices", "genres"] }).notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  status: text("status", { enum: ["running", "ok", "partial", "failed"] }).notNull(),
  // Per-source outcome, e.g. { gamepark: { ok: true, count: 1234 } }.
  results: text("results", { mode: "json" }).$type<Record<string, unknown>>(),
  error: text("error"),
});
