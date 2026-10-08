/**
 * Run a refresh job once, outside the server's schedule (for development).
 *
 * Usage:  pnpm --filter @lootledger/server refresh:prices              # all stores
 *         pnpm --filter @lootledger/server refresh:prices khanani      # some stores
 *         pnpm --filter @lootledger/server refresh:genres
 */
import { config } from "../src/config.ts";
import { openDb } from "../src/db/client.ts";
import { syncStores } from "../src/db/stores.ts";
import { refreshGenres, refreshPrices, type RefreshContext } from "../src/jobs/refresh.ts";

const [type, ...storeIds] = process.argv.slice(2);
const db = openDb(config.DB_PATH);
const ctx: RefreshContext = { db, storeOrder: syncStores(db, config.STORES_FILE), fetchDelayMs: config.FETCH_DELAY_MS, log: console };

const outcome =
  type === "prices" ? await refreshPrices(ctx, storeIds.length ? storeIds : undefined)
  : type === "genres" ? await refreshGenres(ctx)
  : (console.error(`unknown job "${type}": use prices or genres`), process.exit(2));

process.exit(outcome.skipped || outcome.status === "failed" ? 1 : 0);
