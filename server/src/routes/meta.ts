import type { FastifyInstance } from "fastify";
import type { HealthResponse, StatusResponse } from "@lootledger/shared";

export function metaRoutes(app: FastifyInstance, { status }: { status: () => StatusResponse }) {
  app.get("/api/health", async (): Promise<HealthResponse> => ({ ok: true, time: new Date().toISOString() }));

  app.get("/api/status", async (): Promise<StatusResponse> => status());
}
