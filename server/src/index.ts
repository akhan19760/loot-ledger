import Fastify from "fastify";
import type { HealthResponse } from "@ugs/shared";
import { config } from "./config.ts";

const app = Fastify({ logger: { level: "info" } });

app.get("/api/health", async (): Promise<HealthResponse> => ({ ok: true, time: new Date().toISOString() }));

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
