import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { config } from "./config.ts";
import { openDb } from "./db/client.ts";
import { syncStores } from "./db/stores.ts";
import { markInterruptedRuns, type RefreshContext } from "./jobs/refresh.ts";
import { refreshOnStart, startScheduler } from "./jobs/scheduler.ts";
import { getLibrary } from "./library.ts";
import { gamesRoutes } from "./routes/games.ts";
import { metaRoutes } from "./routes/meta.ts";

const app = Fastify({ logger: { level: "info" } });

const db = openDb(config.DB_PATH);
const storeIds = syncStores(db, config.STORES_FILE);
markInterruptedRuns(db);
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

// Per client IP. Responses carry x-ratelimit-* headers; over the limit gets a 429.
await app.register(rateLimit, { max: config.RATE_LIMIT_MAX, timeWindow: config.RATE_LIMIT_WINDOW });
metaRoutes(app, { db, scheduler });
gamesRoutes(app, { db });

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
