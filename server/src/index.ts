import { buildApp } from "./app.ts";
import { config } from "./config.ts";
import { openDb } from "./db/client.ts";
import { getLibrary } from "./db/library.ts";
import { readStatus } from "./db/status.ts";
import { syncStores } from "./db/stores.ts";
import { markInterruptedRuns, type RefreshContext } from "./jobs/refresh.ts";
import { refreshOnStart, startScheduler } from "./jobs/scheduler.ts";

const db = openDb(config.DB_PATH);
const storeIds = syncStores(db, config.STORES_FILE);
markInterruptedRuns(db);

const app = await buildApp(
  { library: () => getLibrary(db), status: () => readStatus(db, scheduler) },
  { logger: { level: "info" }, rateLimit: { max: config.RATE_LIMIT_MAX, timeWindow: config.RATE_LIMIT_WINDOW } },
);
app.log.info({ db: config.DB_PATH, stores: storeIds.length }, "database ready");

const log = {
  info: (msg: string) => app.log.info(msg),
  warn: (msg: string) => app.log.warn(msg),
  error: (msg: string) => app.log.error(msg),
};
const ctx: RefreshContext = { db, storeOrder: storeIds, fetchDelayMs: config.FETCH_DELAY_MS, log };
const scheduler = startScheduler(ctx, { prices: config.CRON_PRICES, genres: config.CRON_GENRES, timezone: config.CRON_TIMEZONE });

const lib = getLibrary(db); // warm the in-memory copy before the first request
app.log.info(`library: ${lib.games.length} items from ${lib.stores.length} stores, built ${lib.builtAt ?? "never"}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    scheduler.stop();
    await app.close();
    process.exit(0);
  });
}

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// In the background: the API serves whatever data exists meanwhile.
refreshOnStart(ctx, config.REFRESH_ON_START).catch((err) => app.log.error(err, "startup refresh failed"));
