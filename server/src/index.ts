import Fastify from "fastify";
import type { HealthResponse } from "@ugs/shared";
import { config } from "./config.ts";
import { openDb } from "./db/client.ts";
import { syncStores } from "./db/stores.ts";

const app = Fastify({ logger: { level: "info" } });

const db = openDb(config.DB_PATH);
const storeIds = syncStores(db, config.STORES_FILE);
app.log.info({ db: config.DB_PATH, stores: storeIds.length }, "database ready");

app.get("/api/health", async (): Promise<HealthResponse> => ({ ok: true, time: new Date().toISOString() }));

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
