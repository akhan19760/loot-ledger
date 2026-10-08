/**
 * Rebuild games + listings from the raw feeds already in the DB, without
 * fetching. Handy after changing a rule in src/catalog/.
 *
 * Usage:  pnpm --filter @lootledger/server build:library
 */
import { config } from "../src/config.ts";
import { openDb } from "../src/db/client.ts";
import { syncStores } from "../src/db/stores.ts";
import { rebuildLibrary } from "../src/jobs/rebuild.ts";

const db = openDb(config.DB_PATH);
const t0 = performance.now();
const { stats } = rebuildLibrary(db, syncStores(db, config.STORES_FILE));
for (const line of stats) console.log(line);
console.log(`rebuilt in ${Math.round(performance.now() - t0)} ms`);
