/**
 * One-time: load the Python pipeline's raw/*.json feeds into raw_feeds, so the
 * TypeScript build can run on the same data without fetching every store again.
 *
 * Usage:  pnpm --filter @ugs/server import:legacy [path/to/raw]   (default: ../raw)
 */
import fs from "node:fs";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { SERVER_ROOT, config } from "../src/config.ts";
import { openDb } from "../src/db/client.ts";
import { rawFeeds, stores } from "../src/db/schema.ts";
import { syncStores } from "../src/db/stores.ts";

const rawDir = path.resolve(SERVER_ROOT, process.argv[2] ?? "../raw");
const db = openDb(config.DB_PATH);
syncStores(db, config.STORES_FILE);

const readJson = (file: string) => JSON.parse(fs.readFileSync(file, "utf-8"));
// fetch.py wrote local time without a zone ("2026-09-27T16:28:31"); Date parses that as local.
const toIso = (local: string) => new Date(local).toISOString();

function saveFeed(sourceId: string, fetchedAt: string, payload: unknown, itemCount: number) {
  db.insert(rawFeeds)
    .values({ sourceId, fetchedAt, itemCount, payload })
    .onConflictDoUpdate({ target: rawFeeds.sourceId, set: { fetchedAt, itemCount, payload } })
    .run();
}

const expected: Record<string, number> = {};

for (const store of db.select().from(stores).all()) {
  const file = path.join(rawDir, `${store.id}.json`);
  if (!fs.existsSync(file)) {
    console.log(`skip ${store.id}: no ${file}`);
    continue;
  }
  const data = readJson(file) as { fetched_at: string; products: unknown[] };
  const fetchedAt = toIso(data.fetched_at);
  saveFeed(store.id, fetchedAt, data.products, data.products.length);
  db.update(stores).set({ lastFetchedAt: fetchedAt, lastStatus: "ok", lastError: null }).where(eq(stores.id, store.id)).run();
  expected[store.id] = data.products.length;
}

const wikiFile = path.join(rawDir, "wikidata_games.json");
if (fs.existsSync(wikiFile)) {
  const games = readJson(wikiFile) as Record<string, unknown>;
  const count = Object.keys(games).length;
  saveFeed("wikidata", fs.statSync(wikiFile).mtime.toISOString(), games, count);
  expected.wikidata = count;
} else {
  console.log(`skip wikidata: no ${wikiFile}`);
}

// Verify: count items inside the stored JSON, not just the item_count we wrote.
const rows = db
  .select({
    sourceId: rawFeeds.sourceId,
    fetchedAt: rawFeeds.fetchedAt,
    stored: sql<number>`(select count(*) from json_each(${rawFeeds.payload}))`,
  })
  .from(rawFeeds)
  .all();

console.table(
  rows.map((r) => ({ source: r.sourceId, fetched_at: r.fetchedAt, file: expected[r.sourceId], db: r.stored, match: expected[r.sourceId] === r.stored })),
);
const bad = rows.filter((r) => expected[r.sourceId] !== r.stored);
if (bad.length) {
  console.error(`MISMATCH for ${bad.map((r) => r.sourceId).join(", ")}`);
  process.exit(1);
}
console.log(`imported ${rows.length} feeds into ${config.DB_PATH}`);
